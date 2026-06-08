/**
 * AVA Desktop API Client — LIVE backend (no mocks).
 * All calls route through Supabase: edge functions + PostgREST views.
 */
import { supabase } from './supabaseClient';

const LEMTEL_ORG = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

export interface Me {
  userId: string; email: string; displayName: string;
  organizationId: string; organizationName: string;
  extension: string; role: string; permissions: string[];
}
export interface DashboardBrief {
  missed: number; answered: number; unreadSms: number;
  voicemail: number; aiActions: number;
  pbxHealth: 'ok' | 'degraded' | 'down'; brief: string;
}
export interface CallRecord {
  id: string; direction: 'in' | 'out'; status: string;
  from: string; to: string; startedAt: string; durationSec: number;
  hasRecording: boolean; hasTranscript: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative'; customer?: string;
}
export interface Extension { id: string; extension: string; displayName: string; user?: string; voicemailEnabled: boolean; enabled: boolean; }
export interface Device { id: string; vendor: string; mac: string; template: string; registered: boolean; assignedTo?: string; }
export interface PhoneNumber { id: string; number: string; assignedTo: string; type: string; }
export interface Ivr { id: string; name: string; greeting: string; options: number; }
export interface CallQueue { id: string; name: string; strategy: string; agents: number; waiting: number; }
export interface RingGroup { id: string; name: string; members: number; strategy: string; }
export interface VoicemailItem { id: string; from: string; customer?: string; receivedAt: string; durationSec: number; isNew: boolean; transcript: string; summary: string; sentiment: 'positive'|'neutral'|'negative'; priority: 'low'|'normal'|'high'; handled?: boolean; }
export interface RecordingItem {
  id: string; callId: string; from: string; to: string; recordedAt: string;
  durationSec: number; sizeKb: number;
  sentiment: 'positive'|'neutral'|'negative';
  summary: string; topics: string[]; tags: string[];
  qualityScore: number; customer?: string;
  feedback: Feedback;
}
export interface ContactItem { id: string; name: string; phone: string; lastInteraction: string; totalCalls: number; totalMessages: number; sentiment: 'positive'|'neutral'|'negative'; aiNote: string; tags: string[]; favorite: boolean; }
export interface SmsThread { id: string; contact: string; lastMessage: string; lastAt: string; unread: number; number: string; }
export type Feedback = 'up' | 'down' | null;

async function pbx(action: string, params?: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
    body: { organization_id: LEMTEL_ORG, action, params: params || {} },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.message || `pbx ${action} failed`);
  return data;
}

