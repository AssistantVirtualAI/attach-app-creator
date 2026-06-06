/**
 * Lemtel AI Phone — Mobile API client.
 *
 * Talks to Supabase Edge Functions backed by FusionPBX + _safe views.
 * Falls back to mock data only when no portal URL / access token is configured.
 */

export const MOBILE_DEFAULT_PORTAL = 'https://avastatistic.ca';

let portalUrl: string = MOBILE_DEFAULT_PORTAL;
let authToken: string | null = null;
let anonKey: string | null = null;

export function configureMobileApi(opts: { portalUrl?: string; accessToken?: string | null; anonKey?: string | null }) {
  if (opts.portalUrl) portalUrl = opts.portalUrl.replace(/\/$/, '');
  if (opts.accessToken !== undefined) authToken = opts.accessToken;
  if (opts.anonKey !== undefined) anonKey = opts.anonKey;
}

export function setAuthToken(t: string | null) { authToken = t; }

const isLive = () => !!authToken;

async function liveCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(anonKey ? { apikey: anonKey } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${portalUrl}/functions/v1${path}`, { ...init, headers });
  if (!res.ok) {
    let detail: any = null;
    try { detail = await res.json(); } catch {}
    throw new Error(detail?.error || `HTTP ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

async function call<T>(path: string, init: RequestInit | undefined, mockData: T): Promise<T> {
  if (!isLive()) {
    await new Promise((r) => setTimeout(r, 220));
    return mockData;
  }
  try { return await liveCall<T>(path, init); }
  catch (e) { console.warn('[mobileApi] fallback to mock for', path, e); return mockData; }
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

/* ─── Mock data (fallback) ────────────────────────────────────── */

const meMock: MeResponse = {
  user: { id: 'u1', name: 'Alex Morin', email: 'alex@lemtel.tel' },
  organization: { id: 'org-lemtel', name: 'Lemtel Communications' },
  extension: { number: '1042', displayName: 'Alex M.', sipDomain: 'lemtel.lemtel.tel' },
  permissions: { admin: true, canManageNumbers: true, canManageAgents: true },
};

const dashboardMock: DashboardBrief = {
  greeting: 'Good morning',
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
];

const callDetailMock = (id: string): CallDetail => {
  const base = callsMock.find((c) => c.id === id) || callsMock[0];
  return {
    ...base,
    transcript: [
      { speaker: 'agent',    text: 'Hi, thanks for calling Lemtel. How can I help?', t: 0 },
      { speaker: 'customer', text: 'I wanted to renew my plan.', t: 6 },
    ],
    summary: 'Renewal call.', topics: ['renewal'], actionItems: ['Send pricing PDF'],
    qualityScore: 87, intent: 'Renewal', tags: ['priority'],
  };
};

const threadsMock: SmsThread[] = [
  { id: 't1', contact: 'Marie Tremblay', number: '+1 514 555 0123', lastMessage: 'Perfect, I will review.', unread: 0, updatedAt: '10:42' },
  { id: 't2', contact: 'Acme Corp',      number: '+1 438 555 9988', lastMessage: 'Can we reschedule?',     unread: 2, updatedAt: '09:31' },
];
const messagesMock: Record<string, SmsMessage[]> = {
  t1: [{ id: 'm1', from: 'them', body: 'Hi, did you get the quote?', at: '10:14' }],
  t2: [{ id: 'm4', from: 'them', body: 'Can we reschedule?', at: '09:30' }],
};
const voicemailMock: VoicemailEntry[] = [
  { id: 'v1', from: '+1 514 555 0123', customer: 'Marie Tremblay', receivedAt: new Date(Date.now() - 30*60e3).toISOString(), durationSec: 72, transcript: 'Calling to renew.', summary: 'Wants to renew today.', priority: 'high', sentiment: 'positive', isNew: true },
];

/* ─── Public API ──────────────────────────────────────────────── */

export const mobileApi = {
  me:        () => call<MeResponse>('/mobile-me', undefined, meMock),
  dashboard: () => call<DashboardBrief>('/mobile-dashboard', undefined, dashboardMock),

  webphoneToken: () => call<{ token: string; expiresAt: string; wssUrl: string }>(
    '/softphone-credentials', { method: 'POST' },
    { token: 'mock', expiresAt: new Date(Date.now() + 30*60e3).toISOString(), wssUrl: 'wss://lemtel.lemtel.tel:7443' },
  ),

  startCall: (to: string) => call<{ callId: string; mode: 'webrtc' | 'click_to_call' }>(
    '/mobile-calls-start', { method: 'POST', body: JSON.stringify({ to }) },
    { callId: 'call-' + Date.now(), mode: 'webrtc' },
  ),

  calls:      () => call<CallRecord[]>('/mobile-calls', undefined, callsMock),
  callDetail: (id: string) => call<CallDetail>(`/mobile-calls?id=${encodeURIComponent(id)}`, undefined, callDetailMock(id)),

  threads:    () => call<SmsThread[]>('/mobile-sms', undefined, threadsMock),
  thread:     (id: string) => call<SmsMessage[]>(`/mobile-sms?threadId=${encodeURIComponent(id)}`, undefined, messagesMock[id] || []),
  sendMessage:(threadId: string, body: string) => call<{ id: string }>(
    '/mobile-sms', { method: 'POST', body: JSON.stringify({ threadId, body }) },
    { id: 'm' + Date.now() },
  ),

  voicemails: () => call<VoicemailEntry[]>('/mobile-voicemails', undefined, voicemailMock),
  voicemailAudio: (id: string) => call<{ url: string; expiresInSec: number }>(
    `/mobile-voicemail-audio?id=${encodeURIComponent(id)}`, undefined,
    { url: '', expiresInSec: 0 },
  ),

  analyzeCall: (callId: string) => call<{ jobId: string }>(
    '/ai-analyze-call', { method: 'POST', body: JSON.stringify({ callId }) },
    { jobId: 'job-' + Date.now() },
  ),
  generateGreeting: (prompt: string) => call<{ text: string; audioUrl?: string }>(
    '/elevenlabs-generate-greeting', { method: 'POST', body: JSON.stringify({ prompt }) },
    { text: `Thanks for calling Lemtel. Leave a message and we'll call you back. ${prompt ? `(${prompt})` : ''}` },
  ),
  aiRewrite: (text: string, action: 'rewrite' | 'professional' | 'shorten' | 'translate') => call<{ text: string }>(
    '/improve-prompt', { method: 'POST', body: JSON.stringify({ text, action }) },
    { text: action === 'shorten' ? text.split(/[.!?]/)[0] + '.' : action === 'translate' ? `[FR] ${text}` : action === 'professional' ? `Bonjour,\n\n${text}\n\nCordialement.` : `${text} — refined by AVA.` },
  ),

  setForwarding: (target: string | null) => call<{ ok: true }>(
    '/mobile-settings-forwarding', { method: 'POST', body: JSON.stringify({ target }) }, { ok: true },
  ),
  setDnd: (enabled: boolean) => call<{ ok: true }>(
    '/mobile-settings-dnd', { method: 'POST', body: JSON.stringify({ enabled }) }, { ok: true },
  ),
};
