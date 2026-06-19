// mobile-calls: list call history and per-call detail (transcript + AI summary).
// GET    /mobile-calls           → list
// GET    /mobile-calls?id=<uuid> → detail
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function mapCall(r: any) {
  const direction = r.direction === "outbound" ? "out" : "in";
  const status = r.missed_call ? "missed" : r.call_status === "voicemail" ? "voicemail" : "answered";
  return {
    id: r.id, direction, status,
    from: r.caller_number || r.source_number || "",
    to: r.destination_number || r.destination || r.extension || "",
    customer: r.caller_name || undefined,
    startedAt: r.start_at, durationSec: r.duration_seconds || 0,
    hasRecording: !!r.has_recording, hasTranscript: !!r.transcribed,
  };
}

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
    const { data: __mobileAllowed } = await sb.rpc("my_platform_access_allowed", { _platform: "mobile" });
    if (__mobileAllowed === false) return json({ error: "MOBILE_ACCESS_DISABLED", message: "Mobile access not granted by Lemtel administrators." }, 403);

    const { data: sp } = await sb.from("pbx_softphone_users")
      .select("organization_id, extension")
      .eq("portal_user_id", u.user.id).maybeSingle();
    if (!sp) return json({ error: "NO_SOFTPHONE_ACCOUNT" }, 404);
    if (!sp.extension) return json({ error: "NO_EXTENSION_ASSIGNED" }, 403);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    const ext = sp.extension;
    const extFilter = `extension.eq.${ext},caller_number.eq.${ext},source_number.eq.${ext},destination_number.eq.${ext},destination.eq.${ext}`;

    if (id) {
      let detailQ = sb.from("pbx_call_records").select("*")
        .eq("id", id).eq("organization_id", sp.organization_id)
        .or(extFilter);
      const { data: r } = await detailQ.maybeSingle();
      if (!r) return json({ error: "not_found" }, 404);

      const [{ data: tr }, { data: ins }, { data: audit }] = await Promise.all([
        sb.from("pbx_call_transcripts").select("transcript_json, transcript_text")
          .eq("call_record_id", id).maybeSingle(),
        sb.from("pbx_ai_insights").select("summary, topics, action_items, quality_score, coaching_score, coaching_notes, intent, tags, sentiment, ai_model, created_at")
          .eq("call_record_id", id).maybeSingle(),
        sb.from("ai_request_audit_log").select("status, error_code, message, created_at")
          .eq("call_record_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      let transcript: any[] = [];
      const tj = (tr as any)?.transcript_json;
      if (Array.isArray(tj)) {
        transcript = tj.map((s: any, i: number) => ({
          speaker: s.speaker === "agent" || s.role === "agent" ? "agent" : "customer",
          text: s.text || s.content || "", t: s.t ?? i * 6,
        }));
      } else if ((tr as any)?.transcript_text) {
        transcript = [{ speaker: "agent", text: (tr as any).transcript_text, t: 0 }];
      }

      return json({
        ...mapCall(r),
        sentiment: (ins as any)?.sentiment || undefined,
        transcript,
        summary: (ins as any)?.summary || "",
        topics: (ins as any)?.topics || [],
        actionItems: (ins as any)?.action_items || [],
        qualityScore: (ins as any)?.quality_score ?? 0,
        coachingScore: (ins as any)?.coaching_score ?? null,
        coachingNotes: (ins as any)?.coaching_notes || [],
        aiStatus: (ins as any)?.ai_model && !String((ins as any).ai_model).startsWith("stub") && (tr as any)?.transcript_text ? "cached"
          : (audit as any)?.status === "error" || (audit as any)?.status === "ai-error" ? "failed"
          : "missing",
        aiError: (audit as any)?.status === "error" || (audit as any)?.status === "ai-error" ? ((audit as any)?.message || (audit as any)?.error_code || "AI analysis failed") : null,
        aiCached: !!((ins as any)?.ai_model && !String((ins as any).ai_model).startsWith("stub") && (tr as any)?.transcript_text),
        intent: (ins as any)?.intent || "",
        tags: (ins as any)?.tags || [],
      });
    }

    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const { data: rows, error } = await sb.from("pbx_call_records")
      .select("id, direction, call_status, caller_name, caller_number, source_number, destination, destination_number, extension, start_at, duration_seconds, missed_call, has_recording, transcribed")
      .eq("organization_id", sp.organization_id)
      .or(extFilter)
      .order("start_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return json((rows || []).map(mapCall));
  } catch (e) {
    console.error("[mobile-calls]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
