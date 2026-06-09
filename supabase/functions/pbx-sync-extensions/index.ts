import { corsHeaders, runSync, resolveOrgIds, fpbxJson, adminClient } from "../_shared/fusionpbx.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const orgIds = await resolveOrgIds(body);
    const results: any[] = [];

    for (const organization_id of orgIds) {
      const r = await runSync("extensions", organization_id, async () => {
        // FusionPBX returns extensions for the configured domain
        const list = await fpbxJson<any[]>("/app/extensions/extension_edit.php?action=json");
        const supa = adminClient();
        let rows = 0;
        for (const ext of (Array.isArray(list) ? list : [])) {
          const row = {
            organization_id,
            extension: String(ext.extension || ext.user || ""),
            display_name: ext.effective_caller_id_name || ext.description || null,
            password: undefined, // never sync secrets
            sip_domain: ext.domain || null,
            enabled: (ext.enabled ?? "true") !== "false",
            updated_at: new Date().toISOString(),
          };
          if (!row.extension) continue;
          await supa.from("pbx_extensions").upsert(row, { onConflict: "organization_id,extension" });
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
