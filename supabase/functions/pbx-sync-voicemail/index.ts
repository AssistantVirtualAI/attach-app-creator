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
    const job = await startSyncJob(supabase, orgId, "fusionpbx", "telecom_voicemails");
    try {
      const data = await callFusionPBX("list-voicemails", { organizationId: orgId, limit: 200 });
      const items = Array.isArray(data?.items) ? data.items : [];
      // Queue AI jobs for items missing transcripts
      let queued = 0;
      for (const v of items) {
        if (v?.id && !v?.transcript) {
          await supabase.from("pbx_ai_jobs").insert({
            organization_id: orgId, job_type: "voicemail_transcribe",
            status: "pending", payload: { voicemail_id: v.id },
          }).select().maybeSingle();
          queued++;
        }
      }
      await job.finish("success", { rows_in: items.length, rows_out: items.length, metadata: { queued } });
      await heartbeat(supabase, orgId, "voicemail", true, { count: items.length, queued });
      results.push({ orgId, ok: true, count: items.length, queued });
    } catch (e) {
      await job.finish("error", { error: String((e as Error).message).slice(0, 500) });
      await heartbeat(supabase, orgId, "voicemail", false, { error: String((e as Error).message) });
      results.push({ orgId, ok: false, error: String((e as Error).message) });
    }
  }
  return jsonResponse(200, { ok: true, results });
});
