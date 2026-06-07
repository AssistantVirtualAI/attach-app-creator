import { useEffect, useState, useCallback } from 'react';
import { sipProvider, SoftphoneSnapshot, SoftphoneConfig } from '@/lib/sip/jssipProvider';
import { ringtone } from '@/lib/sip/ringtonePlayer';
import { supabase, SB_URL, SB_KEY } from '@/lib/supabaseClient';

interface UseSoftphoneArgs {
  extension: string;
  displayName?: string;
  sipDomain?: string;
  wssUrl?: string;
  accessToken?: string;
  refreshToken?: string;
}

interface FetchedCreds {
  extension: string;
  display_name: string;
  sip_domain: string;
  wss_url: string;
  password: string;
}

async function fetchSoftphoneCredentials(accessToken: string): Promise<FetchedCreds | null> {
  try {
    const res = await fetch(`${SB_URL}/functions/v1/softphone-credentials`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SB_KEY,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data as FetchedCreds;
  } catch {
    return null;
  }
}

export type ManualStatus = 'auto' | 'available' | 'dnd' | 'away';

export function useSoftphone(args: UseSoftphoneArgs) {
  const [snap, setSnap] = useState<SoftphoneSnapshot>(() => sipProvider.getSnapshot());
  const [config, setConfig] = useState<SoftphoneConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [credError, setCredError] = useState<string | null>(null);
  const [manualStatus, setManualStatus] = useState<ManualStatus>('auto');
  const [retryTick, setRetryTick] = useState(0);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const unsub = sipProvider.subscribe(setSnap);
    return () => { unsub(); };
  }, []);

  // Restore Supabase session from stored tokens, then fetch SIP password.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCredError(null);
      try {
        if (args.accessToken) {
          await supabase.auth.setSession({
            access_token: args.accessToken,
            refresh_token: args.refreshToken || '',
          }).catch(() => { /* noop */ });
        }
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token || args.accessToken;
        if (!token) {
          setCredError('No session token. Re-sign-in.');
          return;
        }
        const fetched = await fetchSoftphoneCredentials(token);
        if (cancelled) return;
        if (!fetched || !fetched.password) {
          setCredError(fetched ? 'No SIP password on file. Contact your admin.' : 'Failed to load SIP credentials.');
          return;
        }
        const cfg: SoftphoneConfig = {
          extension: fetched.extension || args.extension,
          displayName: fetched.display_name || args.displayName || args.extension,
          sipDomain: fetched.sip_domain || args.sipDomain || 'lemtel.lemtel.tel',
          wssUrl: fetched.wss_url || args.wssUrl || 'wss://lemtel.lemtel.tel:7443',
          password: fetched.password,
        };
        setConfig(cfg);
        await sipProvider.init(cfg);
      } catch (e: any) {
        setCredError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [args.accessToken, args.refreshToken, args.extension, retryTick]);

  // Ringtone + system notification on incoming.
  useEffect(() => {
    if (snap.callState === 'ringing-in') {
      ringtone.start();
      window.electronAPI?.showNotification?.(
        'Incoming call — Lemtel',
        snap.remoteIdentity || snap.remoteNumber || 'Unknown',
      );
    } else {
      ringtone.stop();
    }
  }, [snap.callState, snap.remoteIdentity, snap.remoteNumber]);

  // Tray status reflects SIP state (or manual override)
  useEffect(() => {
    const autoState =
      snap.callState === 'active' || snap.callState === 'held' ? 'oncall' :
      snap.status === 'registered' ? 'available' : 'offline';
    const trayState = manualStatus === 'auto' ? autoState : manualStatus;
    window.electronAPI?.updateTrayStatus?.(trayState);

    (async () => {
      try {
        await supabase
          .from('pbx_softphone_users')
          .update({ status: trayState, last_seen_at: new Date().toISOString() })
          .eq('extension', args.extension);
      } catch { /* noop */ }
    })();
  }, [snap.status, snap.callState, args.extension, manualStatus]);

  useEffect(() => {
    if (snap.callState !== 'active' && snap.callState !== 'held') setRecording(false);
  }, [snap.callState]);

  return {
    snap,
    config,
    loading,
    credError,
    call: useCallback((n: string) => sipProvider.call(n), []),
    answer: useCallback(() => sipProvider.answer(), []),
    hangup: useCallback(() => sipProvider.hangup(), []),
    mute: useCallback(() => sipProvider.mute(), []),
    unmute: useCallback(() => sipProvider.unmute(), []),
    hold: useCallback(() => sipProvider.hold(), []),
    unhold: useCallback(() => sipProvider.unhold(), []),
    sendDTMF: useCallback((k: string) => sipProvider.sendDTMF(k), []),
    blindTransfer: useCallback((t: string) => sipProvider.blindTransfer(t), []),
    startAttendedConsult: useCallback((t: string) => sipProvider.startAttendedConsult(t), []),
    completeAttendedTransfer: useCallback(() => sipProvider.completeAttendedTransfer(), []),
    cancelAttendedConsult: useCallback(() => sipProvider.cancelAttendedConsult(), []),
    hasConsult: useCallback(() => sipProvider.hasConsult(), []),
    setAudioEl: useCallback((el: HTMLAudioElement | null) => { sipProvider.audioEl = el; }, []),
    setOutputDevice: useCallback((id: string | null) => { sipProvider.outputDeviceId = id; }, []),
    manualStatus,
    setManualStatus,
    recording,
    toggleRecording: useCallback(() => {
      sipProvider.sendDTMF('*2');
      setRecording((r) => !r);
    }, []),
  };
}
