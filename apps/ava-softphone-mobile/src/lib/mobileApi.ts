/**
 * Lemtel AI Phone — Mobile API client.
 *
 * Backend: AVA backend (currently mocked). All sensitive PBX/SIP/SMS/
 * ElevenLabs/FusionPBX operations live behind these endpoints — never call
 * FusionPBX/Telnyx/ElevenLabs directly from the mobile app.
 *
 * Routes:
 *   GET  /mobile/me
 *   GET  /mobile/dashboard
 *   POST /mobile/webphone/token
 *   POST /mobile/calls/start
 *   GET  /mobile/calls
 *   GET  /mobile/calls/:id
 *   GET  /mobile/messages/threads
 *   POST /mobile/messages/send
 *   POST /mobile/ai/analyze-call
 *   POST /mobile/ai/generate-greeting
 *   POST /mobile/settings/forwarding
 *   POST /mobile/settings/dnd
 */

export const AVA_API_BASE_URL =
  (import.meta as any).env?.VITE_AVA_API_BASE_URL ||
  'https://your-ava-backend.example.com';

export const MOCK = true;

let authToken: string | null = null;
export function setAuthToken(t: string | null) { authToken = t; }

async function call<T>(path: string, init: RequestInit = {}, mockData?: T): Promise<T> {
  if (MOCK && mockData !== undefined) {
    await new Promise((r) => setTimeout(r, 240));
    return mockData;
  }
  const res = await fetch(`${AVA_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`AVA ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

/* ─── Types ───────────────────────────────────────────────────── */

export interface MeResponse {
  user: { id: string; name: string; email: string; avatarUrl?: string };
  organization: { id: string; name: string };
  client?: { id: string; name: string };
  extension: { number: string; displayName: string; sipDomain: string };
  permissions: { admin: boolean; canManageNumbers: boolean; canManageAgents: boolean };
}

export interface DashboardBrief {
  greeting: string;
  brief: string;
  metrics: { missedCalls: number; answeredCalls: number; unreadSms: number; voicemails: number; actionItems: number };
  needsAttention: { id: string; kind: 'follow_up' | 'callback' | 'voicemail' | 'unread'; title: string; subtitle: string; accent: 'gold' | 'cyan' | 'violet' | 'danger' }[];
  status: { sipState: 'registered' | 'connecting' | 'offline'; doNotDisturb: boolean; forwarding: string | null };
}

export interface CallRecord {
  id: string;
  direction: 'in' | 'out';
  status: 'answered' | 'missed' | 'voicemail';
  from: string;
  to: string;
  customer?: string;
  startedAt: string;
  durationSec: number;
  hasRecording: boolean;
  hasTranscript: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface CallDetail extends CallRecord {
  transcript: { speaker: 'agent' | 'customer'; text: string; t: number }[];
  summary: string;
  topics: string[];
  actionItems: string[];
  qualityScore: number;
  intent: string;
  tags: string[];
}

export interface SmsThread { id: string; contact: string; number: string; lastMessage: string; unread: number; updatedAt: string }
export interface SmsMessage { id: string; from: 'me' | 'them'; body: string; at: string }

export interface VoicemailEntry {
  id: string; from: string; customer?: string; receivedAt: string;
  durationSec: number; transcript: string; summary: string;
  priority: 'low' | 'normal' | 'high'; sentiment: 'positive' | 'neutral' | 'negative';
  isNew: boolean;
}

/* ─── Mock data ───────────────────────────────────────────────── */

const meMock: MeResponse = {
  user: { id: 'u1', name: 'Alex Morin', email: 'alex@lemtel.tel' },
  organization: { id: 'org-lemtel', name: 'Lemtel Communications' },
  extension: { number: '1042', displayName: 'Alex M.', sipDomain: 'lemtel.lemtel.tel' },
  permissions: { admin: true, canManageNumbers: true, canManageAgents: true },
};

const dashboardMock: DashboardBrief = {
  greeting: 'Good morning, Alex',
  brief: 'You have 3 missed calls, 2 voicemails, and 4 unread messages. AVA flagged 2 follow-ups worth your attention.',
  metrics: { missedCalls: 3, answeredCalls: 12, unreadSms: 4, voicemails: 2, actionItems: 5 },
  needsAttention: [
    { id: 'a1', kind: 'voicemail', title: 'Marie Tremblay left a voicemail', subtitle: 'Renewal — high priority · 1m 12s', accent: 'gold' },
    { id: 'a2', kind: 'callback', title: 'Callback Acme Corp', subtitle: 'Wants to reschedule demo', accent: 'cyan' },
    { id: 'a3', kind: 'follow_up', title: 'Send pricing PDF', subtitle: 'Detected in call #4821', accent: 'violet' },
  ],
  status: { sipState: 'registered', doNotDisturb: false, forwarding: null },
};

const callsMock: CallRecord[] = [
  { id: 'c1', direction: 'in',  status: 'answered',  from: '+1 514 555 0123', to: '+1 514 555 0100', customer: 'Marie Tremblay', startedAt: new Date(Date.now() - 36e5).toISOString(),    durationSec: 245, hasRecording: true,  hasTranscript: true,  sentiment: 'positive' },
  { id: 'c2', direction: 'out', status: 'answered',  from: '+1 514 555 0100', to: '+1 438 555 9988', customer: 'Acme Corp',       startedAt: new Date(Date.now() - 5*36e5).toISOString(),  durationSec: 412, hasRecording: true,  hasTranscript: true,  sentiment: 'neutral'  },
  { id: 'c3', direction: 'in',  status: 'missed',    from: '+1 514 555 7711', to: '+1 514 555 0100',                              startedAt: new Date(Date.now() - 8*36e5).toISOString(),  durationSec: 0,   hasRecording: false, hasTranscript: false                          },
  { id: 'c4', direction: 'in',  status: 'voicemail', from: '+1 438 555 6612', to: '+1 514 555 0100', customer: 'Vincent K.',      startedAt: new Date(Date.now() - 26*36e5).toISOString(), durationSec: 72,  hasRecording: true,  hasTranscript: true,  sentiment: 'negative' },
  { id: 'c5', direction: 'out', status: 'answered',  from: '+1 514 555 0100', to: '+1 514 555 0044', customer: 'Sophie B.',       startedAt: new Date(Date.now() - 50*36e5).toISOString(), durationSec: 188, hasRecording: false, hasTranscript: false, sentiment: 'positive' },
];

const callDetailMock = (id: string): CallDetail => {
  const base = callsMock.find((c) => c.id === id) || callsMock[0];
  return {
    ...base,
    transcript: [
      { speaker: 'agent',    text: 'Hi Marie, thanks for calling Lemtel. How can I help?', t: 0 },
      { speaker: 'customer', text: 'I wanted to renew my plan and ask about the new AI features.', t: 6 },
      { speaker: 'agent',    text: 'Great — let me walk you through the AVA call intelligence add-on.', t: 14 },
      { speaker: 'customer', text: 'Perfect. Can you send pricing in writing?', t: 42 },
      { speaker: 'agent',    text: 'Absolutely, I will email a PDF right after the call.', t: 48 },
    ],
    summary: 'Renewal call. Customer interested in AVA add-on. Requested pricing PDF follow-up by email today.',
    topics: ['renewal', 'AVA add-on', 'pricing'],
    actionItems: ['Send pricing PDF', 'Schedule onboarding call for next week'],
    qualityScore: 87,
    intent: 'Renewal · expansion',
    tags: ['priority', 'expansion'],
  };
};

const threadsMock: SmsThread[] = [
  { id: 't1', contact: 'Marie Tremblay', number: '+1 514 555 0123', lastMessage: 'Perfect, I will review the quote tonight.', unread: 0, updatedAt: '10:42' },
  { id: 't2', contact: 'Acme Corp',      number: '+1 438 555 9988', lastMessage: 'Can we reschedule to Thursday?',           unread: 2, updatedAt: '09:31' },
  { id: 't3', contact: 'Sophie B.',      number: '+1 514 555 0044', lastMessage: 'Thanks for the call earlier.',             unread: 1, updatedAt: 'Yesterday' },
];

const messagesMock: Record<string, SmsMessage[]> = {
  t1: [
    { id: 'm1', from: 'them', body: 'Hi, did you get the updated quote?', at: '10:14' },
    { id: 'm2', from: 'me',   body: 'Yes, sending the revised version this afternoon.', at: '10:16' },
    { id: 'm3', from: 'them', body: "Perfect, I'll review the quote tonight.", at: '10:42' },
  ],
  t2: [
    { id: 'm4', from: 'them', body: 'Can we reschedule to Thursday?', at: '09:30' },
    { id: 'm5', from: 'them', body: 'Same time works for us.', at: '09:31' },
  ],
  t3: [{ id: 'm6', from: 'them', body: 'Thanks for the call earlier.', at: 'Yesterday' }],
};

const voicemailMock: VoicemailEntry[] = [
  { id: 'v1', from: '+1 514 555 0123', customer: 'Marie Tremblay', receivedAt: new Date(Date.now() - 30*60e3).toISOString(), durationSec: 72, transcript: 'Hi Alex, calling to renew — please call back today.', summary: 'Wants to renew today. High priority.', priority: 'high',   sentiment: 'positive', isNew: true  },
  { id: 'v2', from: '+1 438 555 6612', customer: 'Vincent K.',     receivedAt: new Date(Date.now() - 26*36e5).toISOString(),  durationSec: 41, transcript: 'Frustrated about billing issue.',                            summary: 'Billing complaint. Negative sentiment.', priority: 'normal', sentiment: 'negative', isNew: true  },
];

/* ─── Public API ──────────────────────────────────────────────── */

export const mobileApi = {
  me:        () => call<MeResponse>('/mobile/me', {}, meMock),
  dashboard: () => call<DashboardBrief>('/mobile/dashboard', {}, dashboardMock),

  webphoneToken: () => call<{ token: string; expiresAt: string; wssUrl: string }>(
    '/mobile/webphone/token', { method: 'POST' },
    { token: 'short-lived-mock', expiresAt: new Date(Date.now() + 30*60e3).toISOString(), wssUrl: 'wss://lemtel.lemtel.tel:7443' },
  ),

  startCall: (to: string) => call<{ callId: string; mode: 'webrtc' | 'click_to_call' }>(
    '/mobile/calls/start', { method: 'POST', body: JSON.stringify({ to }) },
    { callId: 'call-' + Date.now(), mode: 'webrtc' },
  ),

  calls:      () => call<CallRecord[]>('/mobile/calls', {}, callsMock),
  callDetail: (id: string) => call<CallDetail>(`/mobile/calls/${id}`, {}, callDetailMock(id)),

  threads:    () => call<SmsThread[]>('/mobile/messages/threads', {}, threadsMock),
  thread:     (id: string) => call<SmsMessage[]>(`/mobile/messages/threads/${id}`, {}, messagesMock[id] || []),
  sendMessage:(threadId: string, body: string) => call<{ id: string }>(
    '/mobile/messages/send', { method: 'POST', body: JSON.stringify({ threadId, body }) },
    { id: 'm' + Date.now() },
  ),

  voicemails: () => call<VoicemailEntry[]>('/mobile/voicemails', {}, voicemailMock),

  analyzeCall: (callId: string) => call<{ jobId: string }>(
    '/mobile/ai/analyze-call', { method: 'POST', body: JSON.stringify({ callId }) },
    { jobId: 'job-' + Date.now() },
  ),
  generateGreeting: (prompt: string) => call<{ text: string; audioUrl?: string }>(
    '/mobile/ai/generate-greeting', { method: 'POST', body: JSON.stringify({ prompt }) },
    { text: `Thanks for calling Lemtel. Our team is helping other customers right now — leave a message and we'll call you back shortly. ${prompt ? `(${prompt})` : ''}` },
  ),
  aiRewrite: (text: string, action: 'rewrite' | 'professional' | 'shorten' | 'translate') => call<{ text: string }>(
    '/mobile/ai/rewrite', { method: 'POST', body: JSON.stringify({ text, action }) },
    { text: action === 'shorten' ? text.split(/[.!?]/)[0] + '.' : action === 'translate' ? `[FR] ${text}` : action === 'professional' ? `Bonjour,\n\n${text}\n\nCordialement.` : `${text} — refined by AVA.` },
  ),

  setForwarding: (target: string | null) => call<{ ok: true }>(
    '/mobile/settings/forwarding', { method: 'POST', body: JSON.stringify({ target }) }, { ok: true },
  ),
  setDnd: (enabled: boolean) => call<{ ok: true }>(
    '/mobile/settings/dnd', { method: 'POST', body: JSON.stringify({ enabled }) }, { ok: true },
  ),
};
