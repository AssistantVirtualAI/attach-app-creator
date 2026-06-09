import { corsHeaders, runSync, resolveOrgIds, fpbxJson, adminClient } from "../_shared/fusionpbx.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const orgIds = await resolveOrgIds(body);
    const results: any[] = [];

    for (const organization_id of orgIds) {
      const r = await runSync("cdr", organization_id, async () => {
        const supa = adminClient();
        const { data: last } = await supa
          .from("pbx_call_records")
          .select("start_at")
          .eq("organization_id", organization_id)
          .order("start_at", { ascending: false })
          .limit(1).maybeSingle();
        const since = last?.start_at || new Date(Date.now() - 24 * 3600 * 1000).toISOString();

        const cdrs = await fpbxJson<any[]>(`/app/xml_cdr/xml_cdr_json.php?since=${encodeURIComponent(since)}&limit=500`);
        let rows = 0;
        for (const c of (Array.isArray(cdrs) ? cdrs : [])) {
          const start = c.start_stamp || c.start_at;
          if (!start) continue;
          await supa.from("pbx_call_records").upsert({
            organization_id,
            call_uuid: c.uuid || c.xml_cdr_uuid,
            direction: c.direction || "inbound",
            caller_number: c.caller_id_number || null,
            destination_number: c.destination_number || null,
            source_number: c.caller_id_number || null,
            extension: c.extension || null,
            start_at: new Date(start).toISOString(),
            answer_at: c.answer_stamp ? new Date(c.answer_stamp).toISOString() : null,
            end_at: c.end_stamp ? new Date(c.end_stamp).toISOString() : null,
            duration_seconds: parseInt(c.duration || "0", 10),
            billsec: parseInt(c.billsec || "0", 10),
            hangup_cause: c.hangup_cause || null,
            call_status: c.billsec && parseInt(c.billsec, 10) > 0 ? "answered" : "missed",
            missed_call: !(c.billsec && parseInt(c.billsec, 10) > 0),
            recording_url: c.record_path || null,
          }, { onConflict: "call_uuid" });
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
