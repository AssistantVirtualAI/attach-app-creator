import { useState, useEffect, useRef, useCallback } from 'react';
import { createSIPUA, JsSIPUnavailableError, SIPConfig, buildSdpModifier, classifySipFailure, hasWebRTC, WEBRTC_UNAVAILABLE_MESSAGE } from '../lib/sip/jssipProvider';
import {
  appendSipLog, clearSipLog as clearPersistedLog, clearPersistedStatus, loadPersistedError, loadPersistedStatus,
  loadSipLog, MAX_AUTO_RETRIES, PersistedSipError, probeWss, RETRY_BACKOFF_MS, savePersistedError, savePersistedStatus,
  SipLogEntry,
} from '../lib/sip/sipPersistence';
import { AudioProfile, loadAudioProfile, saveAudioProfile, PROFILE_OPUS } from '../lib/sip/audioProfile';
import { CallQuality, EMPTY_QUALITY, SamplerState, sampleCallQuality, chooseAdaptiveBitrate } from '../lib/sip/callQuality';
import { showMobileToast } from '../lib/mobileToast';

export type SIPStatus = 'idle' | 'connecting' | 'registered' | 'retrying' | 'error';
export type CallState = 'idle' | 'ringing' | 'active' | 'ended';

export interface UseSoftphoneReturn {
  sipStatus: SIPStatus;
  sipError: string;
  callState: CallState;
  callTimer: number;
  isMuted: boolean;
  isOnHold: boolean;
  activeCallNumber: string;
  call: (number: string) => boolean | void;
  hangup: () => void;
  answer: () => void;
  mute: () => void;
  unmute: () => void;
  hold: () => void;
  unhold: () => void;
  sendDTMF: (key: string) => void;
  setStatus: (status: string) => void;
  reconnect: () => void;
  /** Last persisted error (from prior session if app was restarted). */
  lastPersistedError: PersistedSipError | null;
  /** Rolling buffer of SIP-related events (latest last). */
  sipLog: SipLogEntry[];
  clearSipLog: () => void;
  /** Clear persisted sipStatus + last sipError (also resets retry cap). */
  clearSipState: () => void;
  /** Current retry attempt counter (0 = none). */
  retryAttempt: number;
  /** When the next auto-retry is scheduled (epoch ms) or null. */
  nextRetryAt: number | null;
  /** True once auto-retry budget is exhausted — requires manual reconnect. */
  retryLimitReached: boolean;
  /** Live call quality (RTT / jitter / loss / level). */
  quality: CallQuality;
  /** Active audio profile (hd / auto / low-bandwidth). */
  audioProfile: AudioProfile;
  setAudioProfile: (p: AudioProfile) => void;
}

