import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://gejxisrqtvxavbrfcoxz.supabase.co';

export const SUPABASE_ANON =
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';

let realtimeClient: ReturnType<typeof createClient> | null = null;

export function authedRealtime(token?: string | null) {
  if (!realtimeClient) {
    realtimeClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  if (token) realtimeClient.realtime.setAuth(token);
  return realtimeClient;
}

export async function restGet<T = any>(path: string, token?: string | null): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return res.json().catch(() => null) as Promise<T>;
}

export async function restPost<T = any>(path: string, token: string | null | undefined, body: any): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      apikey: SUPABASE_ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return res.json().catch(() => null) as Promise<T>;
}

export async function edgeCall<T = any>(functionName: string, token: string | null | undefined, body: any): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(text);
      throw new Error(parsed?.error || parsed?.message || `HTTP ${res.status}`);
    } catch (err) {
      if (err instanceof Error && err.message !== 'Unexpected end of JSON input') throw err;
      throw new Error(text.slice(0, 220) || `HTTP ${res.status}`);
    }
  }
  return res.json().catch(() => null) as Promise<T>;
}

type RecordingMeta = {
  id?: string | null;
  pbx_uuid?: string | null;
  xml_cdr_uuid?: string | null;
  recording_path?: string | null;
  recording_name?: string | null;
  record_path?: string | null;
  record_name?: string | null;
  domain_uuid?: string | null;
  domain_name?: string | null;
  organization_id?: string | null;
  start_at?: string | null;
  recorded_at?: string | null;
  recording_url?: string | null;
};

const clean = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text && text !== 'null' && text !== 'undefined' ? text : '';
};

export async function loadPbxRecordingAudioMobile(recording: RecordingMeta, token?: string | null, organizationId?: string | null) {
  const xml_cdr_uuid = clean(recording.xml_cdr_uuid || recording.pbx_uuid || recording.id);
  const record_path = clean(recording.record_path || recording.recording_path);
  const record_name = clean(recording.record_name || recording.recording_name);
  if (!xml_cdr_uuid && (!record_path || !record_name)) throw new Error('Missing recording metadata');

  const payload = {
    organization_id: clean(recording.organization_id) || organizationId || undefined,
    params: {
      xml_cdr_uuid,
      record_path,
      record_name,
      domain_uuid: clean(recording.domain_uuid),
      domain_name: clean(recording.domain_name),
      recorded_at: clean(recording.recorded_at || recording.start_at),
      local_recording_url: clean(recording.recording_url),
      expires_in: 300,
    },
  };

  const signed = await fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: 'get-recording-signed-url', ...payload }),
  });

  if (signed.ok) {
    const json = await signed.json().catch(() => null);
    if (json?.ok && json?.url) return json.url as string;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: 'get-recording', ...payload }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error === 'RECORDING_NOT_FOUND') throw new Error('PBX recording file is not reachable.');
      throw new Error(parsed?.message || parsed?.error || `Recording unavailable (${res.status})`);
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('Unexpected')) throw err;
      throw new Error(text.slice(0, 220) || `Recording unavailable (${res.status})`);
    }
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const parsed = await res.json().catch(() => null);
    throw new Error(parsed?.message || parsed?.error || 'PBX did not return audio');
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error('Empty recording');
  return URL.createObjectURL(blob);
}
