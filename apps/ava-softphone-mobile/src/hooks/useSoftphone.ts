import { useState, useEffect, useRef, useCallback } from 'react';
import { createSIPUA, JsSIPUnavailableError, SIPConfig, sdpModifier, classifySipFailure, hasWebRTC, WEBRTC_UNAVAILABLE_MESSAGE } from '../lib/sip/jssipProvider';

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
}

export function useSoftphone(
  config: SIPConfig | null,
  opts: { jsSipTimeoutMs?: number } = {},
): UseSoftphoneReturn {
  const [sipStatus, setSipStatus] = useState<SIPStatus>('idle');
  const [sipError, setSipError] = useState('');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [activeCallNumber, setActiveCallNumber] = useState('');

  const uaRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authBlockedRef = useRef(false);
  const retryAttemptRef = useRef(0);
  const reconnectRef = useRef<() => void>(() => {});
  const [reconnectTick, setReconnectTick] = useState(0);

  // WebRTC capability check on mount — surfaces clear error immediately so
  // UI doesn't sit on "connecting…" for ever.
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasWebRTC()) {
      setSipStatus('error');
      setSipError(WEBRTC_UNAVAILABLE_MESSAGE);
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    if (typeof window !== 'undefined' && !hasWebRTC()) return;
    let cancelled = false;

    const RETRY_DELAYS_MS = [5000, 15000];
    const clearRetry = () => {
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    };
    authBlockedRef.current = false;

    const start = () => {
      if (cancelled) return;
      setSipStatus('connecting');
      setSipError('');

      createSIPUA(config, opts.jsSipTimeoutMs ?? 8000)
        .then((ua) => {
          if (cancelled) { try { ua.stop(); } catch {} return; }
          ua.on('registered', () => {
            retryAttemptRef.current = 0;
            clearRetry();
            setSipStatus('registered');
            setSipError('');
          });
          ua.on('registrationFailed', (e: any) => {
            const msg = classifySipFailure({
              cause: e?.cause,
              status_code: e?.response?.status_code,
              reason_phrase: e?.response?.reason_phrase,
            });
            setSipStatus('error');
            setSipError(msg);
            const code = e?.response?.status_code;
            if (code === 401 || code === 403 || code === 407) {
              authBlockedRef.current = true;
              return;
            }
            scheduleRetry();
          });
          ua.on('disconnected', (e: any) => {
            setSipStatus('connecting');
            if (e?.error) {
              setSipError(classifySipFailure({ cause: e?.reason || 'WSS connection failed' }));
              scheduleRetry();
            }
          });
          ua.on('newRTCSession', (data: any) => {
            const session = data.session;
            sessionRef.current = session;
            const remoteNumber = session.remote_identity?.uri?.user || 'Unknown';
            setActiveCallNumber(remoteNumber);
            if (session.direction === 'incoming') setCallState('ringing');
            session.on('confirmed', () => {
              setCallState('active');
              timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
            });
            session.on('ended', () => {
              setCallState('ended');
              if (timerRef.current) clearInterval(timerRef.current);
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
              setSipError(msg);
              setCallState('idle');
              if (timerRef.current) clearInterval(timerRef.current);
              setActiveCallNumber('');
            });
          });
          ua.start();
          uaRef.current = ua;
        })
        .catch((err) => {
          if (cancelled) return;
          setSipStatus('error');
          setSipError(
            err instanceof JsSIPUnavailableError
              ? 'Phone library failed to load. Check your internet connection and try again.'
              : classifySipFailure({ cause: err?.message }),
          );
          scheduleRetry();
        });
    };

    const scheduleRetry = () => {
      if (cancelled) return;
      if (authBlockedRef.current) return;
      const attempt = retryAttemptRef.current;
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      retryAttemptRef.current = attempt + 1;
      clearRetry();
      // Surface the back-off visibly so the UI can render "Retrying…"
      // for the entire 5 s / 15 s window instead of frozen on "error".
      setSipStatus('retrying');
      retryTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        console.log(`[AVA SIP] Retrying registration (attempt ${attempt + 1})…`);
        try { uaRef.current?.stop(); } catch {}
        uaRef.current = null;
        start();
      }, delay);
    };

    reconnectRef.current = () => {
      if (cancelled) return;
      clearRetry();
      retryAttemptRef.current = 0;
      try { uaRef.current?.stop(); } catch {}
      uaRef.current = null;
      start();
    };

    start();

    return () => {
      cancelled = true;
      clearRetry();
      retryAttemptRef.current = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      try { uaRef.current?.stop(); } catch {}
      uaRef.current = null;
      reconnectRef.current = () => {};
    };
  }, [config?.extension, config?.wssUrl, config?.domain, config?.password, opts.jsSipTimeoutMs, reconnectTick]);

  const call = (number: string) => {
    if (!uaRef.current || !config || sipStatus !== 'registered') return false;
    setActiveCallNumber(number);
    setCallState('ringing');
    try {
      uaRef.current.call(`sip:${number}@${config.domain}`, {
        mediaConstraints: { audio: true, video: false },
        // Force PCMU/PCMA + strip DTLS so FusionPBX accepts the offer.
        sessionDescriptionHandlerModifiers: [sdpModifier],
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
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
      mediaConstraints: { audio: true, video: false },
      sessionDescriptionHandlerModifiers: [sdpModifier],
    });
  const mute = () => { sessionRef.current?.mute({ audio: true }); setIsMuted(true); };
  const unmute = () => { sessionRef.current?.unmute({ audio: true }); setIsMuted(false); };
  const hold = () => { sessionRef.current?.hold(); setIsOnHold(true); };
  const unhold = () => { sessionRef.current?.unhold(); setIsOnHold(false); };
  const sendDTMF = (key: string) =>
    sessionRef.current?.sendDTMF(key, { duration: 100, interToneGap: 70 });
  const setStatus = (status: string) => console.log('Status change:', status);
  const reconnect = useCallback(() => {
    setSipError('');
    setSipStatus('connecting');
    if (reconnectRef.current) {
      reconnectRef.current();
    }
    // Always bump the tick so a fresh effect runs if the previous one
    // was cancelled (e.g. WebRTC missing on first mount, then enabled).
    setReconnectTick((t) => t + 1);
  }, []);

  return {
    sipStatus, sipError, callState, callTimer, isMuted, isOnHold, activeCallNumber,
    call, hangup, answer, mute, unmute, hold, unhold, sendDTMF, setStatus, reconnect,
  };
}
