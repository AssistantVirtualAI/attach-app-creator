import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM_PROMPT = `Tu es un assistant IA spécialisé pour les courtiers hypothécaires de Planiprêt.
Analyse cette transcription d'appel et retourne UNIQUEMENT un JSON valide, sans texte avant ou après, avec cette structure exacte:
{
  "summary": string,
  "customer_intent": string,
  "sentiment": "positive"|"neutral"|"negative"|"mixed",
  "objections": string[],
  "buying_signals": string[],
  "coaching": string,
  "next_action": string,
  "tasks": [{"title": string, "due_days_from_now": number}],
  "events": [{"title": string, "start_offset_hours": number, "duration_minutes": number}],
  "should_create_maestro_task": boolean,
  "should_create_maestro_event": boolean,
  "lead_score": number,
  "lead_temperature": "hot"|"warm"|"cold",
  "lead_score_reason": string,
  "suggested_callback_delay": "now"|"2h"|"tomorrow_9am"|"monday_9am",
  "callback_reason": string
}

CRITÈRES DE SCORING DU LEAD (lead_score 1-10) :
- 9-10 (hot / 🔥 Chaud) : Client prêt à avancer, mentionne budget, urgence, accord verbal.
- 6-8 (warm / 🌡️ Tiède) : Intéressé mais hésitant, questions sur les taux, demande de suivi.
- 1-5 (cold / ❄️ Froid) : Pas de budget, juste info, long délai, refus implicite.
lead_temperature DOIT correspondre au score. lead_score_reason : 1 phrase justifiant le score.
suggested_callback_delay : choisir intelligemment selon l'urgence. callback_reason : 1 phrase.`;

async function getSecret(admin: any, provider: string, key: string): Promise<string | null> {
  const { data } = await admin.from("planipret_integration_secrets").select("config").eq("provider", provider).maybeSingle();
  return (data?.config as any)?.[key] ?? Deno.env.get(key.toUpperCase()) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { call_id, transcript } = await req.json();
    if (!call_id || !transcript) {
      return new Response(JSON.stringify({ success: false, error: "missing call_id or transcript" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = (await getSecret(admin, "anthropic", "api_key")) ?? Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY non configuré" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: transcript }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude error", claudeRes.status, errText);
      return new Response(JSON.stringify({ success: false, error: "Claude API error", details: errText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.[0]?.text ?? "{}";
    let insights: any;
    try { insights = JSON.parse(text); } catch { insights = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); }

    const { data: call } = await admin.from("planipret_phone_calls").select("user_id, organization_id, metadata").eq("id", call_id).maybeSingle();
    if (!call) {
      return new Response(JSON.stringify({ success: false, error: "Appel introuvable" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newMeta = { ...(call.metadata ?? {}), ai_coaching: insights.coaching, ai_tasks: insights.tasks, ai_events: insights.events, ai_next_action: insights.next_action };
    const validTemp = ["hot","warm","cold"].includes(insights.lead_temperature) ? insights.lead_temperature : null;
    const leadScore = typeof insights.lead_score === "number" ? Math.min(10, Math.max(1, Math.round(insights.lead_score))) : null;
    await admin.from("planipret_phone_calls").update({
      ai_summary: insights.summary,
      metadata: newMeta,
      lead_score: leadScore,
      lead_temperature: validTemp,
      lead_score_reason: insights.lead_score_reason ?? null,
      suggested_callback_delay: insights.suggested_callback_delay ?? null,
      callback_reason: insights.callback_reason ?? null,
    }).eq("id", call_id);

    await admin.from("planipret_ai_insights").insert({
      user_id: call.user_id,
      organization_id: call.organization_id,
      call_id,
      summary: insights.summary,
      customer_intent: insights.customer_intent,
      sentiment: insights.sentiment,
      topics: insights.objections ?? [],
      suggested_actions: insights.tasks ?? [],
      coaching_notes: insights.coaching,
      raw_response: insights,
      model: "claude-sonnet-4-20250514",
    });

    // Trigger Maestro actions
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const invokeFn = (name: string, body: any) =>
      fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify(body),
      }).catch((e) => console.error(`${name} failed`, e));

    if (insights.should_create_maestro_task && insights.tasks?.[0]) {
      const t = insights.tasks[0];
      invokeFn("maestro-actions", { action: "create_task", payload: { title: t.title, description: insights.summary, due_date: new Date(Date.now() + (t.due_days_from_now ?? 1) * 86400000).toISOString(), call_id } });
    }
    if (insights.should_create_maestro_event && insights.events?.[0]) {
      const e = insights.events[0];
      const start = new Date(Date.now() + (e.start_offset_hours ?? 24) * 3600000);
      const end = new Date(start.getTime() + (e.duration_minutes ?? 30) * 60000);
      invokeFn("maestro-actions", { action: "create_event", payload: { title: e.title, start: start.toISOString(), end: end.toISOString(), description: insights.summary, call_id } });
    }

    // Realtime broadcast
    await admin.channel(`ai-insights:${call.user_id}`).send({ type: "broadcast", event: "ai-insights", payload: { call_id, insights } });

    return new Response(JSON.stringify({ success: true, insights }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("ai-analyze-call error", e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? "Erreur serveur" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
