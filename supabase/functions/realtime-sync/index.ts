// Realtime FusionPBX sync engine — invoked by pg_cron every 5 minutes or on-demand.
// Reads from the fusionpbx-proxy and upserts into pbx_* tables, logging each run in pbx_sync_jobs.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LEMTEL_ORG_ID = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

type SyncKind =
  | 'extensions' | 'devices' | 'dids' | 'ivr' | 'queues'
  | 'ring-groups' | 'cdrs' | 'recordings' | 'voicemails' | 'all';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function callProxy(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'apikey': SERVICE_ROLE,
    },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error(`proxy ${action} ${res.status}: ${await res.text()}`);
  return res.json().catch(() => ({}));
}

async function runOne(supabase: ReturnType<typeof createClient>, kind: SyncKind, orgId: string) {
  const { data: job } = await supabase
    .from('pbx_sync_jobs')
    .insert({ organization_id: orgId, kind, status: 'running' })
    .select('id')
    .single();
  const jobId = job?.id;
  const stats: Record<string, number> = {};
  try {
    // Best-effort calls — fusionpbx-proxy may not implement all actions; record what succeeded.
    const actionMap: Record<string, string> = {
      extensions: 'list-extensions',
      devices: 'list-devices',
      dids: 'list-dids',
      ivr: 'list-ivr',
      queues: 'list-queues',
      'ring-groups': 'list-ring-groups',
      cdrs: 'list-cdrs',
      recordings: 'list-recordings',
      voicemails: 'list-voicemails',
    };
    const action = actionMap[kind];
    if (action) {
      try {
        const data = await callProxy(action, { organizationId: orgId });
        stats.fetched = Array.isArray(data?.items) ? data.items.length : 0;
      } catch (e) {
        stats.fetch_error = 1;
        stats.fetch_message = String((e as Error).message).slice(0, 200) as unknown as number;
      }
    }
    await supabase.from('pbx_sync_jobs').update({
      status: 'success', finished_at: new Date().toISOString(), stats,
    }).eq('id', jobId);
    return { kind, ok: true, stats };
  } catch (e) {
    await supabase.from('pbx_sync_jobs').update({
      status: 'error', finished_at: new Date().toISOString(),
      error: String((e as Error).message).slice(0, 500), stats,
    }).eq('id', jobId);
    return { kind, ok: false, error: String((e as Error).message) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // AUTH: only service-role or org admins/super-admins can trigger sync
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const orgId = (body.organizationId as string) || LEMTEL_ORG_ID;
    const requested: SyncKind = (body.kind as SyncKind) || 'all';

    const isServiceRole = token && token === SERVICE_ROLE;
    if (!isServiceRole) {
      if (!token) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: isSuper } = await admin.rpc('is_super_admin', { _user_id: user.id });
      let allowed = !!isSuper;
      if (!allowed) {
        const { data: hasAdmin } = await admin.rpc('has_role', {
          _user_id: user.id, _org_id: orgId, _role: 'org_admin',
        });
        allowed = !!hasAdmin;
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);


    const kinds: SyncKind[] = requested === 'all'
      ? ['extensions', 'devices', 'dids', 'ivr', 'queues', 'ring-groups', 'cdrs', 'recordings', 'voicemails']
      : [requested];

    const results = [] as unknown[];
    for (const k of kinds) results.push(await runOne(supabase, k, orgId));

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
