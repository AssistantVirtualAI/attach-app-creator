import {
  callFusionPBX, corsHeaders, getServiceClient, heartbeat, jsonResponse,
  orgIdsToSync, startSyncJob,
} from "../_shared/fusionpbx.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = getServiceClient();
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const results: unknown[] = [];
  for (const orgId of await orgIdsToSync(supabase, body)) {
    const job = await startSyncJob(supabase, orgId, "fusionpbx", "telecom_extensions");
    try {
      const data = await callFusionPBX("list-extensions", { organizationId: orgId });
      const items = Array.isArray(data?.items) ? data.items : [];
      await job.finish("success", { rows_in: items.length, rows_out: items.length });
      await heartbeat(supabase, orgId, "extensions", true, { count: items.length });
      results.push({ orgId, ok: true, count: items.length });
    } catch (e) {
      await job.finish("error", { error: String((e as Error).message).slice(0, 500) });
      await heartbeat(supabase, orgId, "extensions", false, { error: String((e as Error).message) });
      results.push({ orgId, ok: false, error: String((e as Error).message) });
    }
  }
  return jsonResponse(200, { ok: true, results });
});
