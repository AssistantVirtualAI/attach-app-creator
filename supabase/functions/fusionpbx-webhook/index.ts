// FusionPBX webhook receiver — accepts push events and queues a targeted sync.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LEMTEL_ORG_ID = '71755d33-ed64-4ad5-a828-61c9d2029eb7';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function eventToKind(event: string): string | null {
  if (event.startsWith('extension.')) return 'extensions';
  if (event.startsWith('device.')) return 'devices';
  if (event.startsWith('voicemail.')) return 'voicemails';
  if (event.startsWith('call.')) return 'cdrs';
  if (event.startsWith('queue.')) return 'queues';
  if (event.startsWith('did.')) return 'dids';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    const event: string = payload.event || payload.type || '';
    const kind = eventToKind(event);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    await supabase.from('pbx_sync_jobs').insert({
      organization_id: LEMTEL_ORG_ID,
      kind: kind ?? 'webhook',
      status: 'success',
      finished_at: new Date().toISOString(),
      stats: { event, payload },
    });

    if (kind) {
      // Fire-and-forget targeted sync
      fetch(`${SUPABASE_URL}/functions/v1/realtime-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'apikey': SERVICE_ROLE,
        },
        body: JSON.stringify({ kind, organizationId: LEMTEL_ORG_ID }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
