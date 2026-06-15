import { useEffect, useRef, useState } from 'react';
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
  countsToday: Record<SyncTable, number>;
};

const TABLES: SyncTable[] = ['pbx_call_records', 'pbx_voicemails', 'pbx_call_recordings', 'pbx_sms_messages'];
const PHONE_SYNC_TABLES = new Set<SyncTable>(['pbx_call_records', 'pbx_voicemails', 'pbx_call_recordings']);

/**
 * Real-time sync service. Subscribes to postgres_changes for the telephony tables
 * scoped to the tenant org, broadcasts a window event so the whole desktop can react
 * (LeftRail glow, TitleBar sync pill, lists invalidate caches, etc.). Call and
 * recording updates also emit a debounced phone-sync-complete event so the legacy
 * call, voicemail, and recording panels stay live without aggressive polling.
 */
export function useRealtimeSync(orgId: string | null) {
  const [state, setState] = useState<SyncState>({
    connected: false,
    lastEvent: null,
    countsToday: {
      pbx_call_records: 0, pbx_voicemails: 0,
      pbx_call_recordings: 0, pbx_sms_messages: 0,
    },
  });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase.channel(`desk-sync-${orgId}`);

    const emitDebouncedPhoneSync = (evt: SyncEvent) => {
      if (!PHONE_SYNC_TABLES.has(evt.table)) return;
      if (completionTimer.current) clearTimeout(completionTimer.current);
      completionTimer.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('lemtel:phone-sync-complete', { detail: { source: 'realtime', event: evt } }));
        if (evt.table === 'pbx_call_records' || evt.table === 'pbx_call_recordings' || evt.hasRecording) {
          window.dispatchEvent(new CustomEvent('lemtel:recordings-updated', { detail: evt }));
        }
      }, 1200);
    };

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
            countsToday: { ...s.countsToday, [table]: s.countsToday[table] + 1 },
          }));
          window.dispatchEvent(new CustomEvent('lemtel:sync', { detail: evt }));
          emitDebouncedPhoneSync(evt);
        }
      );
    });

    ch.subscribe((status) => {
      const connected = status === 'SUBSCRIBED';
      setState((s) => ({ ...s, connected }));
      window.dispatchEvent(new CustomEvent('lemtel:sync-status', {
        detail: { connected, at: Date.now() },
      }));
    });

    channelRef.current = ch;
    return () => {
      if (completionTimer.current) clearTimeout(completionTimer.current);
      try { supabase.removeChannel(ch); } catch { /* noop */ }
      channelRef.current = null;
    };
  }, [orgId]);

  return state;
}
