import { supabase } from '@/integrations/supabase/client';

type RecordingMeta = {
  id?: string | null;
  pbx_uuid?: string | null;
  callId?: string | null;
  recording_path?: string | null;
  recording_name?: string | null;
  record_path?: string | null;
  record_name?: string | null;
  domain_uuid?: string | null;
  domain_name?: string | null;
  organization_id?: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const clean = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text && text !== 'null' && text !== 'undefined' ? text : '';
};

export async function loadPbxRecordingAudio(recording: RecordingMeta, organizationId?: string | null) {
  const xml_cdr_uuid = clean(recording.pbx_uuid || recording.callId || recording.id);
  const record_path = clean(recording.record_path || recording.recording_path);
  const record_name = clean(recording.record_name || recording.recording_name);

  if (!xml_cdr_uuid && (!record_path || !record_name)) {
    throw new Error('Missing recording metadata');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({
      action: 'get-recording',
      organization_id: clean(recording.organization_id) || organizationId || undefined,
      params: {
        xml_cdr_uuid,
        record_path,
        record_name,
        domain_uuid: clean(recording.domain_uuid),
        domain_name: clean(recording.domain_name),
      },
    }),
  });

  if (!res.ok) {
    const message = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(message);
      if (parsed?.error === 'RECORDING_NOT_FOUND') {
        throw new Error('PBX recording file is not reachable. Sync the phone system and verify the file still exists on the PBX server.');
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('PBX recording file')) throw err;
    }
    throw new Error(message.slice(0, 220) || `Recording unavailable (${res.status})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('audio/') && !contentType.includes('octet-stream')) {
    const message = await res.text().catch(() => '');
    throw new Error(message.slice(0, 220) || 'PBX did not return audio');
  }

  const blob = await res.blob();
  if (!blob.size) throw new Error('Empty recording');
  return URL.createObjectURL(blob);
}