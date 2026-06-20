/**
 * Lemtel AI Phone Desktop — runtime config & backend wiring.
 *
 * The desktop app is a thin client. ALL credentials and PBX/SIP/SMS API keys
 * live server-side in Supabase Edge Functions. This file centralizes the
 * concrete backend, table, function, and SIP coordinates used by the app.
 */

/* ---------- Supabase backend ---------- */
export const BACKEND = {
  projectRef: 'gejxisrqtvxavbrfcoxz',
  url: 'https://gejxisrqtvxavbrfcoxz.supabase.co',
  anonKey:
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo',
} as const;

/* ---------- Database tables (read via PostgREST / SDK) ---------- */
export const TABLES = {
  callRecords: 'pbx_call_records',
  extensions: 'pbx_extensions',
  aiInsights: 'pbx_ai_insights',
  smsThreads: 'pbx_sms_threads',
  smsMessages: 'pbx_sms_messages',
  softphoneUsers: 'pbx_softphone_users',
} as const;

/* ---------- Edge Functions ---------- */
export const FN = {
  fusionpbxProxy: 'fusionpbx-proxy',
  aiAnalyzeCall: 'ai-analyze-call',
  telnyxSms: 'telnyx-sms',
  elevenlabsGreeting: 'elevenlabs-generate-greeting',
  softphoneCredentials: 'softphone-credentials',
} as const;

/* ---------- SIP / WebRTC (Lemtel) ---------- */
export const SIP = {
  domain: 'lemtel.lemtel.tel',
  wssUrl: 'wss://node.lemtelcloud.net:7443',
  userAgent: 'Lemtel AI Phone Desktop',
  // Auth: NEVER hardcode SIP passwords. Fetch from softphone-credentials
  // Edge Function which validates the Supabase JWT and returns short-lived
  // creds for the calling user's extension only.
  credentialsFn: 'softphone-credentials',
} as const;

/* ---------- Helpers ---------- */
export function fnUrl(name: string) {
  return `${BACKEND.url}/functions/v1/${name}`;
}

export interface SoftphoneCredentialsResponse {
  extension: string;
  password: string;
  displayName: string;
  sipDomain: string;
  wssUrl: string;
  expiresAt: string;
}

/**
 * Exchange a Supabase access token for short-lived SIP credentials.
 * Calls the `softphone-credentials` Edge Function. Backend MUST scope the
 * response to the authenticated user only.
 */
export async function fetchSoftphoneCredentials(
  accessToken: string,
): Promise<SoftphoneCredentialsResponse> {
  const res = await fetch(fnUrl(SIP.credentialsFn), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: BACKEND.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`softphone-credentials ${res.status}`);
  }
  const data = (await res.json()) as Partial<SoftphoneCredentialsResponse>;
  // Backfill defaults so callers can rely on a complete config.
  return {
    extension: data.extension!,
    password: data.password!,
    displayName: data.displayName || data.extension!,
    sipDomain: data.sipDomain || SIP.domain,
    wssUrl: data.wssUrl || SIP.wssUrl,
    expiresAt: data.expiresAt || new Date(Date.now() + 60 * 60e3).toISOString(),
  };
}
