/**
 * useSoftphoneNative — native SIP/TLS-backed implementation of UseSoftphoneReturn.
 *
 * Activated when VITE_NATIVE_SIP=true. Uses the `CapacitorSip` plugin which
 * speaks raw SIP over TLS:5061 via Apple's Network.framework (no WebRTC).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SIPConfig } from '../lib/sip/jssipProvider';
import { CapacitorSipNative, onNativeSipEvent } from '../lib/sip/nativeSipProvider';
import { EMPTY_QUALITY, type CallQuality } from '../lib/sip/callQuality';
import { loadAudioProfile, saveAudioProfile, type AudioProfile } from '../lib/sip/audioProfile';
import type { UseSoftphoneReturn, SIPStatus, CallState } from './useSoftphone';

const SIP_HOST = 'pbxnode.lemtel.tel';

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
    if (!config) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    setSipStatus('connecting');
    setSipError('');

    (async () => {
      try {
        cleanups.push(await onNativeSipEvent('registration', (d) => {
          if (cancelled) return;
          if (d?.status === 'registered') { setSipStatus('registered'); setSipError(''); }
          else if (d?.status === 'error') { setSipStatus('error'); setSipError(d?.reason || 'Registration failed'); }
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

        await CapacitorSipNative.initAccount({
          host: SIP_HOST,
          extension: config.extension,
          domain: config.domain,
          password: config.password,
        });
      } catch (e: any) {
        if (!cancelled) {
          setSipStatus('error');
          setSipError(e?.message || 'Native SIP init failed');
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((c) => { try { c(); } catch {} });
      CapacitorSipNative.removeAllListeners().catch(() => {});
      stopTimer();
    };
  }, [config]);

  const call = (number: string) => {
    if (sipStatus !== 'registered') return false;
    setActiveCallNumber(number);
    setCallState('ringing');
    CapacitorSipNative.makeCall({ number }).catch((e) => {
      setCallState('idle');
      setSipError(e?.message || 'makeCall failed');
    });
    return true;
  };
  const hangup = () => { CapacitorSipNative.hangup().catch(() => {}); };
  const answer = () => { CapacitorSipNative.answer().catch(() => {}); };
  const mute   = () => { CapacitorSipNative.setMute({ muted: true }).catch(() => {});  setIsMuted(true); };
  const unmute = () => { CapacitorSipNative.setMute({ muted: false }).catch(() => {}); setIsMuted(false); };
  const hold   = () => { CapacitorSipNative.setHold({ held: true }).catch(() => {});  setIsOnHold(true); };
  const unhold = () => { CapacitorSipNative.setHold({ held: false }).catch(() => {}); setIsOnHold(false); };
  const sendDTMF = (key: string) => { CapacitorSipNative.sendDTMF({ digits: key }).catch(() => {}); };

  const setAudioProfile = useCallback((p: AudioProfile) => {
    setAudioProfileState(p);
    saveAudioProfile(p);
  }, []);
  const reconnect = useCallback(() => {
    setSipError('');
    setSipStatus('connecting');
    if (config) {
      CapacitorSipNative.initAccount({
        host: SIP_HOST,
        extension: config.extension,
        domain: config.domain,
        password: config.password,
      }).catch((e) => { setSipStatus('error'); setSipError(e?.message || 'reconnect failed'); });
    }
  }, [config]);

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
