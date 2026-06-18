/**
 * Real-time CDR subscription for the mobile softphone.
 * Uses Supabase Realtime (postgres_changes) on pbx_call_records,
 * filtered to the user's extension. Falls back to the polling API for
 * the initial snapshot and on visibility regain.
 */
import { useEffect, useRef, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mobileApi, CallRecord } from '../lib/mobileApi';
import type { Creds } from '../lib/creds';

const SUPABASE_URL = 'https://gejxisrqtvxavbrfcoxz.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';

let _client: SupabaseClient | null = null;
function client(token?: string | null): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  if (token) _client.realtime.setAuth(token);
  return _client;
}

function mapRow(r: any): CallRecord {
  const billsec = Number(r.billsec ?? r.duration_seconds ?? 0);
  const missed = r.missed_call || r.hangup_cause === 'NO_ANSWER' || billsec === 0;
  return {
    id: r.id ?? String(Math.random()),
    direction: r.direction === 'outbound' ? 'out' : 'in',
    status: (r.voicemail_message ? 'voicemail' : missed ? 'missed' : 'answered') as any,
    from: r.caller_number ?? '',
    to: r.destination_number ?? '',
    customer: r.caller_name ?? undefined,
    startedAt: r.start_at ?? new Date().toISOString(),
    durationSec: billsec,
    hasRecording: !!(r.has_recording || r.recording_path || r.recording_name),
    hasTranscript: false,
    sentiment: undefined,
  };
}

export type CDRTransport = 'realtime' | 'polling' | 'idle';

export function useRealtimeCDR(creds: Creds | null) {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [transport, setTransport] = useState<CDRTransport>('idle');
  const [warning, setWarning] = useState<string | null>(null);
  const callsRef = useRef<CallRecord[] | null>(null);
  callsRef.current = calls;

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const load = () => {
      mobileApi.calls().then((d) => { if (!cancelled) setCalls(d); }).catch(() => {});
    };
    load();

    const startPolling = (reason?: string) => {
      if (pollId) return;
      setTransport('polling');
      if (reason) setWarning(reason);
      pollId = setInterval(load, 15_000); // resilient fallback: 15s polling
    };
    const stopPolling = () => {
      if (pollId) { clearInterval(pollId); pollId = null; }
    };

    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', load);

    const ext = creds?.extension;
    const token = creds?.accessToken || null;
    if (!ext || !token) {
      startPolling();
      return () => {
        cancelled = true; stopPolling();
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', load);
      };
    }

    const sb = client(token);
    const filter = `extension=eq.${ext}`;
    let watchdog: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      // If we haven't reached SUBSCRIBED in 8s, fall back.
      startPolling('Realtime CDR unavailable — switched to 15s polling.');
    }, 8_000);

    const channel = sb
      .channel(`cdr-ext-${ext}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pbx_call_records', filter }, (payload) => {
        const row = mapRow(payload.new);
        setCalls((prev) => {
          const list = prev || [];
          if (list.some((c) => c.id === row.id)) return list;
          return [row, ...list].slice(0, 200);
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pbx_call_records', filter }, (payload) => {
        const row = mapRow(payload.new);
        setCalls((prev) => (prev || []).map((c) => (c.id === row.id ? { ...c, ...row } : c)));
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          if (watchdog) { clearTimeout(watchdog); watchdog = null; }
          stopPolling();
          setTransport('realtime');
          setWarning(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startPolling('Realtime CDR disconnected — using 15s polling.');
        }
      });

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      stopPolling();
      try { sb.removeChannel(channel); } catch {}
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', load);
    };
  }, [creds?.extension, creds?.accessToken]);

  return {
    calls,
    transport,
    warning,
    dismissWarning: () => setWarning(null),
    refresh: () => mobileApi.calls().then(setCalls).catch(() => {}),
  };
}
