import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export type DashboardStats = {
  missedToday: number;
  answeredToday: number;
  unreadSms: number;
  unreadVoicemail: number;
  pbxHealth: 'ok' | 'warn' | 'down';
  loading: boolean;
};

const startOfDay = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
};

export function useDashboardStats(orgId: string | null, extension: string | null) {
  const [stats, setStats] = useState<DashboardStats>({
    missedToday: 0, answeredToday: 0, unreadSms: 0,
    unreadVoicemail: 0, pbxHealth: 'ok', loading: true,
  });

  const refresh = useCallback(async () => {
    if (!orgId) { setStats((s) => ({ ...s, loading: false })); return; }
    const since = startOfDay();

    const callsQ = supabase.from('pbx_call_records')
      .select('id, missed_call, call_status', { count: 'exact', head: false })
      .eq('organization_id', orgId)
      .gte('start_at', since);
    if (extension) callsQ.eq('extension', extension);

    const vmQ = supabase.from('pbx_voicemails')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('read_at', null);
    if (extension) vmQ.eq('extension', extension);

    const smsQ = supabase.from('pbx_sms_threads')
      .select('unread_count')
      .eq('organization_id', orgId);

    const [callsR, vmR, smsR] = await Promise.all([callsQ, vmQ, smsQ]);
    const calls = (callsR.data || []) as any[];
    const missed = calls.filter((r) => r.missed_call || r.call_status === 'missed').length;
    const answered = calls.length - missed;
    const unreadSms = (smsR.data || []).reduce((a: number, t: any) => a + (t.unread_count || 0), 0);

    setStats({
      missedToday: missed,
      answeredToday: answered,
      unreadSms,
      unreadVoicemail: vmR.count || 0,
      pbxHealth: 'ok',
      loading: false,
    });
  }, [orgId, extension]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh on realtime sync events
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onSync = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => refresh(), 600);
    };
    window.addEventListener('lemtel:sync', onSync as EventListener);
    return () => {
      window.removeEventListener('lemtel:sync', onSync as EventListener);
      if (pending) clearTimeout(pending);
    };
  }, [refresh]);

  return { ...stats, refresh };
}
