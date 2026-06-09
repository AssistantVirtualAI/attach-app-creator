// pbx-live-events : maintains telecom_live_calls from FusionPBX event source.
// This implementation polls the live-calls REST endpoint each invocation (every minute via cron).
// A persistent WSS Event Socket can be added when stable infrastructure is available.
import { corsHeaders, runSync, resolveOrgIds, fpbxJson, adminClient } from "../_shared/fusionpbx.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const orgIds = await resolveOrgIds(body);
    const results: any[] = [];

    for (const organization_id of orgIds) {
      const r = await runSync("live-events", organization_id, async () => {
        const supa = adminClient();
        const calls = await fpbxJson<any[]>("/app/active_calls/active_calls_json.php").catch(() => []);
        const activeIds: string[] = [];
        let rows = 0;
        for (const c of (Array.isArray(calls) ? calls : [])) {
          const uuid = c.uuid || c.call_uuid;
          if (!uuid) continue;
          activeIds.push(uuid);
          await supa.from("telecom_live_calls").upsert({
            organization_id,
            call_uuid: uuid,
            direction: c.direction || "inbound",
            caller_number: c.cid_num || c.caller_id_number || null,
            callee_number: c.dest || c.destination_number || null,
            extension: c.dest || null,
            state: c.state || "active",
            started_at: c.created_epoch ? new Date(parseInt(c.created_epoch, 10) * 1000).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "call_uuid" });
          rows++;
        }
        // Clear stale rows (not in current snapshot, older than 30s)
        await supa.from("telecom_live_calls").delete()
          .eq("organization_id", organization_id)
          .not("call_uuid", "in", `(${activeIds.length ? activeIds.map(i => `"${i}"`).join(",") : '""'})`)
          .lt("updated_at", new Date(Date.now() - 30000).toISOString());
        return { rows_synced: rows };
      });
      results.push({ organization_id, ...r });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
