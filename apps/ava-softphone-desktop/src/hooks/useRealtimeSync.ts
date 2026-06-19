import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type SyncTable = 'pbx_call_records' | 'pbx_voicemails' | 'pbx_call_recordings' | 'pbx_sms_messages';
export type SyncEvent = {
  table: SyncTable;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  at: number;
  recordId?: string;
  hasRecording?: boolean;
};
export type SyncState = {
  connected: boolean;
  lastEvent: SyncEvent | null;
  lastSyncAt: number | null;
  nextRetryAt: number | null;
  attempt: number;
  countsToday: Record<SyncTable, number>;
};

const TABLES: SyncTable[] = ['pbx_call_records', 'pbx_voicemails', 'pbx_call_recordings', 'pbx_sms_messages'];
const PHONE_SYNC_TABLES = new Set<SyncTable>(['pbx_call_records', 'pbx_voicemails', 'pbx_call_recordings']);
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

/**
 * Real-time sync service. Subscribes to postgres_changes for the telephony tables
 * scoped to the tenant org with exponential-backoff reconnect, tracks lastSyncAt,
 * exposes a manual retryNow(), and dispatches lemtel:sync / lemtel:sync-status so
 * the desktop chrome (TitleBar pill, LeftRail glow) and lists can stay live.
 */
export function useRealtimeSync(orgId: string | null) {
  const [state, setState] = useState<SyncState>({
    connected: false, lastEvent: null,
    lastSyncAt: null, nextRetryAt: null, attempt: 0,
    countsToday: {
      pbx_call_records: 0, pbx_voicemails: 0,
      pbx_call_recordings: 0, pbx_sms_messages: 0,
    },
  });
  const retryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    let attempt = 0;
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
    let completionTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const emitDebouncedPhoneSync = (evt: SyncEvent) => {
      if (!PHONE_SYNC_TABLES.has(evt.table)) return;
      if (completionTimer) clearTimeout(completionTimer);
      completionTimer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('lemtel:phone-sync-complete', { detail: { source: 'realtime', event: evt } }));
        if (evt.table === 'pbx_call_records' || evt.table === 'pbx_call_recordings' || evt.hasRecording) {
          window.dispatchEvent(new CustomEvent('lemtel:recordings-updated', { detail: evt }));
        }
      }, 1200);
    };

    const broadcastStatus = (connected: boolean, nextRetryAt: number | null) => {
      window.dispatchEvent(new CustomEvent('lemtel:sync-status', {
        detail: { connected, at: Date.now(), nextRetryAt, attempt },
      }));
    };

    const scheduleReconnect = () => {
      if (cancelled || backoffTimer) return;
      try { if (channel) supabase.removeChannel(channel); } catch {}
      channel = null;
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      attempt += 1;
      const at = Date.now() + delay;
      setState((s) => ({ ...s, connected: false, nextRetryAt: at, attempt }));
      broadcastStatus(false, at);
      backoffTimer = setTimeout(() => { backoffTimer = null; connect(); }, delay);
    };

    const connect = () => {
      if (cancelled) return;
      const ch = supabase.channel(`desk-sync-${orgId}-${attempt}`);

      TABLES.forEach((table) => {
        ch.on(
          // @ts-ignore postgres_changes typing
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `organization_id=eq.${orgId}` },
          (payload: any) => {
            const row = payload.new || payload.old || {};
            const evt: SyncEvent = {
              table,
              action: payload.eventType as SyncEvent['action'],
              at: Date.now(),
              recordId: row.id || row.uuid || row.pbx_uuid,
              hasRecording: Boolean(row.has_recording || row.recording_name || row.recording_path),
            };
            setState((s) => ({
              ...s,
              lastEvent: evt,
              lastSyncAt: evt.at,
              countsToday: { ...s.countsToday, [table]: s.countsToday[table] + 1 },
            }));
            window.dispatchEvent(new CustomEvent('lemtel:sync', { detail: evt }));
            emitDebouncedPhoneSync(evt);
          }
        );
      });

      ch.subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          setState((s) => ({ ...s, connected: true, attempt: 0, nextRetryAt: null, lastSyncAt: Date.now() }));
          broadcastStatus(true, null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReconnect();
        }
      });

      channel = ch;
    };

    retryRef.current = () => {
      if (backoffTimer) { clearTimeout(backoffTimer); backoffTimer = null; }
      attempt = 0;
      setState((s) => ({ ...s, attempt: 0, nextRetryAt: null }));
      connect();
    };

    connect();

    return () => {
      cancelled = true;
      if (completionTimer) clearTimeout(completionTimer);
      if (backoffTimer) clearTimeout(backoffTimer);
      try { if (channel) supabase.removeChannel(channel); } catch {}
    };
  }, [orgId]);

  const retryNow = useCallback(() => retryRef.current?.(), []);
  return { ...state, retryNow };
}
