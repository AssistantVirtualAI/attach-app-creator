import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { organization_id } = await req.json().catch(() => ({}));
    if (!organization_id) return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: corsHeaders });

    const { data: job } = await admin.from("pbx_sync_jobs").insert({
      organization_id, job_type: "cdr", status: "running", started_at: new Date().toISOString(),
    }).select().single();

    const { data: integ } = await admin.from("pbx_integrations").select("*").eq("organization_id", organization_id).maybeSingle();
    const mockMode = integ?.config?.mock_mode === true;

    let stats: any = { upserted: 0, recordings: 0, mode: mockMode ? "mock" : "live" };

    if (mockMode || !integ?.base_url) {
      // Stub: insert 5 mock CDRs
      const rows = Array.from({ length: 5 }, (_, i) => ({
        organization_id, pbx_uuid: `mock-${Date.now()}-${i}`,
        direction: i % 2 ? "inbound" : "outbound", call_status: "answered",
        extension: `10${i}`, caller_name: `Caller ${i}`, caller_number: `+1514555010${i}`,
        destination: "+15145559999", start_at: new Date(Date.now() - i * 60000).toISOString(),
        duration_seconds: 60 + i * 30, billsec: 55 + i * 30, has_recording: i % 2 === 0,
      }));
      await admin.from("pbx_call_records").upsert(rows, { onConflict: "pbx_uuid" });
      stats.upserted = rows.length;
    } else {
      // Live: call fusionpbx-proxy here (placeholder)
      stats.note = "live CDR sync not yet wired to FusionPBX endpoint";
    }

    await admin.from("pbx_sync_jobs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
    }).eq("id", job!.id);
    await admin.from("pbx_integrations").update({ last_sync_at: new Date().toISOString() }).eq("organization_id", organization_id);

    return new Response(JSON.stringify(stats), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
