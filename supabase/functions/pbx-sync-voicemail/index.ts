import { corsHeaders, runSync, resolveOrgIds, fpbxJson, fpbxFetch, adminClient } from "../_shared/fusionpbx.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const orgIds = await resolveOrgIds(body);
    const results: any[] = [];

    for (const organization_id of orgIds) {
      const r = await runSync("voicemail", organization_id, async () => {
        const supa = adminClient();
        const list = await fpbxJson<any[]>("/app/voicemails/voicemail_json.php?limit=200");
        let rows = 0;
        for (const vm of (Array.isArray(list) ? list : [])) {
          const messageId = vm.voicemail_message_uuid || vm.uuid;
          if (!messageId) continue;

          // Mirror metadata first; audio download is best-effort.
          const payload: any = {
            organization_id,
            message_id: messageId,
            extension: String(vm.voicemail_id || vm.extension || ""),
            caller_id_number: vm.caller_id_number || null,
            caller_id_name: vm.caller_id_name || null,
            duration_seconds: parseInt(vm.message_length || "0", 10),
            received_at: vm.created_epoch ? new Date(parseInt(vm.created_epoch, 10) * 1000).toISOString() : new Date().toISOString(),
            status: vm.message_status || "new",
          };

          try {
            const audioRes = await fpbxFetch(`/app/voicemails/voicemail_message_download.php?id=${encodeURIComponent(messageId)}`);
            const buf = new Uint8Array(await audioRes.arrayBuffer());
            const path = `${organization_id}/${messageId}.wav`;
            await supa.storage.from("voicemail-audio").upload(path, buf, {
              contentType: "audio/wav", upsert: true,
            });
            payload.audio_storage_path = path;
          } catch (_) { /* keep metadata even if audio missed */ }

          await supa.from("pbx_voicemails").upsert(payload, { onConflict: "organization_id,message_id" });
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
