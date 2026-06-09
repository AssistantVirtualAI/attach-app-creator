// Hourly reconciliation: compare telecom_sync_health heartbeats and surface
// stale sources as alerts.
import { corsHeaders, getServiceClient, jsonResponse } from "../_shared/fusionpbx.ts";

const STALE_MINUTES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = getServiceClient();
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data: stale } = await supabase
    .from("telecom_sync_health")
    .select("organization_id, source, last_heartbeat_at")
    .lt("last_heartbeat_at", cutoff);
  let raised = 0;
  for (const row of stale ?? []) {
    if (!row.organization_id) continue;
    await supabase.from("alert_notifications").insert({
      organization_id: row.organization_id,
      severity: "warning",
      title: `PBX sync stale: ${row.source}`,
      body: `No heartbeat for ${row.source} since ${row.last_heartbeat_at}`,
    });
    await supabase.from("telecom_sync_health")
      .update({ status: "stale" })
      .eq("organization_id", row.organization_id).eq("source", row.source);
    raised++;
  }
  return jsonResponse(200, { ok: true, raised, checked: (stale ?? []).length });
});
