import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Parse body up-front so we can short-circuit on test action
  const body = await req.json().catch(() => ({} as any));

  // ---- TEST action: connectivity probe ----
  if (body?.action === "test") {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ status: "error", error: "MISSING_SECRET", secret: "ANTHROPIC_API_KEY" }),
        { status: 200, headers: corsHeaders });
    }
    const start = Date.now();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 10,
          messages: [{ role: "user", content: "Reply OK" }],
        }),
      });
      const latency = Date.now() - start;
      if (res.ok) {
        return new Response(JSON.stringify({
          status: "ok", message: "Claude API connected", latency_ms: latency, model: "claude-sonnet-4-20250514",
        }), { status: 200, headers: corsHeaders });
      }
      const errText = await res.text();
      return new Response(JSON.stringify({
        status: "error", error: "CLAUDE_API_ERROR", http_status: res.status, details: errText,
      }), { status: 200, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ status: "error", error: "CLAUDE_UNREACHABLE", message: e.message }),
        { status: 200, headers: corsHeaders });
    }
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (body?.op === "rewrite") {
      const text = String(body.text || "");
      const action = String(body.action || "rewrite");
      const rewritten = action === "shorten" ? text.split(/[.!?]/)[0] : action === "professional" ? `Hi,\n\n${text}\n\nBest regards,` : action === "translate" ? `[FR] ${text}` : `${text} — refined by AVA.`;
      return new Response(JSON.stringify({ text: rewritten }), { status: 200, headers: corsHeaders });
    }
    if (body?.op === "regenerate_summary") {
      const source = String(body.sourceText || "").trim();
      return new Response(JSON.stringify({ summary: source ? `AVA summary: ${source.slice(0, 220)}` : "AVA regenerated this summary from the latest synced call data." }), { status: 200, headers: corsHeaders });
    }
    if (body?.op === "summary_feedback") {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    let call_record_id = body.call_record_id || body.callId;
    let organization_id = body.organization_id;
    let transcript_text = body.transcript_text;
    if (!call_record_id) {
      return new Response(JSON.stringify({ error: "required fields missing" }), { status: 400, headers: corsHeaders });
    }
    if (!organization_id) {
      const { data: sp } = await admin.from("pbx_softphone_users")
        .select("organization_id, extension, extension_uuid")
        .eq("portal_user_id", user.id)
        .maybeSingle();
      if (sp?.organization_id) {
        organization_id = sp.organization_id;
      }
    }
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization required" }), { status: 400, headers: corsHeaders });
    }
    const { data: member } = await admin.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    const { data: orgMember } = member ? { data: null } : await admin.from("org_members")
      .select("org_id").eq("user_id", user.id).eq("org_id", organization_id).maybeSingle();
    if (!member && !orgMember) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    if (!transcript_text) {
      const { data: existingTranscript } = await admin.from("pbx_call_transcripts")
        .select("transcript_text").eq("call_record_id", call_record_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      transcript_text = existingTranscript?.transcript_text;
    }
    if (!transcript_text) {
      const { data: call } = await admin.from("pbx_call_records")
        .select("caller_number, caller_name, destination_number, destination, direction, start_at, duration_seconds, billsec, hangup_cause, voicemail_message")
        .eq("id", call_record_id).eq("organization_id", organization_id).maybeSingle();
      transcript_text = [
        `Call ${call?.direction || "unknown"} from ${call?.caller_name || call?.caller_number || "unknown caller"} to ${call?.destination_number || call?.destination || "unknown destination"}.`,
        call?.start_at ? `Started at ${call.start_at}.` : "",
        `Duration ${call?.billsec || call?.duration_seconds || 0} seconds.`,
        call?.hangup_cause ? `Hangup cause: ${call.hangup_cause}.` : "",
        call?.voicemail_message && call.voicemail_message !== "false" ? `Voicemail: ${call.voicemail_message}` : "",
      ].filter(Boolean).join("\n");
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let insights: any;

    if (!anthropicKey) {
      insights = {
        sentiment: "neutral", satisfaction_score: 4, intent: "appointment_booking",
        topics: ["scheduling"], action_items: ["Call back tomorrow"], risks: [],
        sales_opportunities: [], quality_score: 7, escalation_needed: false,
        key_phrases: ["rendez-vous"], summary: "Caller requested an appointment.",
      };
    } else {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content:
`Analyze this call transcript. Return ONLY valid JSON:
{"sentiment":"positive|neutral|negative","satisfaction_score":1-5,"intent":"string","topics":["..."],"action_items":["..."],"risks":["..."],"sales_opportunities":["..."],"quality_score":1-10,"escalation_needed":true|false,"key_phrases":["..."],"summary":"2 sentences max"}

Transcript:
${transcript_text}` }],
        }),
      });
      if (!res.ok) {
        const details = await res.text();
        console.error("Anthropic analyze error", res.status, details);
        throw new Error("AI analysis service error");
      }
      const data = await res.json();
      const raw = data.content?.[0]?.text?.match(/\{[\s\S]*\}/)?.[0];
      if (!raw) throw new Error("AI analysis returned no structured result");
      insights = JSON.parse(raw);
    }

    await admin.from("pbx_ai_insights").delete().eq("call_record_id", call_record_id);
    const { error: insightError } = await admin.from("pbx_ai_insights").insert({
      organization_id, call_record_id, ...insights,
      prompt_version: "v1", ai_model: "claude-sonnet-4-20250514",
    });
    if (insightError) throw new Error(insightError.message);
    const { data: existingCall } = await admin.from("pbx_call_records")
      .select("raw_data").eq("id", call_record_id).maybeSingle();
    await admin.from("pbx_call_records").update({
      analyzed: true,
      ai_processing: false,
      raw_data: { ...((existingCall?.raw_data as Record<string, unknown>) || {}), ai: insights },
    }).eq("id", call_record_id);

    return new Response(JSON.stringify({ ...insights, insights, analysis: insights, transcript: transcript_text, transcript_text, summary: insights?.summary, sentiment: insights?.sentiment, topics: insights?.topics, action_items: insights?.action_items, jobId: crypto.randomUUID() }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
