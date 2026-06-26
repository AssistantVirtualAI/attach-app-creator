/**
 * useSoftphoneNative — Native PJSIP-backed implementation of UseSoftphoneReturn.
 *
 * Activated when VITE_NATIVE_SIP=true. Provides the same surface as the
 * JsSIP-based `useSoftphone` hook so the rest of the app is unchanged.
 * Many advanced fields (sipLog, retries, quality sampler) are stubbed for now
 * and will be enriched once the Swift/Kotlin plugin emits richer events.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SIPConfig } from '../lib/sip/jssipProvider';
import { CapacitorPjsip, onNativeSipEvent } from '../lib/sip/nativeSipProvider';
import { EMPTY_QUALITY, type CallQuality } from '../lib/sip/callQuality';
import { loadAudioProfile, saveAudioProfile, type AudioProfile } from '../lib/sip/audioProfile';
import { startNativeSipTracking, setNativeRegStatus } from '../lib/sip/nativeSipState';
import { attachNativeAutoReconnect } from '../lib/sip/nativeAutoReconnect';
import type { UseSoftphoneReturn, SIPStatus, CallState } from './useSoftphone';

export function useSoftphoneNative(config: SIPConfig | null): UseSoftphoneReturn {
  const [sipStatus, setSipStatus] = useState<SIPStatus>('idle');
  const [sipError, setSipError] = useState('');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [activeCallNumber, setActiveCallNumber] = useState('');
  const [audioProfile, setAudioProfileState] = useState<AudioProfile>(() => loadAudioProfile());
  const [quality] = useState<CallQuality>(EMPTY_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastInitKeyRef = useRef<string | null>(null);
  const initInFlightRef = useRef<boolean>(false);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallTimer(0);
    timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Register account on config change.
  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    setSipStatus('connecting');
    setSipError('');
    setNativeRegStatus('connecting');
    startNativeSipTracking();
    console.log('[NativeSIP] initAccount → ext=%s domain=%s', config.extension, config.domain);

    (async () => {
      try {
        cleanups.push(await onNativeSipEvent('registered', () => {
          if (cancelled) return;
          if (watchdog) { clearTimeout(watchdog); watchdog = null; }
          console.log('[NativeSIP] registered ✓');
          setSipStatus('registered'); setSipError('');
          setNativeRegStatus('registered', null);
        }));
        cleanups.push(await onNativeSipEvent('registrationFailed', (d) => {
          if (cancelled) return;
          if (watchdog) { clearTimeout(watchdog); watchdog = null; }
          const msg = d?.reason || `Registration failed${d?.code ? ` (${d.code})` : ''}`;
          console.warn('[NativeSIP] registrationFailed', d);
          setSipStatus('error');
          setSipError(msg);
          setNativeRegStatus('error', msg);
        }));
        cleanups.push(await onNativeSipEvent('callReceived', (d) => {
          if (cancelled) return;
          setActiveCallNumber(d?.from || 'Unknown');
          setCallState('ringing');
        }));
        cleanups.push(await onNativeSipEvent('callStateChanged', (d) => {
          if (cancelled) return;
          if (d?.state === 'active')  { setCallState('active'); startTimer(); }
          if (d?.state === 'ringing') { setCallState('ringing'); if (d?.number) setActiveCallNumber(d.number); }
        }));
        cleanups.push(await onNativeSipEvent('callEnded', () => {
          if (cancelled) return;
          setCallState('idle');
          setActiveCallNumber('');
          setIsMuted(false);
          setIsOnHold(false);
          stopTimer();
        }));
        cleanups.push(await onNativeSipEvent('log', (e: any) => {
          // Bubble native logs to JS console for on-device debugging.
          console.log('[CapacitorPjsip][native]', e?.message ?? e);
        }));

        // Watchdog: if the native plugin never answers in 15s we surface a
        // clear error instead of leaving the UI on "connecting" forever
        // (typical when the JS plugin name didn't match the native one).
        watchdog = setTimeout(() => {
          if (cancelled) return;
          console.error('[NativeSIP] watchdog timeout — no registration event in 15s');
          setSipStatus('error');
          setSipError('Native SIP timeout — plugin did not respond');
        }, 15000);

        await CapacitorPjsip.initAccount({
          extension: config.extension,
          domain: config.domain,
          password: config.password,
          wssUrl: config.wssUrl,
        });
      } catch (e: any) {
        if (cancelled) return;
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        console.error('[NativeSIP] initAccount threw', e);
        setSipStatus('error');
        setSipError(e?.message || 'Native SIP init failed');
      }
    })();

    return () => {
      cancelled = true;
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      cleanups.forEach((c) => { try { c(); } catch {} });
      CapacitorPjsip.removeAllListeners().catch(() => {});
      stopTimer();
    };
  }, [config]);

  const call = (number: string) => {
    if (sipStatus !== 'registered') return false;
    setActiveCallNumber(number);
    setCallState('ringing');
    CapacitorPjsip.makeCall({ number }).catch((e) => {
      setCallState('idle');
      setSipError(e?.message || 'makeCall failed');
    });
    return true;
  };
  const hangup = () => { CapacitorPjsip.hangup().catch(() => {}); };
  const answer = () => { CapacitorPjsip.answer().catch(() => {}); };
  const mute   = () => { CapacitorPjsip.setMute({ muted: true }).catch(() => {});  setIsMuted(true); };
  const unmute = () => { CapacitorPjsip.setMute({ muted: false }).catch(() => {}); setIsMuted(false); };
  const hold   = () => { CapacitorPjsip.setHold({ onHold: true }).catch(() => {});  setIsOnHold(true); };
  const unhold = () => { CapacitorPjsip.setHold({ onHold: false }).catch(() => {}); setIsOnHold(false); };
  const sendDTMF = (key: string) => { CapacitorPjsip.sendDTMF({ digit: key }).catch(() => {}); };

  const setAudioProfile = useCallback((p: AudioProfile) => {
    setAudioProfileState(p);
    saveAudioProfile(p);
  }, []);
  const reconnect = useCallback(() => {
    setSipError('');
    setSipStatus('connecting');
    setNativeRegStatus('connecting');
    if (config) {
      CapacitorPjsip.initAccount({
        extension: config.extension,
        domain: config.domain,
        password: config.password,
        wssUrl: config.wssUrl,
      }).catch((e) => {
        const msg = e?.message || 'reconnect failed';
        setSipStatus('error'); setSipError(msg); setNativeRegStatus('error', msg);
      });
    }
  }, [config]);

  // Auto-reconnect when the app returns to foreground or the network recovers.
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    attachNativeAutoReconnect(() => {
      if (sipStatus !== 'registered') reconnect();
    }).then((c) => { cleanup = c; });
    return () => { if (cleanup) cleanup(); };
  }, [reconnect, sipStatus]);

  return {
    sipStatus, sipError, callState, callTimer, isMuted, isOnHold, activeCallNumber,
    call, hangup, answer, mute, unmute, hold, unhold, sendDTMF,
    setStatus: () => {},
    reconnect,
    lastPersistedError: null,
    sipLog: [],
    clearSipLog: () => {},
    clearSipState: () => {},
    retryAttempt: 0,
    nextRetryAt: null,
    retryLimitReached: false,
    quality,
    audioProfile,
    setAudioProfile,
    offeredCodecs: [],
    negotiatedCodec: null,
  };
}
