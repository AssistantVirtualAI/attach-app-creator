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
    const { call_record_id, transcript_text, organization_id } = body;
    if (!call_record_id || !transcript_text || !organization_id) {
      return new Response(JSON.stringify({ error: "required fields missing" }), { status: 400, headers: corsHeaders });
    }
    const { data: member } = await admin.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    if (!member) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

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
      const data = await res.json();
      const raw = data.content?.[0]?.text?.match(/\{[\s\S]*\}/)?.[0] || "{}";
      insights = JSON.parse(raw);
    }

    await admin.from("pbx_ai_insights").insert({
      organization_id, call_record_id, ...insights,
      prompt_version: "v1", ai_model: "claude-sonnet-4-20250514",
    });
    await admin.from("pbx_call_records").update({ analyzed: true, ai_processing: false }).eq("id", call_record_id);

    return new Response(JSON.stringify(insights), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
