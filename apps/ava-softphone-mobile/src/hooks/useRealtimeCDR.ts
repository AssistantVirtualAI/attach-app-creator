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

export function useRealtimeCDR(creds: Creds | null) {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const callsRef = useRef<CallRecord[] | null>(null);
  callsRef.current = calls;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      mobileApi.calls().then((d) => { if (!cancelled) setCalls(d); }).catch(() => {});
    };
    load();

    const ext = creds?.extension;
    const token = creds?.accessToken || null;
    if (!ext || !token) {
      // No realtime — fall back to gentle polling.
      const id = setInterval(load, 30_000);
      const onVis = () => document.visibilityState === 'visible' && load();
      document.addEventListener('visibilitychange', onVis);
      return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
    }

    const sb = client(token);
    const filter = `extension=eq.${ext}`;
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
      .subscribe();

    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', load);

    return () => {
      cancelled = true;
      try { sb.removeChannel(channel); } catch {}
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', load);
    };
  }, [creds?.extension, creds?.accessToken]);

  return { calls, refresh: () => mobileApi.calls().then(setCalls).catch(() => {}) };
}
