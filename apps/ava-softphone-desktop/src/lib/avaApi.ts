/**
 * AVA Desktop API Client.
 *
 * Backend: Supabase project gejxisrqtvxavbrfcoxz.supabase.co
 *   Auth      — Supabase Auth (JWT in Authorization header).
 *   Tables    — pbx_call_records, pbx_extensions, pbx_ai_insights,
 *               pbx_sms_threads, pbx_softphone_users.
 *   Functions — fusionpbx-proxy, ai-analyze-call, telnyx-sms,
 *               elevenlabs-generate-greeting, softphone-credentials.
 *
 * Set MOCK=false (and provide a Supabase session token via `setAuthToken`)
 * to route through the live backend. PBX/SIP/SMS secrets NEVER live in the
 * desktop app — they are held by the Edge Functions above.
 */
import { BACKEND, TABLES, FN, fnUrl } from './config';

export const MOCK: boolean = (import.meta as any).env?.VITE_AVA_MOCK === 'true';

let authToken: string | null = null;
export function setAuthToken(token: string | null) { authToken = token; }

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: BACKEND.anonKey,
  };
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  return h;
}

/**
 * Path routing convention for live mode:
 *   `/fn/<function-name>`   → POST  ${BACKEND.url}/functions/v1/<name>
 *   `/db/<table>?<query>`   → GET   ${BACKEND.url}/rest/v1/<table>?<query>
 * Everything else is treated as a relative REST path under PostgREST.
 */
function resolveUrl(path: string): string {
  if (path.startsWith('/fn/')) {
    const [fnPath, qs] = path.slice(4).split('?');
    const base = fnUrl(fnPath);
    return qs ? `${base}?${qs}` : base;
  }
  if (path.startsWith('/db/')) return `${BACKEND.url}/rest/v1/${path.slice(4)}`;
  return `${BACKEND.url}${path}`;
}

