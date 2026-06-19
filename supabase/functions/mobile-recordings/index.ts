// mobile-recordings: list of calls that have recordings, with optional AI summary.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const { data: sp } = await sb.from("pbx_softphone_users")
      .select("organization_id, domain_uuid").eq("portal_user_id", u.user.id).maybeSingle();
    if (!sp?.organization_id) return json({ items: [], noSoftphone: true });

    let q = sb.from("pbx_call_records")
      .select("id, pbx_uuid, caller_name, caller_number, destination_number, start_at, duration_seconds, transcribed, ai_summary, recording_path, recording_name, domain_uuid, domain_name, organization_id")
      .eq("organization_id", sp.organization_id)
      .eq("has_recording", true);
    if (sp.domain_uuid) q = q.eq("domain_uuid", sp.domain_uuid);
    const { data: rows } = await q.order("start_at", { ascending: false }).limit(100);

    const out = (rows ?? []).map((r: any) => ({
      id: r.id,
      from: r.caller_number || "",
      to: r.destination_number || "",
      customer: r.caller_name || undefined,
      startedAt: r.start_at,
      durationSec: Number(r.duration_seconds || 0),
      hasTranscript: !!r.transcribed,
      summary: r.ai_summary || undefined,
      // Audio addressing for /fusionpbx-proxy get-recording-signed-url
      xml_cdr_uuid: r.pbx_uuid || r.id,
      record_path: r.recording_path || undefined,
      record_name: r.recording_name || undefined,
      domain_uuid: r.domain_uuid || undefined,
      domain_name: r.domain_name || undefined,
      organization_id: r.organization_id || undefined,
    }));
    return json(out);
  } catch (e: any) {
    return json({ error: e.message || "error" }, 500);
  }
});
