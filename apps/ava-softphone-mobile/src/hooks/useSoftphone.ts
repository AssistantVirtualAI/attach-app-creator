import { useState, useEffect, useRef } from 'react';
import { createSIPUA, SIPConfig } from '../lib/sip/jssipProvider';

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

export function useSoftphone(config: SIPConfig | null): UseSoftphoneReturn {
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
    setSipStatus('connecting');

    const ua = createSIPUA(config);
    if (!ua) {
      setSipStatus('error');
      setSipError('JsSIP not available');
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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ua.stop();
    };
  }, [config?.extension, config?.wssUrl]);

  const call = (number: string) => {
    if (!uaRef.current || !config) return;
    setActiveCallNumber(number);
    setCallState('ringing');
    uaRef.current.call(`sip:${number}@${config.domain}`, {
      mediaConstraints: { audio: true, video: false },
    });
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
  const mute = () => {
    sessionRef.current?.mute({ audio: true });
    setIsMuted(true);
  };
  const unmute = () => {
    sessionRef.current?.unmute({ audio: true });
    setIsMuted(false);
  };
  const hold = () => {
    sessionRef.current?.hold();
    setIsOnHold(true);
  };
  const unhold = () => {
    sessionRef.current?.unhold();
    setIsOnHold(false);
  };
  const sendDTMF = (key: string) =>
    sessionRef.current?.sendDTMF(key, { duration: 100, interToneGap: 70 });
  const setStatus = (status: string) => console.log('Status change:', status);

  return {
    sipStatus,
    sipError,
    callState,
    callTimer,
    isMuted,
    isOnHold,
    activeCallNumber,
    call,
    hangup,
    answer,
    mute,
    unmute,
    hold,
    unhold,
    sendDTMF,
    setStatus,
  };
}