export function useSoftphone(
  config: SIPConfig | null,
  opts: { jsSipTimeoutMs?: number } = {},
): UseSoftphoneReturn {
  const [sipStatus, setSipStatusState] = useState<SIPStatus>('idle');
  const [sipError, setSipErrorState] = useState('');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [activeCallNumber, setActiveCallNumber] = useState('');
  const [lastPersistedError, setLastPersistedError] = useState<PersistedSipError | null>(() => loadPersistedError());
  const [sipLog, setSipLog] = useState<SipLogEntry[]>(() => loadSipLog());
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [retryLimitReached, setRetryLimitReached] = useState(false);
  const [audioProfile, setAudioProfileState] = useState<AudioProfile>(() => loadAudioProfile());
  const [quality, setQuality] = useState<CallQuality>(EMPTY_QUALITY);

  const uaRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioProfileRef = useRef<AudioProfile>(audioProfile);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const samplerStateRef = useRef<SamplerState>({});
  const currentBitrateRef = useRef<number>(PROFILE_OPUS.auto.hardCapBitrate);
  const reRegisterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last quality alert level shown, and when — used to throttle toasts. */
  const lastAlertRef = useRef<{ level: number; at: number }>({ level: 4, at: 0 });

  useEffect(() => { audioProfileRef.current = audioProfile; }, [audioProfile]);

  const setAudioProfile = useCallback((p: AudioProfile) => {
    setAudioProfileState(p);
    saveAudioProfile(p);
    try {
      const pc: RTCPeerConnection | undefined = sessionRef.current?.connection;
      const sender = pc?.getSenders().find((s) => s.track?.kind === 'audio');
      if (sender) {
        const params = sender.getParameters();
        params.encodings = params.encodings?.length ? params.encodings : [{}];
        params.encodings[0].maxBitrate = PROFILE_OPUS[p].hardCapBitrate;
        currentBitrateRef.current = PROFILE_OPUS[p].hardCapBitrate;
        sender.setParameters(params).catch(() => {});
      }
    } catch {}
  }, []);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authBlockedRef = useRef(false);
  const retryAttemptRef = useRef(0);
  const reconnectRef = useRef<() => void>(() => {});
  const [reconnectTick, setReconnectTick] = useState(0);

  // --- logging helpers ---
  const log = useCallback((event: string, detail?: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const entry: SipLogEntry = { time: Date.now(), level, event, detail };
    const next = appendSipLog(entry);
    setSipLog(next);
    // Mirror to console for live debugging.
    const tag = `[SIP][${level}] ${event}`;
    if (level === 'error') console.error(tag, detail || '');
    else if (level === 'warn') console.warn(tag, detail || '');
    else console.log(tag, detail || '');
  }, []);

  const setSipStatus = useCallback((s: SIPStatus) => {
    setSipStatusState(s);
    savePersistedStatus(s);
  }, []);

  const setSipError = useCallback((msg: string, ctx?: { extension?: string; domain?: string }) => {
    setSipErrorState(msg);
    if (msg && (ctx?.extension || ctx?.domain)) {
      const persisted: PersistedSipError = {
        error: msg,
        extension: ctx?.extension || '',
        domain: ctx?.domain || '',
        time: Date.now(),
      };
      savePersistedError(persisted);
      setLastPersistedError(persisted);
    }
  }, []);

  const clearSipLog = useCallback(() => { clearPersistedLog(); setSipLog([]); }, []);

  const clearSipState = useCallback(() => {
    clearPersistedStatus();
    savePersistedError(null);
    setLastPersistedError(null);
    setSipErrorState('');
    setSipStatusState('idle');
    setRetryAttempt(0);
    setRetryLimitReached(false);
  }, []);

  // Restore persisted status on mount so UI doesn't flash "idle" on cold start.
  useEffect(() => {
    const prior = loadPersistedStatus();
    if (prior === 'error' || prior === 'retrying') {
      setSipStatusState('connecting');
    }
  }, []);

  // WebRTC capability check on mount — surfaces clear error immediately so
  // UI doesn't sit on "connecting…" for ever.
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasWebRTC()) {
      setSipStatus('error');
      setSipError(WEBRTC_UNAVAILABLE_MESSAGE);
      log('webrtc.unavailable', WEBRTC_UNAVAILABLE_MESSAGE, 'error');
    }
  }, [log, setSipError, setSipStatus]);

  useEffect(() => {
    if (!config) return;
    if (typeof window !== 'undefined' && !hasWebRTC()) return;
    let cancelled = false;

    const ctx = { extension: config.extension, domain: config.domain };
    const clearRetry = () => {
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      setNextRetryAt(null);
    };
    authBlockedRef.current = false;

    const start = () => {
      if (cancelled) return;
      setSipStatus('connecting');
      setSipErrorState('');
      log('register.start', `ext=${config.extension}@${config.domain} wss=${config.wssUrl}`);

      createSIPUA(config, opts.jsSipTimeoutMs ?? 8000)
        .then((ua) => {
          if (cancelled) { try { ua.stop(); } catch {} return; }
          ua.on('connecting', () => log('ws.connecting', config.wssUrl));
          ua.on('connected', () => log('ws.connected', config.wssUrl));
          ua.on('registered', () => {
            retryAttemptRef.current = 0;
            setRetryAttempt(0);
            clearRetry();
            setSipStatus('registered');
            setSipErrorState('');
            log('register.ok', `ext=${config.extension}@${config.domain}`);
          });
          // Silent re-register on expiry / soft unregister — keeps the
          // active RTP session alive while we refresh the binding.
          const scheduleSilentReRegister = (delayMs: number, reason: string) => {
            if (reRegisterTimerRef.current) clearTimeout(reRegisterTimerRef.current);
            const delay = Math.max(500, Math.min(delayMs, 30000));
            log('register.silent-reattempt', `${reason} in ${delay}ms`, 'warn');
            reRegisterTimerRef.current = setTimeout(() => {
              try { uaRef.current?.register?.(); }
              catch (e: any) { log('register.silent-reattempt.failed', e?.message || '', 'error'); }
            }, delay);
          };
          ua.on('unregistered', (e: any) => {
            log('register.unregistered', e?.cause || '', 'warn');
            // Progressive backoff, scaled by retry attempt counter.
            const a = retryAttemptRef.current;
            const delay = [1000, 2000, 4000, 8000, 15000][Math.min(a, 4)];
            scheduleSilentReRegister(delay, 'unregistered');
          });
          ua.on('registrationExpiring', () => {
            log('register.expiring', 'refreshing binding');
            scheduleSilentReRegister(500, 'expiring');
          });
          ua.on('registrationFailed', (e: any) => {
            const code = e?.response?.status_code;
            const msg = classifySipFailure({
              cause: e?.cause,
              status_code: code,
              reason_phrase: e?.response?.reason_phrase,
            });
            setSipStatus('error');
            setSipError(msg, ctx);
            log('register.failed', `code=${code ?? '?'} cause=${e?.cause || ''} → ${msg}`, 'error');
            if (code === 401 || code === 403 || code === 407) {
              authBlockedRef.current = true;
              log('retry.blocked', `auth failure (${code}) — auto-retry disabled until credentials change`, 'warn');
              return;
            }
            scheduleRetry();
          });
          ua.on('disconnected', (e: any) => {
            setSipStatus('connecting');
            log('ws.disconnected', `code=${e?.code || ''} reason=${e?.reason || ''}`, 'warn');
            if (e?.error) {
              const msg = classifySipFailure({ cause: e?.reason || 'WSS connection failed' });
              setSipError(msg, ctx);
              scheduleRetry();
            }
          });
          ua.on('newRTCSession', (data: any) => {
            const session = data.session;
            sessionRef.current = session;
            const remoteNumber = session.remote_identity?.uri?.user || 'Unknown';
            setActiveCallNumber(remoteNumber);
            log('session.new', `${session.direction} ${remoteNumber}`);
            if (session.direction === 'incoming') setCallState('ringing');
            session.on('confirmed', () => {
              setCallState('active');
              log('session.confirmed', remoteNumber);
              timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
              // ---- Live quality sampler + adaptive bitrate loop ----
              samplerStateRef.current = {};
              const pc: RTCPeerConnection | undefined = session.connection;
              const sender = pc?.getSenders().find((s) => s.track?.kind === 'audio');
              const profile = audioProfileRef.current;
              currentBitrateRef.current = PROFILE_OPUS[profile].hardCapBitrate;
              if (sender) {
                try {
                  const params = sender.getParameters();
                  params.encodings = params.encodings?.length ? params.encodings : [{}];
                  params.encodings[0].maxBitrate = currentBitrateRef.current;
                  sender.setParameters(params).catch(() => {});
                } catch {}
              }
              if (pc) {
                if (statsTimerRef.current) clearInterval(statsTimerRef.current);
                statsTimerRef.current = setInterval(async () => {
                  const q = await sampleCallQuality(pc, samplerStateRef.current);
                  setQuality(q);
                  // ---- Quality alerts (throttled, only when level worsens) ----
                  const now = Date.now();
                  const prev = lastAlertRef.current;
                  const cooldown = 15000; // don't re-alert same band for 15s
                  const profile = audioProfileRef.current;
                  const switchToLowBw = () => {
                    setAudioProfileState('low-bandwidth');
                    saveAudioProfile('low-bandwidth');
                    audioProfileRef.current = 'low-bandwidth';
                    if (sender) {
                      try {
                        const p = sender.getParameters();
                        p.encodings = p.encodings?.length ? p.encodings : [{}];
                        p.encodings[0].maxBitrate = PROFILE_OPUS['low-bandwidth'].hardCapBitrate;
                        currentBitrateRef.current = PROFILE_OPUS['low-bandwidth'].hardCapBitrate;
                        sender.setParameters(p).catch(() => {});
                      } catch {}
                    }
                    log('quality.profile.auto-switch', `→ low-bandwidth (loss=${q.lossPct}% rtt=${q.rtt}ms)`, 'warn');
                  };
                  if (q.level <= 1 && prev.level > 1 && now - prev.at > cooldown) {
                    lastAlertRef.current = { level: q.level, at: now };
                    if (profile !== 'low-bandwidth') {
                      showMobileToast(
                        `Réseau critique · perte ${q.lossPct}% · toucher pour activer le mode faible bande passante`,
                        'error',
                        switchToLowBw,
                      );
                    } else {
                      showMobileToast(`Réseau critique · perte ${q.lossPct}%`, 'error');
                    }
                  } else if (q.level === 2 && prev.level > 2 && now - prev.at > cooldown) {
                    lastAlertRef.current = { level: q.level, at: now };
                    showMobileToast(`Qualité dégradée · perte ${q.lossPct}% · jitter ${q.jitter}ms`, 'warning');
                  } else if (q.level >= 4 && prev.level < 3 && now - prev.at > cooldown) {
                    lastAlertRef.current = { level: q.level, at: now };
                    showMobileToast('Réseau rétabli · qualité optimale', 'success');
                  }
                  // ---- Adaptive bitrate (AUTO only) ----
                  if (audioProfileRef.current === 'auto' && sender) {
                    const cap = PROFILE_OPUS.auto.hardCapBitrate;
                    const target = chooseAdaptiveBitrate(q, cap, currentBitrateRef.current);
                    if (Math.abs(target - currentBitrateRef.current) > 1500) {
                      currentBitrateRef.current = target;
                      try {
                        const params = sender.getParameters();
                        params.encodings = params.encodings?.length ? params.encodings : [{}];
                        params.encodings[0].maxBitrate = target;
                        await sender.setParameters(params);
                        log('adaptive.bitrate', `→ ${target} bps (loss=${q.lossPct}% rtt=${q.rtt}ms)`);
                      } catch {}
                    }
                  }
                }, 2000);
              }
            });
            const stopStats = () => {
              if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = null; }
              setQuality(EMPTY_QUALITY);
              samplerStateRef.current = {};
            };
            session.on('ended', () => {
              setCallState('ended');
              log('session.ended', remoteNumber);
              if (timerRef.current) clearInterval(timerRef.current);
              stopStats();
              setTimeout(() => {
                setCallState('idle');
                setCallTimer(0);
                setIsMuted(false);
                setIsOnHold(false);
                setActiveCallNumber('');
              }, 2000);
            });
            session.on('failed', (e: any) => {
              const msg = classifySipFailure({
                cause: e?.cause,
                status_code: e?.message?.status_code,
                reason_phrase: e?.message?.reason_phrase,
              });
              setSipError(msg, ctx);
              log('session.failed', `${remoteNumber} → ${msg}`, 'error');
              setCallState('idle');
              if (timerRef.current) clearInterval(timerRef.current);
              stopStats();
              setActiveCallNumber('');
            });
          });
          ua.start();
          uaRef.current = ua;
        })
        .catch((err) => {
          if (cancelled) return;
          setSipStatus('error');
          const msg = err instanceof JsSIPUnavailableError
            ? 'Phone library failed to load. Check your internet connection and try again.'
            : classifySipFailure({ cause: err?.message });
          setSipError(msg, ctx);
          log('ua.create-failed', `${err?.name || ''}: ${err?.message || ''}`, 'error');
          scheduleRetry();
        });
    };

    const scheduleRetry = async () => {
      if (cancelled) return;
      if (authBlockedRef.current) return;

      const attempt = retryAttemptRef.current;
      if (attempt >= MAX_AUTO_RETRIES) {
        const msg = `Auto-retry limit reached (${MAX_AUTO_RETRIES} attempts). Tap “Retry connection” to try again.`;
        setSipStatus('error');
        setSipError(msg, ctx);
        setRetryLimitReached(true);
        setNextRetryAt(null);
        log('retry.limit-reached', `${MAX_AUTO_RETRIES} attempts`, 'error');
        return;
      }

      // Quick WSS reachability probe — if the server is unreachable, skip the
      // back-off wait and surface the error immediately. The user can retry manually.
      log('probe.start', config.wssUrl);
      const probe = await probeWss(config.wssUrl, 3500);
      if (cancelled) return;
      log(probe.ok ? 'probe.ok' : 'probe.fail', `${config.wssUrl} ${probe.reason || ''} ${probe.ms}ms`, probe.ok ? 'info' : 'warn');
      if (!probe.ok) {
        setSipStatus('error');
        setSipError(`Phone server unreachable (${probe.reason || 'no response'}). Check network / WSS endpoint.`, ctx);
        setNextRetryAt(null);
        return;
      }

      const delay = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
      retryAttemptRef.current = attempt + 1;
      setRetryAttempt(attempt + 1);
      clearRetry();
      setSipStatus('retrying');
      const fireAt = Date.now() + delay;
      setNextRetryAt(fireAt);
      log('retry.scheduled', `attempt=${attempt + 1}/${MAX_AUTO_RETRIES} delay=${Math.round(delay / 1000)}s`);
      retryTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        log('retry.fire', `attempt=${attempt + 1}`);
        try { uaRef.current?.stop(); } catch {}
        uaRef.current = null;
        start();
      }, delay);
    };

    reconnectRef.current = () => {
      if (cancelled) return;
      clearRetry();
      retryAttemptRef.current = 0;
      setRetryAttempt(0);
      setRetryLimitReached(false);
      authBlockedRef.current = false;
      log('reconnect.manual', 'user-initiated');
      try { uaRef.current?.stop(); } catch {}
      uaRef.current = null;
      start();
    };

    start();

    return () => {
      cancelled = true;
      clearRetry();
      if (reRegisterTimerRef.current) { clearTimeout(reRegisterTimerRef.current); reRegisterTimerRef.current = null; }
      if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = null; }
      retryAttemptRef.current = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      try { uaRef.current?.stop(); } catch {}
      uaRef.current = null;
      reconnectRef.current = () => {};
    };
  }, [config?.extension, config?.wssUrl, config?.domain, config?.password, opts.jsSipTimeoutMs, reconnectTick, log, setSipError, setSipStatus]);

  // HD audio capture constraints — noise cancellation, echo cancellation,
  // auto gain, mono 16 kHz. Combined with Opus FEC/DTX in the SDP, this
  // delivers usable voice even on weak cellular links.
  const HD_AUDIO_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 16000,
      sampleSize: 16,
      // Chromium-specific hints, ignored elsewhere.
      googEchoCancellation: true,
      googNoiseSuppression: true,
      googAutoGainControl: true,
      googHighpassFilter: true,
      googTypingNoiseDetection: true,
    } as any,
    video: false,
  };

  const opusToSdpOpts = (p: AudioProfile) => {
    const o = PROFILE_OPUS[p];
    return {
      opusMaxAverageBitrate: o.maxAverageBitrate,
      opusMaxPlaybackRate: o.maxPlaybackRate,
      opusUseInbandFec: o.useInbandFec,
      opusUseDtx: o.useDtx,
      opusPtime: o.ptime,
    };
  };

  const call = (number: string) => {
    if (!uaRef.current || !config || sipStatus !== 'registered') return false;
    setActiveCallNumber(number);
    setCallState('ringing');
    const modifier = buildSdpModifier(opusToSdpOpts(audioProfileRef.current));
    try {
      uaRef.current.call(`sip:${number}@${config.domain}`, {
        mediaConstraints: HD_AUDIO_CONSTRAINTS,
        rtcOfferConstraints: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
          voiceActivityDetection: false,
        },
        sessionDescriptionHandlerModifiers: [modifier],
        // Empty iceServers + iceTransportPolicy:'none' makes WebRTC skip ICE
        // gathering so the resulting SDP looks like classic RTP/AVP — exactly
        // what FusionPBX expects (otherwise it answers 488 Not Acceptable).
        pcConfig: {
          iceServers: [],
          iceTransportPolicy: 'none',
          bundlePolicy: 'balanced',
        },
        eventHandlers: {
          failed: (e: any) => {
            const msg = classifySipFailure({
              cause: e?.cause,
              status_code: e?.message?.status_code,
              reason_phrase: e?.message?.reason_phrase,
            });
            console.error('[AVA keypad] SIP call failed', e);
            setSipError(msg);
          },
        },
      });
      return true;
    } catch (err: any) {
      console.error('[AVA keypad] SIP call exception', err);
      setCallState('idle');
      setActiveCallNumber('');
      setSipError(classifySipFailure({ cause: err?.message }));
      return false;
    }
  };
  const hangup = () => {
    sessionRef.current?.terminate();
    setCallState('idle');
    if (timerRef.current) clearInterval(timerRef.current);
    setCallTimer(0);
    setActiveCallNumber('');
  };
  const answer = () =>
    sessionRef.current?.answer({
      mediaConstraints: HD_AUDIO_CONSTRAINTS,
      sessionDescriptionHandlerModifiers: [buildSdpModifier(opusToSdpOpts(audioProfileRef.current))],
    });
  const mute = () => { sessionRef.current?.mute({ audio: true }); setIsMuted(true); };
  const unmute = () => { sessionRef.current?.unmute({ audio: true }); setIsMuted(false); };
  const hold = () => { sessionRef.current?.hold(); setIsOnHold(true); };
  const unhold = () => { sessionRef.current?.unhold(); setIsOnHold(false); };
  const sendDTMF = (key: string) =>
    sessionRef.current?.sendDTMF(key, { duration: 100, interToneGap: 70 });
  const setStatus = (status: string) => console.log('Status change:', status);
  const reconnect = useCallback(() => {
    setSipErrorState('');
    setRetryLimitReached(false);
    setSipStatus('connecting');
    if (reconnectRef.current) {
      reconnectRef.current();
    }
    setReconnectTick((t) => t + 1);
  }, [setSipStatus]);

  return {
    sipStatus, sipError, callState, callTimer, isMuted, isOnHold, activeCallNumber,
    call, hangup, answer, mute, unmute, hold, unhold, sendDTMF, setStatus, reconnect,
    lastPersistedError, sipLog, clearSipLog, clearSipState, retryAttempt, nextRetryAt, retryLimitReached,
    quality, audioProfile, setAudioProfile,
  };
}
