/**
 * Real-time CDR subscription for the mobile softphone.
 * - Realtime postgres_changes on pbx_call_records (filtered to extension).
 * - Snapshot via mobileApi.calls() on mount, focus, visibility, retry.
 * - Exponential backoff reconnect (1s → 2s → 4s → 8s → 15s cap) on channel error.
 * - Exposes lastSyncAt + nextRetryAt for the UI sync pill and a manual retryNow().
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
    extension: r.extension ?? undefined,
    customer: r.caller_name ?? undefined,
    startedAt: r.start_at ?? new Date().toISOString(),
    durationSec: billsec,
    hasRecording: !!(r.has_recording || r.recording_path || r.recording_name),
    hasTranscript: false,
    sentiment: undefined,
  };
}

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

export type CDRTransport = 'realtime' | 'polling' | 'idle';
export type SyncLogEntry = {
  id: string;
  at: number;
  status: 'success' | 'failed' | 'retrying' | 'info';
  reason: string;
  attempt?: number;
  source: 'realtime' | 'polling' | 'manual' | 'snapshot';
};

export function useRealtimeCDR(creds: Creds | null) {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [transport, setTransport] = useState<CDRTransport>('idle');
  const [warning, setWarning] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const retryTickRef = useRef<(() => void) | null>(null);

  const pushLog = useCallback((entry: Omit<SyncLogEntry, 'id' | 'at'> & { at?: number }) => {
    setSyncLog((cur) => [{ id: `${Date.now()}-${Math.random()}`, at: entry.at ?? Date.now(), ...entry }, ...cur].slice(0, 30));
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await mobileApi.calls();
      setCalls(d);
      setLastSyncAt(Date.now());
      pushLog({ status: 'success', source: 'snapshot', reason: `Snapshot loaded (${Array.isArray(d) ? d.length : 0} CDRs)` });
    } catch (e: any) {
      const reason = e?.message || 'Snapshot load failed';
      setWarning(reason);
      pushLog({ status: 'failed', source: 'snapshot', reason });
    }
  }, [pushLog]);

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let channel: ReturnType<SupabaseClient['channel']> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let removingChannel = false;

    const startPolling = (reason?: string) => {
      if (pollId) return;
      setTransport('polling');
      if (reason) setWarning(reason);
      pushLog({ status: reason ? 'retrying' : 'info', source: 'polling', reason: reason || 'Polling fallback started' });
      pollId = setInterval(load, 15_000);
    };
    const stopPolling = () => { if (pollId) { clearInterval(pollId); pollId = null; } };

    const connect = () => {
      if (cancelled) return;
      const ext = creds?.extension;
      const orgId = creds?.organizationId;
      const token = creds?.accessToken || null;
      if (!token || (!ext && !orgId)) { startPolling('Missing credentials for realtime — polling.'); return; }

      const sb = client(token);
      // Prefer extension scope; fall back to organization scope when the user
      // signed in via email and has no extension bound (e.g. org admins).
      const filter = ext ? `extension=eq.${ext}` : `organization_id=eq.${orgId}`;
      const chanKey = ext ? `cdr-ext-${ext}` : `cdr-org-${orgId}`;
      watchdog = setTimeout(() => {
        startPolling('Realtime unavailable — polling every 15s.');
      }, 8_000);

      channel = sb
        .channel(`${chanKey}-${attempt}`)

        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pbx_call_records', filter }, (payload) => {
          const row = mapRow(payload.new);
          setCalls((prev) => {
            const list = prev || [];
            if (list.some((c) => c.id === row.id)) return list;
            return [row, ...list].slice(0, 200);
          });
          setLastSyncAt(Date.now());
          pushLog({ status: 'success', source: 'realtime', reason: `INSERT ${row.id.slice(0, 8)}…` });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pbx_call_records', filter }, (payload) => {
          const row = mapRow(payload.new);
          setCalls((prev) => (prev || []).map((c) => (c.id === row.id ? { ...c, ...row } : c)));
          setLastSyncAt(Date.now());
          pushLog({ status: 'success', source: 'realtime', reason: `UPDATE ${row.id.slice(0, 8)}…` });
        })
        .subscribe((status) => {
          if (cancelled) return;
          if (status === 'SUBSCRIBED') {
            if (watchdog) { clearTimeout(watchdog); watchdog = null; }
            stopPolling();
            attempt = 0;
            setTransport('realtime');
            setWarning(null);
            setNextRetryAt(null);
            pushLog({ status: 'success', source: 'realtime', reason: 'Realtime CDR stream connected' });
            load();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            scheduleReconnect();
          }
        });
    };

    const scheduleReconnect = () => {
      if (cancelled || backoffTimer || removingChannel) return;
      const oldChannel = channel;
      channel = null;
      if (oldChannel) {
        removingChannel = true;
        Promise.resolve(client().removeChannel(oldChannel)).finally(() => { removingChannel = false; });
      }
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      attempt += 1;
      const at = Date.now() + delay;
      setNextRetryAt(at);
      startPolling(`Realtime dropped — retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}).`);
      pushLog({ status: 'retrying', source: 'realtime', reason: `Realtime reconnect scheduled in ${Math.round(delay / 1000)}s`, attempt });
      backoffTimer = setTimeout(() => { backoffTimer = null; connect(); }, delay);
    };

    retryTickRef.current = () => {
      if (backoffTimer) { clearTimeout(backoffTimer); backoffTimer = null; }
      attempt = 0;
      setNextRetryAt(null);
      pushLog({ status: 'info', source: 'manual', reason: 'Manual CDR retry — triggering PBX sync' });
      // Force a backend CDR sync, then reload the snapshot so brand-new calls show up.
      (async () => {
        try {
          const token = creds?.accessToken || null;
          if (token) {
            await fetch(`${SUPABASE_URL}/functions/v1/cron-pbx-sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON_KEY },
              body: JSON.stringify({}),
            }).catch(() => {});
          }
        } catch {}
        load();
        connect();
      })();
    };

    load();
    connect();

    const onVis = () => { if (document.visibilityState === 'visible') { load(); if (transport !== 'realtime') retryTickRef.current?.(); } };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', load);

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      if (backoffTimer) clearTimeout(backoffTimer);
      stopPolling();
      try { if (channel) client().removeChannel(channel); } catch {}
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds?.extension, creds?.accessToken, creds?.organizationId]);

  return {
    calls,
    transport,
    warning,
    lastSyncAt,
    nextRetryAt,
    syncLog,
    dismissWarning: () => setWarning(null),
    refresh: load,
    retryNow: () => retryTickRef.current?.(),
  };
}