async function call<T>(path: string, init: RequestInit = {}, mockData?: T): Promise<T> {
  if (MOCK && mockData !== undefined) {
    await new Promise((r) => setTimeout(r, 180));
    return mockData;
  }
  const res = await fetch(resolveUrl(path), {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`AVA ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

/** Concrete backend wiring exposed for components that need it directly. */
export const BACKEND_WIRING = {
  url: BACKEND.url,
  tables: TABLES,
  functions: FN,
} as const;

/* ---------- Types ---------- */
export interface Me {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  extension: string;
  role: 'end_user' | 'agent' | 'client_admin' | 'lemtel_admin' | 'ava_super_admin';
  permissions: string[];
}

export interface DashboardBrief {
  missed: number; answered: number; unreadSms: number;
  voicemail: number; aiActions: number;
  pbxHealth: 'ok' | 'degraded' | 'down';
  brief: string;
}

export interface CallRecord {
  id: string; direction: 'in' | 'out'; status: 'answered' | 'missed' | 'voicemail';
  from: string; to: string; startedAt: string; durationSec: number;
  hasRecording: boolean; hasTranscript: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  customer?: string;
  organization_id?: string; transcript_text?: string;
  recording_path?: string | null; recording_name?: string | null;
  record_path?: string | null; record_name?: string | null; recording_url?: string | null;
}

export interface CallInsight {
  callId: string; summary: string; sentiment: string; topics: string[];
  actionItems: string[]; risks: string[]; opportunities: string[]; qualityScore: number;
}

export interface SmsThread {
  id: string; contact: string; lastMessage: string; lastAt: string;
  unread: number; number: string;
}

export interface Extension {
  id: string; extension: string; displayName: string;
  user?: string; voicemailEnabled: boolean; enabled: boolean;
}
export interface Device { id: string; vendor: string; mac: string; template: string; registered: boolean; assignedTo?: string; }
export interface PhoneNumber { id: string; number: string; assignedTo: string; type: 'extension' | 'ivr' | 'queue' | 'agent' | 'sms'; }
export interface Ivr { id: string; name: string; greeting: string; options: number; }
export interface CallQueue { id: string; name: string; strategy: string; agents: number; waiting: number; }
export interface RingGroup { id: string; name: string; members: number; strategy: string; }

export type Feedback = 'up' | 'down' | null;

export interface VoicemailItem {
  id: string; from: string; customer?: string; receivedAt: string;
  durationSec: number; isNew: boolean; transcript: string;
  summary: string; sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'low' | 'normal' | 'high';
  handled?: boolean; feedback?: Feedback;
  organization_id?: string; callId?: string;
  recording_path?: string | null; recording_name?: string | null;
  record_path?: string | null; record_name?: string | null; recording_url?: string | null;
}
export interface RecordingItem {
  id: string; callId: string; from: string; to: string; customer?: string;
  recordedAt: string; durationSec: number; sizeKb: number;
  qualityScore: number; sentiment: 'positive' | 'neutral' | 'negative';
  summary: string; topics: string[]; tags: string[]; feedback?: Feedback;
  organization_id?: string; transcript_text?: string;
  recording_path?: string | null; recording_name?: string | null;
  record_path?: string | null; record_name?: string | null; recording_url?: string | null;
}
export interface ContactInteraction {
  id: string; kind: 'call' | 'sms' | 'voicemail';
  direction: 'in' | 'out'; at: string; preview: string; durationSec?: number;
}
export interface ContactItem {
  id: string; name: string; company?: string; phone: string; email?: string;
  lastInteraction: string; totalCalls: number; totalMessages: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  aiNote: string; notes?: string; tags: string[]; favorite: boolean;
  interactions?: ContactInteraction[];
}

/* ---------- Mock data ---------- */
const MOCK_ME: Me = {
  userId: 'u_1', email: 'demo@lemtel.tel', displayName: 'Demo User',
  organizationId: 'org_lemtel', organizationName: 'Lemtel Communications',
  extension: '301', role: 'client_admin',
  permissions: ['calls.read', 'messages.send', 'admin.extensions', 'admin.devices', 'admin.ivr', 'admin.queues', 'ai.use'],
};

const MOCK_CALLS: CallRecord[] = [
  { id: 'c1', direction: 'in', status: 'answered', from: '+15145550182', to: '301', startedAt: new Date(Date.now()-3600e3).toISOString(), durationSec: 245, hasRecording: true, hasTranscript: true, sentiment: 'positive', customer: 'Marie Tremblay' },
  { id: 'c2', direction: 'in', status: 'missed', from: '+14385550199', to: '301', startedAt: new Date(Date.now()-7200e3).toISOString(), durationSec: 0, hasRecording: false, hasTranscript: false, customer: 'Acme Corp' },
  { id: 'c3', direction: 'out', status: 'answered', from: '301', to: '+15145550141', startedAt: new Date(Date.now()-10800e3).toISOString(), durationSec: 612, hasRecording: true, hasTranscript: true, sentiment: 'neutral' },
  { id: 'c4', direction: 'in', status: 'voicemail', from: '+15145550101', to: '301', startedAt: new Date(Date.now()-14400e3).toISOString(), durationSec: 38, hasRecording: true, hasTranscript: true, sentiment: 'negative', customer: 'Unknown' },
];

const MOCK_THREADS: SmsThread[] = [
  { id: 't1', contact: 'Marie Tremblay', lastMessage: 'Perfect, I\'ll review the quote tonight.', lastAt: new Date(Date.now()-1800e3).toISOString(), unread: 0, number: '+15145550100' },
  { id: 't2', contact: 'Acme Corp', lastMessage: 'Can we reschedule to Thursday?', lastAt: new Date(Date.now()-3600e3).toISOString(), unread: 2, number: '+15145550100' },
  { id: 't3', contact: '+15145550141', lastMessage: 'Thanks for the call earlier.', lastAt: new Date(Date.now()-7200e3).toISOString(), unread: 1, number: '+15145550100' },
];

const MOCK_EXT: Extension[] = [
  { id: 'e1', extension: '301', displayName: 'Demo User', user: 'demo@lemtel.tel', voicemailEnabled: true, enabled: true },
  { id: 'e2', extension: '302', displayName: 'Reception', voicemailEnabled: true, enabled: true },
  { id: 'e3', extension: '303', displayName: 'Sales Queue', voicemailEnabled: false, enabled: true },
];
const MOCK_DEV: Device[] = [
  { id: 'd1', vendor: 'Yealink', mac: '00:15:65:AA:BB:01', template: 'T46U-default', registered: true, assignedTo: '301' },
  { id: 'd2', vendor: 'Polycom', mac: '00:04:F2:AB:CD:02', template: 'VVX-411', registered: false, assignedTo: '302' },
];
const MOCK_NUM: PhoneNumber[] = [
  { id: 'n1', number: '+15145550100', assignedTo: 'Main IVR', type: 'ivr' },
  { id: 'n2', number: '+15145550101', assignedTo: 'Sales Queue', type: 'queue' },
  { id: 'n3', number: '+15145550102', assignedTo: 'Ext 301', type: 'extension' },
];
const MOCK_IVR: Ivr[] = [
  { id: 'i1', name: 'Main IVR', greeting: 'Welcome to Lemtel Communications…', options: 4 },
  { id: 'i2', name: 'After Hours', greeting: 'Thank you for calling. Our offices are closed…', options: 2 },
];
const MOCK_QUEUES: CallQueue[] = [
  { id: 'q1', name: 'Sales', strategy: 'ring-all', agents: 3, waiting: 0 },
  { id: 'q2', name: 'Support', strategy: 'longest-idle', agents: 5, waiting: 1 },
];
const MOCK_RG: RingGroup[] = [
  { id: 'r1', name: 'Management', members: 3, strategy: 'simultaneous' },
];

const SAMPLE_VOICEMAIL_EMPTY: VoicemailItem[] = [
  { id: 'v1', from: '+15145550101', customer: 'Marie Tremblay', receivedAt: new Date(Date.now()-1800e3).toISOString(), durationSec: 42, isNew: true, transcript: 'Hi, this is Marie. Just calling to confirm our meeting on Thursday at 2pm. Please call me back to confirm. Thanks!', summary: 'Marie confirms Thursday 2pm meeting and asks for callback confirmation.', sentiment: 'positive', priority: 'high' },
  { id: 'v2', from: '+14385550199', customer: 'Acme Corp', receivedAt: new Date(Date.now()-7200e3).toISOString(), durationSec: 28, isNew: true, transcript: 'Hello, we need an update on the proposal. Can you call us back today?', summary: 'Acme Corp requesting proposal update, urgent callback today.', sentiment: 'neutral', priority: 'high' },
  { id: 'v3', from: '+15145550141', receivedAt: new Date(Date.now()-86400e3).toISOString(), durationSec: 15, isNew: false, transcript: 'Sorry, wrong number.', summary: 'Wrong number — no action needed.', sentiment: 'neutral', priority: 'low' },
  { id: 'v4', from: '+15145550182', customer: 'Jean-Luc Roy', receivedAt: new Date(Date.now()-172800e3).toISOString(), durationSec: 67, isNew: false, transcript: 'Bonjour, I was disappointed by the last support call. Please contact me to discuss.', summary: 'Customer complaint regarding recent support interaction.', sentiment: 'negative', priority: 'high' },
];

const SAMPLE_RECORDING_EMPTY: RecordingItem[] = [
  { id: 'rec1', callId: 'c1', from: '+15145550182', to: '301', customer: 'Marie Tremblay', recordedAt: new Date(Date.now()-3600e3).toISOString(), durationSec: 245, sizeKb: 980, qualityScore: 92, sentiment: 'positive', summary: 'Customer confirmed renewal pricing and requested quote by Friday.', topics: ['renewal', 'pricing', 'quote'], tags: ['sales', 'follow-up'] },
  { id: 'rec2', callId: 'c3', from: '301', to: '+15145550141', recordedAt: new Date(Date.now()-10800e3).toISOString(), durationSec: 612, sizeKb: 2450, qualityScore: 78, sentiment: 'neutral', summary: 'Discovery call covering technical requirements for integration.', topics: ['integration', 'API', 'requirements'], tags: ['discovery'] },
  { id: 'rec3', callId: 'c4', from: '+15145550101', to: '301', customer: 'Jean-Luc Roy', recordedAt: new Date(Date.now()-14400e3).toISOString(), durationSec: 38, sizeKb: 150, qualityScore: 41, sentiment: 'negative', summary: 'Customer expressed frustration about support response time.', topics: ['support', 'complaint'], tags: ['escalation'] },
  { id: 'rec4', callId: 'c5', from: '+14385550120', to: '302', customer: 'Sophie Beaulieu', recordedAt: new Date(Date.now()-432000e3).toISOString(), durationSec: 184, sizeKb: 730, qualityScore: 88, sentiment: 'positive', summary: 'Onboarding session completed successfully.', topics: ['onboarding', 'training'], tags: ['success'] },
];

const mkInteractions = (seed: number): ContactInteraction[] => [
  { id: `${seed}-i1`, kind: 'call', direction: 'in', at: new Date(Date.now()-3600e3).toISOString(), preview: 'Discussed renewal terms and timing.', durationSec: 245 },
  { id: `${seed}-i2`, kind: 'sms', direction: 'out', at: new Date(Date.now()-7200e3).toISOString(), preview: 'Sent updated quote PDF.' },
  { id: `${seed}-i3`, kind: 'voicemail', direction: 'in', at: new Date(Date.now()-86400e3).toISOString(), preview: 'Left a voicemail about Thursday meeting.', durationSec: 42 },
  { id: `${seed}-i4`, kind: 'call', direction: 'out', at: new Date(Date.now()-172800e3).toISOString(), preview: 'Follow-up call, no answer.', durationSec: 0 },
];

const MOCK_CONTACTS: ContactItem[] = [
  { id: 'k1', name: 'Marie Tremblay', company: 'Tremblay & Co', phone: '+15145550182', email: 'marie@tremblay.co', lastInteraction: new Date(Date.now()-3600e3).toISOString(), totalCalls: 14, totalMessages: 23, sentiment: 'positive', aiNote: 'High-value account, renewal due in 30 days. Prefers email follow-ups.', tags: ['vip', 'renewal'], favorite: true, interactions: mkInteractions(1) },
  { id: 'k2', name: 'Acme Corp', company: 'Acme Corp', phone: '+14385550199', email: 'ops@acme.com', lastInteraction: new Date(Date.now()-7200e3).toISOString(), totalCalls: 8, totalMessages: 11, sentiment: 'neutral', aiNote: 'Proposal pending. Decision maker is responsive between 9am-11am.', tags: ['prospect'], favorite: false, interactions: mkInteractions(2) },
  { id: 'k3', name: 'Jean-Luc Roy', phone: '+15145550101', lastInteraction: new Date(Date.now()-14400e3).toISOString(), totalCalls: 3, totalMessages: 2, sentiment: 'negative', aiNote: 'Recent complaint about support — recommend manager outreach.', tags: ['at-risk'], favorite: false, interactions: mkInteractions(3) },
  { id: 'k4', name: 'Sophie Beaulieu', company: 'Beaulieu Studio', phone: '+14385550120', email: 'sophie@beaulieu.studio', lastInteraction: new Date(Date.now()-432000e3).toISOString(), totalCalls: 6, totalMessages: 9, sentiment: 'positive', aiNote: 'Recently onboarded, opportunity to upsell premium plan in Q3.', tags: ['onboarded', 'upsell'], favorite: true, interactions: mkInteractions(4) },
];

/* ---------- API surface ----------
 * Live routes map to Supabase:
 *   /db/<table>?...        → PostgREST SELECT/PATCH on a table.
 *   /fn/<edge-function>    → Supabase Edge Function (POST JSON).
 * Mocks short-circuit when MOCK=true.
 */

/* ─── Mappeurs CDR FusionPBX → UI ─────────────────────────── */
function mapCdrToCall(r: any): CallRecord {
  const billsec = Number(r.billsec ?? r.duration_seconds ?? 0);
  const missed  = r.missed_call || r.hangup_cause === 'NO_ANSWER' || billsec === 0;
  return {
    id:           r.id ?? r.pbx_uuid ?? String(Math.random()),
    direction:    (r.direction === 'outbound' ? 'out' : 'in') as 'in' | 'out',
    status:       (r.voicemail_message ? 'voicemail' : missed ? 'missed' : 'answered') as any,
    from:         r.caller_number ?? '',
    to:           r.destination_number ?? '',
    customer:     r.caller_name ?? undefined,
    startedAt:    r.start_at ?? new Date().toISOString(),
    durationSec:  billsec,
    hasRecording: !!(r.has_recording || r.recording_path || r.recording_name),
    hasTranscript: !!(r.transcript_text || r.raw_data?.transcript || r.raw_data?.transcript_text),
    sentiment:    (cleanText(r.raw_data?.ai?.sentiment ?? r.raw_data?.sentiment) as any) || undefined,
    organization_id: r.organization_id,
    transcript_text: cleanText(r.transcript_text ?? r.raw_data?.transcript_text ?? r.raw_data?.transcript) || undefined,
    recording_path: r.recording_path ?? r.record_path ?? null,
    recording_name: r.recording_name ?? r.record_name ?? null,
    record_path: r.record_path ?? r.recording_path ?? null,
    record_name: r.record_name ?? r.recording_name ?? null,
    recording_url: r.recording_url ?? null,
  };
}

function asArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.rows)) return raw.rows;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined || value === false) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'false' || text.toLowerCase() === 'null') return null;
  return text;
}

function mapCdrToVoicemail(r: any): VoicemailItem {
  const message = cleanText(r.voicemail_message ?? r.raw_data?.voicemail_message);
  const transcript = cleanText(r.transcript_text ?? r.raw_data?.transcript_text ?? r.raw_data?.transcript ?? message);
  return {
    id:          r.id ?? r.pbx_uuid ?? String(Math.random()),
    callId:      r.id ?? r.pbx_uuid ?? '',
    from:        r.caller_number ?? '',
    customer:    r.caller_name ?? undefined,
    receivedAt:  r.start_at ?? new Date().toISOString(),
    durationSec: Number(r.billsec ?? r.duration_seconds ?? 0),
    isNew:       !r.voicemail_read,
    transcript:  transcript ?? 'Transcription non disponible.',
    summary:     transcript ? transcript.slice(0, 120) + (transcript.length > 120 ? '…' : '') : 'Message vocal ou appel manqué à traiter.',
    sentiment:   'neutral' as const,
    priority:    'normal' as const,
    handled:     false,
    feedback:    null,
    organization_id: r.organization_id,
    recording_path: r.recording_path ?? r.record_path ?? null,
    recording_name: r.recording_name ?? r.record_name ?? null,
    record_path: r.record_path ?? r.recording_path ?? null,
    record_name: r.record_name ?? r.recording_name ?? null,
    recording_url: r.recording_url ?? null,
  };
}

function mapCdrToRecording(r: any): RecordingItem {
  const insight = r.raw_data?.ai ?? r.raw_data ?? {};
  return {
    id:          r.id ?? r.pbx_uuid ?? String(Math.random()),
    callId:      r.id ?? '',
    from:        r.caller_number ?? '',
    to:          r.destination_number ?? r.destination ?? '',
    customer:    r.caller_name ?? undefined,
    recordedAt:  r.start_at ?? new Date().toISOString(),
    durationSec: Number(r.billsec ?? r.duration_seconds ?? 0),
    sizeKb:      0,
    qualityScore: Number(insight.quality_score ?? insight.qualityScore ?? 0),
    sentiment:   (cleanText(insight.sentiment) as any) || 'neutral',
    summary:     cleanText(insight.summary) || 'Enregistrement disponible.',
    topics:      Array.isArray(insight.topics) ? insight.topics : [],
    tags:        Array.isArray(insight.tags) ? insight.tags : [],
    feedback:    null,
    organization_id: r.organization_id,
    transcript_text: cleanText(r.transcript_text ?? r.raw_data?.transcript_text ?? r.raw_data?.transcript) || undefined,
    recording_path: r.recording_path ?? r.record_path ?? null,
    recording_name: r.recording_name ?? r.record_name ?? null,
    record_path: r.record_path ?? r.recording_path ?? null,
    record_name: r.record_name ?? r.recording_name ?? null,
    recording_url: r.recording_url ?? null,
  };
}

function isVoicemailLike(r: any): boolean {
  const msg = cleanText(r.voicemail_message ?? r.raw_data?.voicemail_message);
  const cause = cleanText(r.hangup_cause ?? r.call_status)?.toUpperCase();
  return !!msg || !!r.missed_call || cause === 'NO_ANSWER' || cause === 'VOICEMAIL' || String(r.call_status || '').toLowerCase().includes('voicemail');
}

function hasRecordingFile(r: any): boolean {
  return !!(r.has_recording || r.recording_url || r.recording_path || r.recording_name || r.record_path || r.record_name);
}

async function bestEffortCdrSync(limit = 200) {
  if (MOCK) return;
  try {
    await call<any>(`/fn/${FN.fusionpbxProxy}`, { method: 'POST', body: JSON.stringify({ action: 'sync-cdrs', limit }) });
  } catch (err) {
    console.warn('[avaApi] sync-cdrs failed:', err);
  }
}

async function readCallRecordRows(limit = 200): Promise<any[]> {
  try {
    const raw = await call<any>(`/db/${TABLES.callRecords}?select=*&order=start_at.desc&limit=${limit}`);
    return asArray(raw);
  } catch (err) {
    console.warn('[avaApi] pbx_call_records read failed:', err);
    return [];
  }
}

function mapInsightRow(id: string, row: any): CallInsight {
  return {
    callId: id,
    summary: cleanText(row?.summary) || 'No AI insight has been generated for this call yet.',
    sentiment: cleanText(row?.sentiment) || 'neutral',
    topics: Array.isArray(row?.topics) ? row.topics : [],
    actionItems: Array.isArray(row?.action_items) ? row.action_items : (Array.isArray(row?.actionItems) ? row.actionItems : []),
    risks: Array.isArray(row?.risks) ? row.risks : [],
    opportunities: Array.isArray(row?.sales_opportunities) ? row.sales_opportunities : (Array.isArray(row?.opportunities) ? row.opportunities : []),
    qualityScore: Number(row?.quality_score ?? row?.qualityScore ?? 0),
  };
}

export const ava = {
  me: () => call<Me>(`/db/${TABLES.softphoneUsers}?select=*&limit=1`, {}, MOCK_ME),
  dashboard: () => call<DashboardBrief>(`/fn/${FN.aiAnalyzeCall}?view=dashboard`, { method: 'POST', body: JSON.stringify({ view: 'dashboard' }) }, {
    missed: 3, answered: 12, unreadSms: 5, voicemail: 2, aiActions: 4, pbxHealth: 'ok',
    brief: 'You have 3 missed calls and 2 unread voicemails requiring callbacks. One conversation flagged a renewal opportunity.',
  }),
  calls: async (limit = 50) => {
    if (MOCK) return MOCK_CALLS;
    await bestEffortCdrSync(Math.max(limit, 200));
    return (await readCallRecordRows(limit)).map(mapCdrToCall);
  },
  callDetail: (id: string) => call<any>(`/db/${TABLES.aiInsights}?call_record_id=eq.${id}&select=*&limit=1`, {}, {
    callId: id,
    summary: 'Customer asked about Q4 invoicing. Agent confirmed updated pricing and committed to sending a revised quote by Friday.',
    sentiment: 'positive', topics: ['invoicing', 'pricing', 'renewal'],
    actionItems: ['Send revised quote by Friday', 'Schedule follow-up call next week'],
    risks: [], opportunities: ['Annual renewal mentioned'],
    qualityScore: 87,
  }).then((raw: any) => MOCK ? raw as CallInsight : mapInsightRow(id, asArray(raw)[0])),
  startCall: (to: string) => call<{ callId: string }>(`/fn/${FN.fusionpbxProxy}`, { method: 'POST', body: JSON.stringify({ op: 'start_call', to }) }, { callId: 'mock' }),
  threads: () => call<SmsThread[]>(`/db/${TABLES.smsThreads}?select=*&order=last_message_at.desc`, {}, MOCK_THREADS),
  sendMessage: (threadId: string, body: string) =>
    call<{ ok: true }>(`/fn/${FN.telnyxSms}`, { method: 'POST', body: JSON.stringify({ op: 'send', threadId, body }) }, { ok: true }),
  aiRewrite: (text: string, action: 'professional' | 'shorten' | 'translate' | 'rewrite') =>
    call<{ text: string }>(`/fn/${FN.aiAnalyzeCall}`, { method: 'POST', body: JSON.stringify({ op: 'rewrite', text, action }) }, {
      text: action === 'shorten' ? text.split('.')[0] + '.' :
            action === 'professional' ? `Hi,\n\n${text}\n\nBest regards,` :
            action === 'translate' ? `[FR] ${text}` :
            `${text} — refined by AVA.`,
    }),
  generateGreeting: (prompt: string) =>
    call<{ text: string; audioUrl?: string }>(`/fn/${FN.elevenlabsGreeting}`, { method: 'POST', body: JSON.stringify({ prompt }) }, {
      text: `Thank you for calling Lemtel Communications. ${prompt}. Please hold while we connect you to the right team.`,
    }),
  /* Admin */
  extensions: () => call<any>(`/db/${TABLES.extensions}?select=*&order=extension.asc`, {}, MOCK_EXT)
    .then((raw: any) => MOCK ? raw as Extension[] : asArray(raw).map((e: any) => ({ id: e.id, extension: e.extension, displayName: e.effective_cid_name || e.extension, user: e.effective_cid_number || undefined, voicemailEnabled: !!e.voicemail_enabled, enabled: e.enabled !== false }))),
  devices: () => call<any>(`/db/pbx_devices?select=*&order=label.asc`, {}, MOCK_DEV)
    .then((raw: any) => MOCK ? raw as Device[] : asArray(raw).map((d: any) => ({ id: d.id, vendor: d.vendor || 'Device', mac: d.mac_address || '—', template: d.template || '—', registered: !!d.enabled, assignedTo: d.label || undefined }))),
  phoneNumbers: () => call<any>(`/db/pbx_phone_number_assignments?select=*&limit=100`, {}, MOCK_NUM)
    .then((raw: any) => MOCK ? raw as PhoneNumber[] : asArray(raw).map((n: any) => ({ id: n.id, number: n.phone_number || n.number || '—', assignedTo: n.extension || n.destination || '—', type: n.assignment_type || 'extension' }))),
  ivrs: () => call<any>(`/db/pbx_ivrs?select=*&order=name.asc`, {}, MOCK_IVR)
    .then((raw: any) => MOCK ? raw as Ivr[] : asArray(raw).map((i: any) => ({ id: i.id, name: i.name || 'IVR', greeting: i.greet_long || i.greet_short || '—', options: 0 }))),
  queues: () => call<any>(`/db/pbx_call_queues?select=*&order=name.asc`, {}, MOCK_QUEUES)
    .then((raw: any) => MOCK ? raw as CallQueue[] : asArray(raw).map((q: any) => ({ id: q.id, name: q.name || 'Queue', strategy: q.strategy || '—', agents: 0, waiting: 0 }))),
  ringGroups: () => call<any>(`/db/pbx_ring_groups?select=*&order=name.asc`, {}, MOCK_RG)
    .then((raw: any) => MOCK ? raw as RingGroup[] : asArray(raw).map((r: any) => ({ id: r.id, name: r.name || 'Ring Group', members: 0, strategy: r.strategy || '—' }))),
  /* Phase 3 */
  voicemails: async () => {
    if (MOCK) return SAMPLE_VOICEMAIL_EMPTY;
    await bestEffortCdrSync(200);
    try {
      const rows = await readCallRecordRows(200);
      return rows.filter(isVoicemailLike).map(mapCdrToVoicemail);
    } catch (err) {
      console.warn('[avaApi] voicemail mapping failed:', err);
      return [] as VoicemailItem[];
    }
  },
  markVoicemailRead: (id: string) =>
    call<{ ok: true }>(`/fn/${FN.fusionpbxProxy}`, { method: 'POST', body: JSON.stringify({ action: 'voicemail-read', id }) }, { ok: true }).catch(() => ({ ok: true as const })),
  recordings: async () => {
    if (MOCK) return SAMPLE_RECORDING_EMPTY;
    await bestEffortCdrSync(200);
    try {
      const rows = await readCallRecordRows(200);
      return rows.filter(hasRecordingFile).map(mapCdrToRecording);
    } catch (err) {
      console.warn('[avaApi] recording mapping failed:', err);
      return [] as RecordingItem[];
    }
  },
  getRecordingAudioUrl: async (recording: Partial<RecordingItem & VoicemailItem & CallRecord & { record_path?: string | null; record_name?: string | null }>) => {
    const direct = cleanText(recording.recording_url);
    if (direct) return direct;
    const record_path = cleanText(recording.record_path ?? recording.recording_path);
    const record_name = cleanText(recording.record_name ?? recording.recording_name);
    if (!record_path || !record_name) return null;
    try {
      const res = await fetch(resolveUrl(`/fn/${FN.fusionpbxProxy}`), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'get-recording', params: { record_path, record_name } }),
      });
      if (!res.ok) throw new Error(`Recording unavailable (${res.status})`);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn('[avaApi] get-recording failed:', err);
      return null;
    }
  },
  contacts: () => call<ContactItem[]>(`/db/${TABLES.softphoneUsers}?select=*&order=last_interaction.desc`, {}, MOCK_CONTACTS),
  /* Phase 3.1 — AI feedback + lifecycle */
  regenerateSummary: (kind: 'voicemail' | 'recording', id: string, sourceText?: string) =>
    call<{ summary: string }>(`/fn/${FN.aiAnalyzeCall}`, { method: 'POST', body: JSON.stringify({ op: 'regenerate_summary', kind, id, sourceText }) }, {
      summary: sourceText
        ? `AVA v2 · ${sourceText.split(/[.!?]/)[0].trim()}. Key points refined and prioritized for action.`
        : `AVA regenerated this summary with the latest model and tone refinements.`,
    }),
  submitSummaryFeedback: (kind: 'voicemail' | 'recording', id: string, feedback: Feedback) =>
    call<{ ok: true }>(`/fn/${FN.aiAnalyzeCall}`, { method: 'POST', body: JSON.stringify({ op: 'summary_feedback', kind, id, feedback }) }, { ok: true }),
  setVoicemailPriority: (id: string, priority: VoicemailItem['priority']) =>
    call<{ ok: true }>(`/fn/${FN.fusionpbxProxy}`, { method: 'POST', body: JSON.stringify({ action: 'voicemail-priority', id, priority }) }, { ok: true }).catch(() => ({ ok: true as const })),
  markVoicemailHandled: (id: string, handled: boolean) =>
    call<{ ok: true }>(`/fn/${FN.fusionpbxProxy}`, { method: 'POST', body: JSON.stringify({ action: 'voicemail-handled', id, handled }) }, { ok: true }).catch(() => ({ ok: true as const })),
  exportRecordings: (ids: string[]) =>
    call<{ ok: true; count: number; url: string }>(`/fn/${FN.fusionpbxProxy}`, { method: 'POST', body: JSON.stringify({ action: 'export-recordings', ids }) }, {
      ok: true, count: ids.length, url: `https://ava.local/exports/recordings-${Date.now()}.zip`,
    }).catch(() => ({ ok: true as const, count: 0, url: 'PBX export unavailable' })),
  updateContact: (id: string, patch: Partial<Pick<ContactItem, 'notes' | 'tags' | 'favorite'>>) =>
    call<{ ok: true }>(`/db/${TABLES.softphoneUsers}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: { Prefer: 'return=minimal' } }, { ok: true }),
  syncStatus: () => call<{ lastSync: string; status: 'ok' | 'error'; jobs: { kind: string; finishedAt: string; ok: boolean }[] }>(`/fn/${FN.fusionpbxProxy}`, { method: 'POST', body: JSON.stringify({ action: 'sync_status' }) }, {
    lastSync: new Date(Date.now() - 600e3).toISOString(),
    status: 'ok',
    jobs: [
      { kind: 'extensions', finishedAt: new Date(Date.now()-600e3).toISOString(), ok: true },
      { kind: 'cdr', finishedAt: new Date(Date.now()-900e3).toISOString(), ok: true },
      { kind: 'devices', finishedAt: new Date(Date.now()-1800e3).toISOString(), ok: true },
    ],
  }),
  syncPhoneSystemFull: async () => {
    if (MOCK) return { ok: true, success: true, stats: { cdrs: MOCK_CALLS.length }, errors: [], syncedAt: new Date().toISOString() };
    try {
      const data = await call<any>(`/fn/${FN.fusionpbxProxy}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'sync-all', resources: ['cdrs', 'extensions', 'queues', 'ivrs', 'ring_groups'] }),
      });
      return { ok: data?.success !== false && !data?.error, success: data?.success !== false, stats: data?.stats || {}, errors: data?.errors || (data?.error ? [data.error] : []), syncedAt: new Date().toISOString(), raw: data };
    } catch (err: any) {
      console.warn('[avaApi] sync-all failed:', err);
      return { ok: false, success: false, stats: {}, errors: [err?.message || 'Phone-system sync failed'], syncedAt: new Date().toISOString() };
    }
  },
};

/* ─── Initialisation du token depuis la session Supabase ───── */
import { supabase as _sb } from './supabaseClient';
(async () => {
  const { data: { session } } = await _sb.auth.getSession();
  if (session?.access_token) setAuthToken(session.access_token);
  _sb.auth.onAuthStateChange((_ev, s) => setAuthToken(s?.access_token ?? null));
})();

