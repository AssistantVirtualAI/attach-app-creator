/**
 * AVA Desktop API Client — Phase 2
 * Production-shaped, mock-backed. Swap `MOCK` to false and set AVA_API_BASE_URL
 * to route through the AVA backend (which proxies FusionPBX, ElevenLabs, etc.).
 * No PBX/SIP/SMS secrets ever live in the desktop app.
 */

export const MOCK = true;
const BASE = (import.meta as any).env?.VITE_AVA_API_BASE_URL || '';

async function call<T>(path: string, init: RequestInit = {}, mockData?: T): Promise<T> {
  if (MOCK && mockData !== undefined) {
    await new Promise((r) => setTimeout(r, 180));
    return mockData;
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`AVA ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

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

export interface VoicemailItem {
  id: string; from: string; customer?: string; receivedAt: string;
  durationSec: number; isNew: boolean; transcript: string;
  summary: string; sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'low' | 'normal' | 'high';
}
export interface RecordingItem {
  id: string; callId: string; from: string; to: string; customer?: string;
  recordedAt: string; durationSec: number; sizeKb: number;
  qualityScore: number; sentiment: 'positive' | 'neutral' | 'negative';
  summary: string; topics: string[]; tags: string[];
}
export interface ContactItem {
  id: string; name: string; company?: string; phone: string; email?: string;
  lastInteraction: string; totalCalls: number; totalMessages: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  aiNote: string; tags: string[]; favorite: boolean;
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

const MOCK_VM: VoicemailItem[] = [
  { id: 'v1', from: '+15145550101', customer: 'Marie Tremblay', receivedAt: new Date(Date.now()-1800e3).toISOString(), durationSec: 42, isNew: true, transcript: 'Hi, this is Marie. Just calling to confirm our meeting on Thursday at 2pm. Please call me back to confirm. Thanks!', summary: 'Marie confirms Thursday 2pm meeting and asks for callback confirmation.', sentiment: 'positive', priority: 'high' },
  { id: 'v2', from: '+14385550199', customer: 'Acme Corp', receivedAt: new Date(Date.now()-7200e3).toISOString(), durationSec: 28, isNew: true, transcript: 'Hello, we need an update on the proposal. Can you call us back today?', summary: 'Acme Corp requesting proposal update, urgent callback today.', sentiment: 'neutral', priority: 'high' },
  { id: 'v3', from: '+15145550141', receivedAt: new Date(Date.now()-86400e3).toISOString(), durationSec: 15, isNew: false, transcript: 'Sorry, wrong number.', summary: 'Wrong number — no action needed.', sentiment: 'neutral', priority: 'low' },
  { id: 'v4', from: '+15145550182', customer: 'Jean-Luc Roy', receivedAt: new Date(Date.now()-172800e3).toISOString(), durationSec: 67, isNew: false, transcript: 'Bonjour, I was disappointed by the last support call. Please contact me to discuss.', summary: 'Customer complaint regarding recent support interaction.', sentiment: 'negative', priority: 'high' },
];

const MOCK_RECORDINGS: RecordingItem[] = [
  { id: 'rec1', callId: 'c1', from: '+15145550182', to: '301', customer: 'Marie Tremblay', recordedAt: new Date(Date.now()-3600e3).toISOString(), durationSec: 245, sizeKb: 980, qualityScore: 92, sentiment: 'positive', summary: 'Customer confirmed renewal pricing and requested quote by Friday.', topics: ['renewal', 'pricing', 'quote'], tags: ['sales', 'follow-up'] },
  { id: 'rec2', callId: 'c3', from: '301', to: '+15145550141', recordedAt: new Date(Date.now()-10800e3).toISOString(), durationSec: 612, sizeKb: 2450, qualityScore: 78, sentiment: 'neutral', summary: 'Discovery call covering technical requirements for integration.', topics: ['integration', 'API', 'requirements'], tags: ['discovery'] },
  { id: 'rec3', callId: 'c4', from: '+15145550101', to: '301', customer: 'Jean-Luc Roy', recordedAt: new Date(Date.now()-14400e3).toISOString(), durationSec: 38, sizeKb: 150, qualityScore: 41, sentiment: 'negative', summary: 'Customer expressed frustration about support response time.', topics: ['support', 'complaint'], tags: ['escalation'] },
  { id: 'rec4', callId: 'c5', from: '+14385550120', to: '302', customer: 'Sophie Beaulieu', recordedAt: new Date(Date.now()-432000e3).toISOString(), durationSec: 184, sizeKb: 730, qualityScore: 88, sentiment: 'positive', summary: 'Onboarding session completed successfully.', topics: ['onboarding', 'training'], tags: ['success'] },
];

const MOCK_CONTACTS: ContactItem[] = [
  { id: 'k1', name: 'Marie Tremblay', company: 'Tremblay & Co', phone: '+15145550182', email: 'marie@tremblay.co', lastInteraction: new Date(Date.now()-3600e3).toISOString(), totalCalls: 14, totalMessages: 23, sentiment: 'positive', aiNote: 'High-value account, renewal due in 30 days. Prefers email follow-ups.', tags: ['vip', 'renewal'], favorite: true },
  { id: 'k2', name: 'Acme Corp', company: 'Acme Corp', phone: '+14385550199', email: 'ops@acme.com', lastInteraction: new Date(Date.now()-7200e3).toISOString(), totalCalls: 8, totalMessages: 11, sentiment: 'neutral', aiNote: 'Proposal pending. Decision maker is responsive between 9am-11am.', tags: ['prospect'], favorite: false },
  { id: 'k3', name: 'Jean-Luc Roy', phone: '+15145550101', lastInteraction: new Date(Date.now()-14400e3).toISOString(), totalCalls: 3, totalMessages: 2, sentiment: 'negative', aiNote: 'Recent complaint about support — recommend manager outreach.', tags: ['at-risk'], favorite: false },
  { id: 'k4', name: 'Sophie Beaulieu', company: 'Beaulieu Studio', phone: '+14385550120', email: 'sophie@beaulieu.studio', lastInteraction: new Date(Date.now()-432000e3).toISOString(), totalCalls: 6, totalMessages: 9, sentiment: 'positive', aiNote: 'Recently onboarded, opportunity to upsell premium plan in Q3.', tags: ['onboarded', 'upsell'], favorite: true },
];

/* ---------- API surface ---------- */
export const ava = {
  me: () => call<Me>('/desktop/me', {}, MOCK_ME),
  dashboard: () => call<DashboardBrief>('/desktop/dashboard', {}, {
    missed: 3, answered: 12, unreadSms: 5, voicemail: 2, aiActions: 4, pbxHealth: 'ok',
    brief: 'You have 3 missed calls and 2 unread voicemails requiring callbacks. One conversation flagged a renewal opportunity.',
  }),
  calls: (limit = 50) => call<CallRecord[]>(`/desktop/calls?limit=${limit}`, {}, MOCK_CALLS),
  callDetail: (id: string) => call<CallInsight>(`/desktop/calls/${id}`, {}, {
    callId: id,
    summary: 'Customer asked about Q4 invoicing. Agent confirmed updated pricing and committed to sending a revised quote by Friday.',
    sentiment: 'positive', topics: ['invoicing', 'pricing', 'renewal'],
    actionItems: ['Send revised quote by Friday', 'Schedule follow-up call next week'],
    risks: [], opportunities: ['Annual renewal mentioned'],
    qualityScore: 87,
  }),
  startCall: (to: string) => call<{ callId: string }>('/desktop/calls/start', { method: 'POST', body: JSON.stringify({ to }) }, { callId: 'mock' }),
  threads: () => call<SmsThread[]>('/desktop/messages/threads', {}, MOCK_THREADS),
  sendMessage: (threadId: string, body: string) => call<{ ok: true }>('/desktop/messages/send', { method: 'POST', body: JSON.stringify({ threadId, body }) }, { ok: true }),
  aiRewrite: (text: string, action: 'professional' | 'shorten' | 'translate' | 'rewrite') =>
    call<{ text: string }>('/desktop/ai/rewrite', { method: 'POST', body: JSON.stringify({ text, action }) }, {
      text: action === 'shorten' ? text.split('.')[0] + '.' :
            action === 'professional' ? `Hi,\n\n${text}\n\nBest regards,` :
            action === 'translate' ? `[FR] ${text}` :
            `${text} — refined by AVA.`,
    }),
  generateGreeting: (prompt: string) => call<{ text: string; audioUrl?: string }>('/desktop/ai/generate-greeting', { method: 'POST', body: JSON.stringify({ prompt }) }, {
    text: `Thank you for calling Lemtel Communications. ${prompt}. Please hold while we connect you to the right team.`,
  }),
  /* Admin */
  extensions: () => call<Extension[]>('/desktop/admin/extensions', {}, MOCK_EXT),
  devices: () => call<Device[]>('/desktop/admin/devices', {}, MOCK_DEV),
  phoneNumbers: () => call<PhoneNumber[]>('/desktop/admin/phone-numbers', {}, MOCK_NUM),
  ivrs: () => call<Ivr[]>('/desktop/admin/ivrs', {}, MOCK_IVR),
  queues: () => call<CallQueue[]>('/desktop/admin/queues', {}, MOCK_QUEUES),
  ringGroups: () => call<RingGroup[]>('/desktop/admin/ring-groups', {}, MOCK_RG),
  /* Phase 3 */
  voicemails: () => call<VoicemailItem[]>('/desktop/voicemails', {}, MOCK_VM),
  markVoicemailRead: (id: string) => call<{ ok: true }>(`/desktop/voicemails/${id}/read`, { method: 'POST' }, { ok: true }),
  recordings: () => call<RecordingItem[]>('/desktop/recordings', {}, MOCK_RECORDINGS),
  contacts: () => call<ContactItem[]>('/desktop/contacts', {}, MOCK_CONTACTS),
  syncStatus: () => call<{ lastSync: string; status: 'ok' | 'error'; jobs: { kind: string; finishedAt: string; ok: boolean }[] }>('/desktop/admin/sync', {}, {
    lastSync: new Date(Date.now() - 600e3).toISOString(),
    status: 'ok',
    jobs: [
      { kind: 'extensions', finishedAt: new Date(Date.now()-600e3).toISOString(), ok: true },
      { kind: 'cdr', finishedAt: new Date(Date.now()-900e3).toISOString(), ok: true },
      { kind: 'devices', finishedAt: new Date(Date.now()-1800e3).toISOString(), ok: true },
    ],
  }),
};
