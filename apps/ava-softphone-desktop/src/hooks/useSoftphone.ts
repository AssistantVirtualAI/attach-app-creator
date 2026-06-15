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
  display_name?: string;
  displayName?: string;
  sip_domain?: string;
  sipDomain?: string;
  wss_url?: string;
  wssUrl?: string;
  password?: string;
  sip_password?: string;
}

class SoftphoneCredentialError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'SoftphoneCredentialError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function credentialErrorMessage(err: SoftphoneCredentialError): string {
  if (err.status === 401) return 'Session expired — please sign in again.';
  if (err.status === 404 || err.code === 'NO_SOFTPHONE_ACCOUNT') {
    return 'No softphone account is configured for this login. Contact your administrator to assign an extension.';
  }
  if (err.status === 424 || err.code === 'NO_SIP_PASSWORD') {
    return 'Your extension is missing its SIP password. Contact your administrator to resync the PBX credentials.';
  }
  return err.message || `Failed to load SIP credentials (${err.status || 'network'}).`;
}

async function fetchSoftphoneCredentials(accessToken: string): Promise<FetchedCreds> {
  let payload: any = null;
  let rawText = '';
  let res: Response;

  try {
    res = await fetch(`${SB_URL}/functions/v1/softphone-credentials`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SB_KEY,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch (err: any) {
    throw new SoftphoneCredentialError(0, 'NETWORK_ERROR', `Cannot reach credential service: ${err?.message || err}`);
  }

  rawText = await res.text().catch(() => '');
  if (rawText) {
    try { payload = JSON.parse(rawText); } catch { payload = null; }
  }

  if (!res.ok || payload?.error) {
    const code = String(payload?.error || payload?.code || `HTTP_${res.status}`);
    const message = String(payload?.message || payload?.error_description || rawText || `softphone-credentials ${res.status}`);
    throw new SoftphoneCredentialError(res.status, code, message, payload || rawText);
  }

  return payload as FetchedCreds;
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
        let fetched: FetchedCreds;
        try {
          fetched = await fetchSoftphoneCredentials(token);
        } catch (err: any) {
          if (err instanceof SoftphoneCredentialError && err.status === 401 && args.refreshToken) {
            const refreshed = await supabase.auth.refreshSession({ refresh_token: args.refreshToken }).catch(() => null);
            const freshToken = refreshed?.data?.session?.access_token;
            if (freshToken) {
              fetched = await fetchSoftphoneCredentials(freshToken);
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
        if (cancelled) return;
        const sipPassword = fetched.password || fetched.sip_password || '';
        if (!sipPassword) {
          setCredError('Your extension is missing its SIP password. Contact your administrator to resync the PBX credentials.');
          return;
        }
        const cfg: SoftphoneConfig = {
          extension: fetched.extension || args.extension,
          displayName: fetched.display_name || fetched.displayName || args.displayName || args.extension,
          sipDomain: fetched.sip_domain || fetched.sipDomain || args.sipDomain || 'lemtel.lemtel.tel',
          wssUrl: fetched.wss_url || fetched.wssUrl || args.wssUrl || 'wss://lemtel.lemtel.tel:7443',
          password: sipPassword,
        };
        setConfig(cfg);
        await sipProvider.init(cfg);
      } catch (e: any) {
        setCredError(e instanceof SoftphoneCredentialError ? credentialErrorMessage(e) : String(e?.message || e));
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
    setInputDevice: useCallback((id: string | null) => { sipProvider.inputDeviceId = id; }, []),
    testAudioDevices: useCallback(() => sipProvider.testAudioDevices(), []),
    downloadDebugReport: useCallback(() => sipProvider.downloadDebugReport(), []),
    getBoundDevices: useCallback(() => ({
      input: sipProvider.boundInputLabel,
      output: sipProvider.boundOutputLabel,
    }), []),
    manualStatus,
    setManualStatus,
    recording,
    toggleRecording: useCallback(() => {
      sipProvider.sendDTMF('*2');
      setRecording((r) => !r);
    }, []),
    restart: useCallback(async () => {
      setCredError(null);
      await sipProvider.restart();
      setRetryTick((n) => n + 1);
    }, []),
  };
}
