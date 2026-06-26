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

type NativeCallSnapshot = {
  callState: CallState;
  activeCallNumber: string;
  isMuted: boolean;
  isOnHold: boolean;
};

const nativeCallSubscribers = new Set<(snapshot: NativeCallSnapshot) => void>();
let nativeCallSnapshot: NativeCallSnapshot = {
  callState: 'idle',
  activeCallNumber: '',
  isMuted: false,
  isOnHold: false,
};
let nativeCallBridgePromise: Promise<void> | null = null;

function emitNativeCallSnapshot(patch: Partial<NativeCallSnapshot>) {
  nativeCallSnapshot = { ...nativeCallSnapshot, ...patch };
  nativeCallSubscribers.forEach((subscriber) => subscriber(nativeCallSnapshot));
}

function subscribeNativeCallEvents(subscriber: (snapshot: NativeCallSnapshot) => void) {
  nativeCallSubscribers.add(subscriber);
  subscriber(nativeCallSnapshot);
  return () => { nativeCallSubscribers.delete(subscriber); };
}

function ensureNativeCallEventBridge() {
  if (nativeCallBridgePromise) return nativeCallBridgePromise;
  nativeCallBridgePromise = (async () => {
    const callReceivedHandle = await CapacitorPjsip.addListener('callReceived', (d: any) => {
      console.log('[NativeSIP] CALL_EVENT|callReceived', d);
      emitNativeCallSnapshot({
        callState: 'ringing',
        activeCallNumber: d?.from || d?.number || 'Unknown',
      });
    });
    const callStateHandle = await CapacitorPjsip.addListener('callStateChanged', (d: any) => {
      console.log(`[NativeSIP] CALL_EVENT|callStateChanged|state=${d?.state || ''}|stage=${d?.stage || ''}`, d);
      if (d?.state === 'active') {
        emitNativeCallSnapshot({ callState: 'active', activeCallNumber: d?.number || nativeCallSnapshot.activeCallNumber });
      }
      if (d?.state === 'ringing' || d?.state === 'calling') {
        emitNativeCallSnapshot({ callState: 'ringing', activeCallNumber: d?.number || nativeCallSnapshot.activeCallNumber });
      }
    });
    const callEndedHandle = await CapacitorPjsip.addListener('callEnded', (d: any) => {
      console.log('[NativeSIP] CALL_EVENT|callEnded', d);
      emitNativeCallSnapshot({ callState: 'idle', activeCallNumber: '', isMuted: false, isOnHold: false });
    });
    const muteHandle = await CapacitorPjsip.addListener('muteChanged', (d: any) => {
      emitNativeCallSnapshot({ isMuted: !!d?.muted });
    });
    const holdHandle = await CapacitorPjsip.addListener('holdChanged', (d: any) => {
      emitNativeCallSnapshot({ isOnHold: !!(d?.held ?? d?.onHold) });
    });

    // Intentionally keep these native listeners for the lifetime of the JS app.
    // React remounts/StrictMode cleanups were removing call listeners before
    // 407/180/200 INVITE events arrived, leaving the UI stuck in idle/connecting.
    (globalThis as any).__lemtelNativeCallHandles = [
      callReceivedHandle,
      callStateHandle,
      callEndedHandle,
      muteHandle,
      holdHandle,
    ];
  })();
  return nativeCallBridgePromise;
}

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
  const initInFlightRef = useRef<boolean>(false);
  const regHandleRef = useRef<{ remove(): Promise<void> } | null>(null);
  const activeInitKeyRef = useRef<string | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallTimer(0);
    timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    ensureNativeCallEventBridge().catch((e) => console.warn('[NativeSIP] call event bridge failed', e));
    return subscribeNativeCallEvents((snapshot) => {
      setActiveCallNumber(snapshot.activeCallNumber);
      setIsMuted(snapshot.isMuted);
      setIsOnHold(snapshot.isOnHold);
      setCallState(snapshot.callState);
      if (snapshot.callState === 'active') startTimer();
      if (snapshot.callState === 'idle') stopTimer();
    });
  }, []);

  // Register account on config change.
  useEffect(() => {
    if (!config) return;
    const initKey = `${config.extension}@${config.domain}|${config.password}|${config.wssUrl ?? ''}`;

    // Keep the registration listener alive across React StrictMode re-renders.
    // Only detach it when the credentials actually change.
    if (activeInitKeyRef.current === initKey && regHandleRef.current) {
      console.log('[NativeSIP] native listeners already active for %s, skip initAccount', initKey);
      return;
    }
    if (initInFlightRef.current && activeInitKeyRef.current === initKey) {
      console.log('[NativeSIP] initAccount already in flight for %s, skip duplicate', initKey);
      return;
    }
    if (activeInitKeyRef.current && activeInitKeyRef.current !== initKey && regHandleRef.current) {
      console.log('[NativeSIP] removing old registration listener for %s', activeInitKeyRef.current);
      regHandleRef.current.remove().catch(() => {});
      regHandleRef.current = null;
      emitNativeCallSnapshot({ callState: 'idle', activeCallNumber: '', isMuted: false, isOnHold: false });
    }
    activeInitKeyRef.current = initKey;
    initInFlightRef.current = true;

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
        // Direct listener on the unified `registration` event. This listener is
        // intentionally kept alive across React re-renders so it is still there
        // when the native 200 OK arrives after a StrictMode cleanup cycle.
        const regHandle = await CapacitorPjsip.addListener('registration', (d: any) => {
          if (activeInitKeyRef.current !== initKey) return;
          console.log('[NativeSIP] registration event', d);
          const s = d?.status ?? d?.state;
          if (s === 'registered') {
            if (watchdog) { clearTimeout(watchdog); watchdog = null; }
            initInFlightRef.current = false;
            console.log('[NativeSIP] registered ✓');
            setSipStatus('registered'); setSipError('');
            setNativeRegStatus('registered', null);
          } else if (s === 'error' || s === 'failed') {
            if (watchdog) { clearTimeout(watchdog); watchdog = null; }
            initInFlightRef.current = false;
            const msg = d?.reason || `Registration failed${d?.code ? ` (${d.code})` : ''}`;
            console.warn('[NativeSIP] registrationFailed', d);
            setSipStatus('error');
            setSipError(msg);
            setNativeRegStatus('error', msg);
          }
        });
        regHandleRef.current = regHandle;

        cleanups.push(await onNativeSipEvent('log', (e: any) => {
          // Bubble native logs to JS console for on-device debugging.
          console.log('[CapacitorPjsip][native]', e?.message ?? e);
        }));

        // Watchdog: if the native plugin never answers in 45s we surface a
        // clear error instead of leaving the UI on "connecting" forever.
        watchdog = setTimeout(() => {
          if (cancelled) return;
          initInFlightRef.current = false;
          console.error('[NativeSIP] watchdog timeout — no registration event in 45s');
          setSipStatus('error');
          setSipError('Native SIP timeout — plugin did not respond');
        }, 45000);

        await CapacitorPjsip.initAccount({
          extension: config.extension,
          domain: config.domain,
          password: config.password,
          wssUrl: config.wssUrl,
        });
      } catch (e: any) {
        if (cancelled) return;
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        initInFlightRef.current = false;
        console.error('[NativeSIP] initAccount threw', e);
        setSipStatus('error');
        setSipError(e?.message || 'Native SIP init failed');
      }
    })();

    return () => {
      cancelled = true;
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      cleanups.forEach((c) => { try { c(); } catch {} });
      // Registration + call listeners are intentionally kept alive across React
      // StrictMode re-renders. They are removed only on credential change/unmount.
      stopTimer();
    };
  }, [config]);

  // Remove the long-lived registration listener only when the hook truly
  // unmounts. Credential changes are handled inside the effect above.
  useEffect(() => {
    return () => {
      regHandleRef.current?.remove().catch(() => {});
      regHandleRef.current = null;
    };
  }, []);

  const call = (number: string) => {
    if (sipStatus !== 'registered') return false;
    emitNativeCallSnapshot({ callState: 'ringing', activeCallNumber: number, isMuted: false, isOnHold: false });
    CapacitorPjsip.makeCall({ number }).catch((e) => {
      emitNativeCallSnapshot({ callState: 'idle', activeCallNumber: '', isMuted: false, isOnHold: false });
      setSipError(e?.message || 'makeCall failed');
    });
    return true;
  };
  const hangup = () => {
    CapacitorPjsip.hangup().catch((e) => console.warn('[NativeSIP] hangup failed', e));
    emitNativeCallSnapshot({ callState: 'idle', activeCallNumber: '', isMuted: false, isOnHold: false });
  };
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
