// pbx-reconcile : housekeeping job — clears stale live calls, fails stuck jobs.
import { corsHeaders, adminClient } from "../_shared/fusionpbx.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = adminClient();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { count: clearedCalls } = await supa.from("telecom_live_calls")
      .delete({ count: "exact" })
      .lt("updated_at", fiveMinAgo);

    const { count: failedJobs } = await supa.from("telecom_sync_jobs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error_message: "Timed out" }, { count: "exact" })
      .eq("status", "running")
      .lt("started_at", tenMinAgo);

    return new Response(JSON.stringify({ ok: true, cleared_calls: clearedCalls, failed_jobs: failedJobs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
