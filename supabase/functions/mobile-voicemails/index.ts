// mobile-voicemails: voicemails for the authenticated user's organization.
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
      .select("organization_id").eq("portal_user_id", u.user.id).maybeSingle();
    if (!sp) return json({ error: "NO_SOFTPHONE_ACCOUNT" }, 404);

    const { data: rows } = await sb.from("pbx_call_records")
      .select(`
        id, caller_name, caller_number, start_at, duration_seconds, voicemail_message,
        pbx_call_transcripts(transcript_text),
        pbx_ai_insights(summary, sentiment)
      `)
      .eq("organization_id", sp.organization_id)
      .eq("call_status", "voicemail")
      .order("start_at", { ascending: false })
      .limit(60);

    const now = Date.now();
    const out = (rows || []).map((r: any) => {
      const tx = r.pbx_call_transcripts?.[0]?.transcript_text || r.voicemail_message || "";
      const ai = r.pbx_ai_insights?.[0];
      return {
        id: r.id,
        from: r.caller_number || "",
        customer: r.caller_name || undefined,
        receivedAt: r.start_at,
        durationSec: r.duration_seconds || 0,
        transcript: tx,
        summary: ai?.summary || tx.slice(0, 140),
        priority: ai?.sentiment === "negative" ? "high" : "normal",
        sentiment: ai?.sentiment || "neutral",
        isNew: now - new Date(r.start_at).getTime() < 24 * 36e5,
      };
    });
    return json(out);
  } catch (e) {
    console.error("[mobile-voicemails]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
