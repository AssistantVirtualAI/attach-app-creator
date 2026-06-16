import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export type AttentionItem = {
  title: string;
  detail: string;
  tag: string;
  tone: 'danger' | 'warn' | 'info' | 'success';
};

export type DailySeries = {
  dates: string[]; // yyyy-mm-dd, ascending
  calls: number[];
  missed: number[];
  answered: number[];
  recordings: number[];
};

export type DashboardStats = {
  missedToday: number;
  answeredToday: number;
  totalCallsToday: number;
  recordingsToday: number;
  recordingCoveragePct: number;
  unreadSms: number;
  unreadVoicemail: number;
  extensionsTotal: number;
  liveCalls: number;
  lastCallAt: string | null;
  lastRecordingAt: string | null;
  cdrFreshness: 'live' | 'stale' | 'idle';
  attention: AttentionItem[];
  pbxHealth: 'ok' | 'warn' | 'down';
  series: DailySeries;
  error: string | null;
  loading: boolean;
};


const startOfDay = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
};

export type RangeKey = 'today' | 'week' | 'month' | 'custom';

export function rangeBounds(key: RangeKey, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  if (key === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (key === 'week') {
    const start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (key === 'month') {
    const start = new Date(now); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  // custom
  const from = customFrom ? new Date(customFrom) : new Date(now);
  const to = customTo ? new Date(customTo) : new Date(now);
  from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

const minutesAgo = (iso: string | null) => {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
};

const formatRelative = (iso: string | null) => {
  const mins = minutesAgo(iso);
  if (!Number.isFinite(mins)) return 'No live CDR yet';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso as string).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export function useDashboardStats(
  orgId: string | null,
  extension: string | null,
  range: RangeKey = 'today',
  customFrom?: string,
  customTo?: string,
) {
  const emptySeries: DailySeries = { dates: [], calls: [], missed: [], answered: [], recordings: [] };
  const [stats, setStats] = useState<DashboardStats>({
    missedToday: 0, answeredToday: 0, totalCallsToday: 0,
    recordingsToday: 0, recordingCoveragePct: 0,
    unreadSms: 0, unreadVoicemail: 0, extensionsTotal: 0,
    liveCalls: 0, lastCallAt: null, lastRecordingAt: null,
    cdrFreshness: 'idle', attention: [], pbxHealth: 'ok',
    series: emptySeries, error: null, loading: true,
  });

  const refresh = useCallback(async () => {
    if (!orgId) { setStats((s) => ({ ...s, loading: false, cdrFreshness: 'idle' })); return; }
    setStats((s) => ({ ...s, loading: true, error: null }));
    try {
    const { from, to } = rangeBounds(range, customFrom, customTo);

    let callsQ = supabase.from('pbx_call_records')
      .select('id, missed_call, call_status, hangup_cause, voicemail_message, has_recording, recording_name, recording_path, start_at', { count: 'exact', head: false })
      .eq('organization_id', orgId)
      .gte('start_at', from)
      .lte('start_at', to)
      .order('start_at', { ascending: false });

    let smsQ = supabase.from('pbx_sms_threads')
      .select('unread_count')
      .eq('organization_id', orgId);

    let liveQ = supabase.from('telecom_live_calls')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    if (extension) {
      callsQ = callsQ.eq('extension', extension);
      smsQ = smsQ.eq('extension', extension);
      liveQ = liveQ.eq('extension', extension);
    }

    const [callsR, smsR, liveR] = await Promise.all([callsQ, smsQ, liveQ]);
    if (callsR.error) throw callsR.error;
    const calls = (callsR.data || []) as any[];
    const missed = calls.filter((r) => r.missed_call || r.call_status === 'missed' || r.hangup_cause === 'NO_ANSWER').length;
    const answered = calls.length - missed;
    const recordings = calls.filter((r) => r.has_recording || r.recording_name || r.recording_path).length;
    const unreadVoicemail = calls.filter((r) => r.missed_call || r.hangup_cause === 'NO_ANSWER' || (r.voicemail_message && r.voicemail_message !== 'false')).length;
    const unreadSms = (smsR.data || []).reduce((a: number, t: any) => a + (t.unread_count || 0), 0);
    const lastCallAt = calls[0]?.start_at || null;
    const lastRecordingAt = calls.find((r) => r.has_recording || r.recording_name || r.recording_path)?.start_at || null;
    const freshnessMins = minutesAgo(lastCallAt);
    const cdrFreshness: DashboardStats['cdrFreshness'] = !Number.isFinite(freshnessMins) ? 'idle' : freshnessMins <= 15 ? 'live' : 'stale';
    const attention: AttentionItem[] = [];
    const rangeLabel = range === 'today' ? 'today' : range === 'week' ? 'this week' : range === 'month' ? 'this month' : 'in selected range';

    if (missed > 0) attention.push({ title: `${missed} missed call${missed === 1 ? '' : 's'} ${rangeLabel}`, detail: 'Review the call log and return priority calls from the console.', tag: 'Callback', tone: 'danger' });
    if (unreadVoicemail > 0) attention.push({ title: `${unreadVoicemail} voicemail candidate${unreadVoicemail === 1 ? '' : 's'}`, detail: 'Open voicemail or recordings to listen, transcribe, and mark handled.', tag: 'Voicemail', tone: 'warn' });
    if (cdrFreshness === 'stale') attention.push({ title: 'CDR feed looks stale', detail: `Last synced call was ${formatRelative(lastCallAt)}. Run Phone System Sync if you just completed a call.`, tag: 'Sync', tone: 'info' });
    if (attention.length === 0) attention.push({ title: 'Phone system is current', detail: `Last CDR ${formatRelative(lastCallAt)}. No urgent items detected ${rangeLabel}.`, tag: 'Live', tone: 'success' });

    // Daily bucket series for sparklines
    const fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to); toDate.setHours(0, 0, 0, 0);
    const dayMs = 86400000;
    const totalDays = Math.max(1, Math.min(60, Math.round((toDate.getTime() - fromDate.getTime()) / dayMs) + 1));
    const dates: string[] = [];
    const byDay = new Map<string, { c: number; m: number; a: number; r: number }>();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(fromDate.getTime() + i * dayMs);
      const key = d.toISOString().slice(0, 10);
      dates.push(key);
      byDay.set(key, { c: 0, m: 0, a: 0, r: 0 });
    }
    for (const r of calls) {
      if (!r.start_at) continue;
      const key = String(r.start_at).slice(0, 10);
      const slot = byDay.get(key);
      if (!slot) continue;
      slot.c += 1;
      const isMissed = r.missed_call || r.call_status === 'missed' || r.hangup_cause === 'NO_ANSWER';
      if (isMissed) slot.m += 1; else slot.a += 1;
      if (r.has_recording || r.recording_name || r.recording_path) slot.r += 1;
    }
    const series: DailySeries = {
      dates,
      calls: dates.map((d) => byDay.get(d)!.c),
      missed: dates.map((d) => byDay.get(d)!.m),
      answered: dates.map((d) => byDay.get(d)!.a),
      recordings: dates.map((d) => byDay.get(d)!.r),
    };

    setStats({
      missedToday: missed,
      answeredToday: answered,
      totalCallsToday: calls.length,
      recordingsToday: recordings,
      recordingCoveragePct: calls.length ? Math.round((recordings / calls.length) * 100) : 0,
      unreadSms,
      unreadVoicemail,
      extensionsTotal: extension ? 1 : 0,
      liveCalls: liveR.count || 0,
      lastCallAt,
      lastRecordingAt,
      cdrFreshness,
      attention: attention.slice(0, 3),
      pbxHealth: 'ok',
      series,
      error: null,
      loading: false,
    });
    } catch (e: any) {
      const msg = e?.message || e?.error_description || 'Failed to load stats';
      setStats((s) => ({ ...s, loading: false, error: String(msg).slice(0, 240) }));
    }
  }, [orgId, extension, range, customFrom, customTo]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh on realtime sync events and completed PBX sync bursts.
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onSync = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => refresh(), 900);
    };
    window.addEventListener('lemtel:sync', onSync as EventListener);
    window.addEventListener('lemtel:phone-sync-complete', onSync as EventListener);
    return () => {
      window.removeEventListener('lemtel:sync', onSync as EventListener);
      window.removeEventListener('lemtel:phone-sync-complete', onSync as EventListener);
      if (pending) clearTimeout(pending);
    };
  }, [refresh]);

  return { ...stats, refresh };
}
