import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type SyncTable = 'pbx_call_records' | 'pbx_voicemails' | 'pbx_call_recordings' | 'pbx_sms_messages';
export type SyncEvent = {
  table: SyncTable;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  at: number;
};
export type SyncState = {
  connected: boolean;
  lastEvent: SyncEvent | null;
  countsToday: Record<SyncTable, number>;
};

const TABLES: SyncTable[] = ['pbx_call_records', 'pbx_voicemails', 'pbx_call_recordings', 'pbx_sms_messages'];

/**
 * Real-time sync service. Subscribes to postgres_changes for the four telephony tables
 * scoped to the tenant org, broadcasts a window event so the whole desktop can react
 * (LeftRail glow, TitleBar sync pill, lists invalidate caches, etc.).
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

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase.channel(`desk-sync-${orgId}`);

    TABLES.forEach((table) => {
      ch.on(
        // @ts-ignore postgres_changes typing
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `organization_id=eq.${orgId}` },
        (payload: any) => {
          const evt: SyncEvent = {
            table,
            action: payload.eventType as SyncEvent['action'],
            at: Date.now(),
          };
          setState((s) => ({
            ...s,
            lastEvent: evt,
            countsToday: { ...s.countsToday, [table]: s.countsToday[table] + 1 },
          }));
          window.dispatchEvent(new CustomEvent('lemtel:sync', { detail: evt }));
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
      try { supabase.removeChannel(ch); } catch { /* noop */ }
      channelRef.current = null;
    };
  }, [orgId]);

  return state;
}