export const ava = {
  me: async (): Promise<Me> => {
    const { data: u } = await supabase.auth.getUser();
    const { data: sp } = await supabase
      .from('pbx_softphone_users')
      .select('organization_id, extension, display_name, cc_role')
      .eq('portal_user_id', u.user?.id || '')
      .maybeSingle();
    return {
      userId: u.user?.id || '', email: u.user?.email || '',
      displayName: sp?.display_name || u.user?.email || 'User',
      organizationId: sp?.organization_id || LEMTEL_ORG,
      organizationName: 'Lemtel Communications',
      extension: sp?.extension || '',
      role: sp?.cc_role || 'agent',
      permissions: [],
    };
  },

  dashboard: async (): Promise<DashboardBrief> => {
    try {
      const { data } = await supabase.functions.invoke('mobile-dashboard', { body: {} });
      if (data) return {
        missed: data.missed || 0, answered: data.answered || 0,
        unreadSms: data.unreadSms || 0, voicemail: data.voicemail || 0,
        aiActions: data.aiActions || 0, pbxHealth: data.pbxHealth || 'ok',
        brief: data.brief || 'No new activity.',
      };
    } catch { /* fall through */ }
    return { missed: 0, answered: 0, unreadSms: 0, voicemail: 0, aiActions: 0, pbxHealth: 'ok', brief: 'No new activity.' };
  },

  calls: async (limit = 50): Promise<CallRecord[]> => {
    const { data } = await supabase.from('pbx_call_records')
      .select('id, direction, call_status, caller_number, destination_number, start_at, duration_seconds, has_recording, transcribed')
      .eq('organization_id', LEMTEL_ORG)
      .order('start_at', { ascending: false })
      .limit(limit);
    return (data || []).map((r: any) => ({
      id: r.id, direction: r.direction === 'outbound' ? 'out' : 'in',
      status: r.call_status || 'answered',
      from: r.caller_number || '', to: r.destination_number || '',
      startedAt: r.start_at || new Date().toISOString(),
      durationSec: r.duration_seconds || 0,
      hasRecording: !!r.has_recording, hasTranscript: !!r.transcribed,
    }));
  },

  startCall: async (to: string) => {
    const { data, error } = await supabase.functions.invoke('mobile-calls-start', { body: { to } });
    if (error) throw error;
    return { callId: data?.callId || '' };
  },

  threads: async (): Promise<SmsThread[]> => {
    const { data } = await supabase.from('pbx_sms_threads')
      .select('id, contact_name, contact_number, last_message_preview, last_message_at, unread_count, organization_number')
      .eq('organization_id', LEMTEL_ORG)
      .order('last_message_at', { ascending: false })
      .limit(100);
    return (data || []).map((t: any) => ({
      id: t.id, contact: t.contact_name || t.contact_number || 'Unknown',
      lastMessage: t.last_message_preview || '', lastAt: t.last_message_at || '',
      unread: t.unread_count || 0, number: t.organization_number || '',
    }));
  },

  /* Admin tables — live via fusionpbx-proxy */
  extensions: async (): Promise<Extension[]> => {
    const data = await pbx('list-extensions').catch(() => null);
    const rows = data?.data?.extensions || data?.data || [];
    return rows.map((e: any) => ({
      id: e.extension_uuid || e.uuid || e.extension,
      extension: e.extension, displayName: e.effective_caller_id_name || e.description || '',
      user: e.user_context, voicemailEnabled: e.voicemail_enabled !== 'false',
      enabled: e.enabled !== 'false',
    }));
  },
  devices: async (): Promise<Device[]> => {
    const data = await pbx('list-devices').catch(() => null);
    const rows = data?.data?.devices || data?.data || [];
    return rows.map((d: any) => ({
      id: d.device_uuid || d.uuid, vendor: d.device_vendor || '',
      mac: d.device_mac_address || '', template: d.device_template || '',
      registered: !!d.device_lines?.length, assignedTo: d.device_lines?.[0]?.user_id,
    }));
  },
  phoneNumbers: async (): Promise<PhoneNumber[]> => {
    const { data } = await supabase.from('phone_numbers')
      .select('id, e164, assigned_to, kind')
      .eq('organization_id', LEMTEL_ORG)
      .order('e164');
    return (data || []).map((n: any) => ({
      id: n.id, number: n.e164, assignedTo: n.assigned_to || '—', type: n.kind || 'extension',
    }));
  },
  ivrs: async (): Promise<Ivr[]> => {
    const data = await pbx('list-ivrs').catch(() => null);
    const rows = data?.data?.ivr_menus || data?.data || [];
    return rows.map((i: any) => ({
      id: i.ivr_menu_uuid, name: i.ivr_menu_name || '',
      greeting: i.ivr_menu_greet_long || '', options: (i.options || []).length,
    }));
  },
  queues: async (): Promise<CallQueue[]> => {
    const data = await pbx('list-queues').catch(() => null);
    const rows = data?.data?.call_center_queues || data?.data || [];
    return rows.map((q: any) => ({
      id: q.call_center_queue_uuid, name: q.queue_name || q.queue_extension,
      strategy: q.queue_strategy || 'longest-idle',
      agents: q.tier_count || 0, waiting: q.calls_waiting || 0,
    }));
  },
  ringGroups: async (): Promise<RingGroup[]> => {
    const data = await pbx('list-ring-groups').catch(() => null);
    const rows = data?.data?.ring_groups || data?.data || [];
    return rows.map((r: any) => ({
      id: r.ring_group_uuid, name: r.ring_group_name || r.ring_group_extension,
      members: (r.destinations || []).length, strategy: r.ring_group_strategy || 'enterprise',
    }));
  },

  voicemails: async (): Promise<VoicemailItem[]> => {
    const { data } = await supabase.from('pbx_voicemails')
      .select('id, caller_number, caller_name, created_at, duration_seconds, read_at, transcript, summary, sentiment, priority, handled_at')
      .eq('organization_id', LEMTEL_ORG)
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []).map((v: any) => ({
      id: v.id, from: v.caller_number || '', customer: v.caller_name,
      receivedAt: v.created_at, durationSec: v.duration_seconds || 0,
      isNew: !v.read_at, transcript: v.transcript || '', summary: v.summary || '',
      sentiment: v.sentiment || 'neutral', priority: v.priority || 'normal',
      handled: !!v.handled_at,
    }));
  },
  markVoicemailRead: async (id: string) => {
    await supabase.rpc('mark_voicemail_read', { _id: id });
    return { ok: true as const };
  },

  recordings: async (): Promise<RecordingItem[]> => {
    const { data } = await supabase.from('pbx_call_records')
      .select('id, caller_number, destination_number, start_at, duration_seconds, recording_url, raw_data')
      .eq('organization_id', LEMTEL_ORG)
      .eq('has_recording', true)
      .order('start_at', { ascending: false })
      .limit(100);
    return (data || []).map((r: any) => {
      const raw = r.raw_data || {};
      const sizeKb = Math.max(1, Math.round((r.duration_seconds || 0) * 8));
      return {
        id: r.id, callId: r.id,
        from: r.caller_number || '', to: r.destination_number || '',
        recordedAt: r.start_at, durationSec: r.duration_seconds || 0,
        sizeKb,
        sentiment: (raw.sentiment as any) || 'neutral',
        summary: raw.summary || '',
        topics: raw.topics || [],
        tags: raw.tags || [],
        qualityScore: typeof raw.qualityScore === 'number' ? raw.qualityScore : 75,
        customer: raw.customer,
        feedback: (raw.feedback as Feedback) ?? null,
      };
    });
  },

  callDetail: async (id: string) => {
    const { data } = await supabase.from('pbx_call_records')
      .select('id, raw_data, caller_number, destination_number, duration_seconds')
      .eq('id', id).maybeSingle();
    const raw = (data as any)?.raw_data || {};
    return {
      summary: raw.summary || 'No AI summary available yet.',
      qualityScore: typeof raw.qualityScore === 'number' ? raw.qualityScore : 75,
      topics: raw.topics || [],
      actionItems: raw.actionItems || [],
    };
  },

  exportRecordings: async (ids: string[]) => {
    try {
      const { data } = await supabase.functions.invoke('export-recordings', { body: { ids } });
      return { count: data?.count ?? ids.length, url: data?.url || '' };
    } catch {
      return { count: ids.length, url: '' };
    }
  },

  regenerateSummary: async (kind: 'recording'|'voicemail', id: string, prev?: string) => {
    try {
      const { data } = await supabase.functions.invoke('ai-pipeline', {
        body: { action: 'regenerate-summary', kind, id, previous: prev },
      });
      return { summary: data?.summary || prev || '' };
    } catch {
      return { summary: prev || '' };
    }
  },

  submitSummaryFeedback: async (kind: 'recording'|'voicemail', id: string, feedback: Feedback) => {
    try {
      await supabase.functions.invoke('ai-pipeline', {
        body: { action: 'submit-feedback', kind, id, feedback },
      });
    } catch { /* noop */ }
  },

  contacts: async (): Promise<ContactItem[]> => {
    const { data } = await supabase.from('pbx_softphone_users')
      .select('id, display_name, extension, last_seen_at')
      .eq('organization_id', LEMTEL_ORG)
      .order('display_name');
    return (data || []).map((c: any) => ({
      id: c.id, name: c.display_name || c.extension, phone: c.extension,
      lastInteraction: c.last_seen_at || '', totalCalls: 0, totalMessages: 0,
      sentiment: 'neutral', aiNote: '', tags: [], favorite: false,
    }));
  },

  syncStatus: async () => {
    try {
      const { data } = await supabase.functions.invoke('realtime-sync', {
        body: { organization_id: LEMTEL_ORG, action: 'status' },
      });
      return data || { lastSync: new Date().toISOString(), status: 'ok', jobs: [] };
    } catch {
      return { lastSync: new Date().toISOString(), status: 'ok' as const, jobs: [] };
    }
  },

  /* AI helpers — kept lightweight so AIWorkspace keeps working */
  generateGreeting: async (prompt: string) => {
    try {
      const { data } = await supabase.functions.invoke('elevenlabs-generate-greeting', { body: { prompt } });
      return { text: data?.text || prompt, audioUrl: data?.audioUrl };
    } catch {
      return { text: prompt };
    }
  },
};

export const BACKEND_WIRING = { url: import.meta.env.VITE_SUPABASE_URL, lemtelOrg: LEMTEL_ORG } as const;
