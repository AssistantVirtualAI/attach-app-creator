import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export type AttentionItem = {
  title: string;
  detail: string;
  tag: string;
  tone: 'danger' | 'warn' | 'info' | 'success';
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
  loading: boolean;
};

const startOfDay = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
};

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

export function useDashboardStats(orgId: string | null, extension: string | null) {
  const [stats, setStats] = useState<DashboardStats>({
    missedToday: 0, answeredToday: 0, totalCallsToday: 0,
    recordingsToday: 0, recordingCoveragePct: 0,
    unreadSms: 0, unreadVoicemail: 0, extensionsTotal: 0,
    liveCalls: 0, lastCallAt: null, lastRecordingAt: null,
    cdrFreshness: 'idle', attention: [], pbxHealth: 'ok', loading: true,
  });

  const refresh = useCallback(async () => {
    if (!orgId) { setStats((s) => ({ ...s, loading: false, cdrFreshness: 'idle' })); return; }
    const since = startOfDay();

    let callsQ = supabase.from('pbx_call_records')
      .select('id, missed_call, call_status, hangup_cause, voicemail_message, has_recording, recording_name, recording_path, start_at', { count: 'exact', head: false })
      .eq('organization_id', orgId)
      .gte('start_at', since)
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

    if (missed > 0) attention.push({ title: `${missed} missed call${missed === 1 ? '' : 's'} today`, detail: 'Review the call log and return priority calls from the console.', tag: 'Callback', tone: 'danger' });
    if (unreadVoicemail > 0) attention.push({ title: `${unreadVoicemail} voicemail candidate${unreadVoicemail === 1 ? '' : 's'}`, detail: 'Open voicemail or recordings to listen, transcribe, and mark handled.', tag: 'Voicemail', tone: 'warn' });
    if (cdrFreshness === 'stale') attention.push({ title: 'CDR feed looks stale', detail: `Last synced call was ${formatRelative(lastCallAt)}. Run Phone System Sync if you just completed a call.`, tag: 'Sync', tone: 'info' });
    if (attention.length === 0) attention.push({ title: 'Phone system is current', detail: `Last CDR ${formatRelative(lastCallAt)}. No urgent callbacks detected for this extension.`, tag: 'Live', tone: 'success' });

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
      loading: false,
    });
  }, [orgId, extension]);

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
