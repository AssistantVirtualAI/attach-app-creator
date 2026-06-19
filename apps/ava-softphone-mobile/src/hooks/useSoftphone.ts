import { useState, useEffect, useRef } from 'react';
import { createSIPUA, JsSIPUnavailableError, SIPConfig } from '../lib/sip/jssipProvider';

export type SIPStatus = 'idle' | 'connecting' | 'registered' | 'error';
export type CallState = 'idle' | 'ringing' | 'active' | 'ended';

export interface UseSoftphoneReturn {
  sipStatus: SIPStatus;
  sipError: string;
  callState: CallState;
  callTimer: number;
  isMuted: boolean;
  isOnHold: boolean;
  activeCallNumber: string;
  call: (number: string) => void;
  hangup: () => void;
  answer: () => void;
  mute: () => void;
  unmute: () => void;
  hold: () => void;
  unhold: () => void;
  sendDTMF: (key: string) => void;
  setStatus: (status: string) => void;
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

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    setSipStatus('connecting');
    setSipError('');

    createSIPUA(config, opts.jsSipTimeoutMs ?? 8000)
      .then((ua) => {
        if (cancelled) {
          try { ua.stop(); } catch {}
          return;
        }
        ua.on('registered', () => {
          setSipStatus('registered');
          setSipError('');
        });
        ua.on('registrationFailed', (e: any) => {
          setSipStatus('error');
          setSipError(e?.cause || 'Registration failed');
        });
        ua.on('disconnected', () => setSipStatus('connecting'));
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
          session.on('failed', () => {
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
            : err?.message || 'SIP initialization failed',
        );
      });

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      try { uaRef.current?.stop(); } catch {}
      uaRef.current = null;
    };
  }, [config?.extension, config?.wssUrl, config?.domain, opts.jsSipTimeoutMs]);

  const call = (number: string) => {
    if (!uaRef.current || !config || sipStatus !== 'registered') return;
    setActiveCallNumber(number);
    setCallState('ringing');
    try {
      uaRef.current.call(`sip:${number}@${config.domain}`, {
        mediaConstraints: { audio: true, video: false },
      });
    } catch (err: any) {
      setCallState('idle');
      setActiveCallNumber('');
      setSipError(err?.message || 'Call failed');
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
    sessionRef.current?.answer({ mediaConstraints: { audio: true, video: false } });
  const mute = () => { sessionRef.current?.mute({ audio: true }); setIsMuted(true); };
  const unmute = () => { sessionRef.current?.unmute({ audio: true }); setIsMuted(false); };
  const hold = () => { sessionRef.current?.hold(); setIsOnHold(true); };
  const unhold = () => { sessionRef.current?.unhold(); setIsOnHold(false); };
  const sendDTMF = (key: string) =>
    sessionRef.current?.sendDTMF(key, { duration: 100, interToneGap: 70 });
  const setStatus = (status: string) => console.log('Status change:', status);

  return {
    sipStatus, sipError, callState, callTimer, isMuted, isOnHold, activeCallNumber,
    call, hangup, answer, mute, unmute, hold, unhold, sendDTMF, setStatus,
  };
}
