import { corsHeaders, runSync, resolveOrgIds, fpbxJson, adminClient } from "../_shared/fusionpbx.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const orgIds = await resolveOrgIds(body);
    const results: any[] = [];

    for (const organization_id of orgIds) {
      const r = await runSync("recordings", organization_id, async () => {
        const supa = adminClient();
        const list = await fpbxJson<any[]>("/app/call_recordings/call_recording_json.php?limit=200");
        let rows = 0;
        for (const rec of (Array.isArray(list) ? list : [])) {
          const id = rec.call_recording_uuid || rec.uuid;
          if (!id) continue;
          await supa.from("pbx_call_recordings").upsert({
            organization_id,
            recording_uuid: id,
            call_uuid: rec.call_uuid || null,
            extension: rec.extension || null,
            file_path: rec.call_recording_name || null,
            file_size: parseInt(rec.call_recording_length || "0", 10),
            duration_seconds: parseInt(rec.duration || "0", 10),
            recorded_at: rec.call_recording_date ? new Date(rec.call_recording_date).toISOString() : new Date().toISOString(),
          }, { onConflict: "recording_uuid" });
          rows++;
        }
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
