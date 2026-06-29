import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM_PROMPT = `Tu es un analyste IA spécialisé en appels téléphoniques et coaching d'agents.
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

Ajoute du coaching concret pour l'agent, les prochaines actions et les métriques de qualité. Réponds dans la langue dominante de l'appel.`;

async function getSecret(admin: any, provider: string, key: string): Promise<string | null> {
  const { data } = await admin.from("planipret_integration_secrets").select("config").eq("provider", provider).maybeSingle();
  return (data?.config as any)?.[key] ?? Deno.env.get(key.toUpperCase()) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const body = await req.json().catch(() => ({}));
    let { call_id, call_record_id, transcript, transcript_text, action, organization_id, force } = body ?? {};
    call_id = call_id || call_record_id || body?.callId;
    transcript = transcript || transcript_text;
    if (action === "test" || call_id === "test") {
      return new Response(JSON.stringify({ success: true, test: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!call_id) {
      return new Response(JSON.stringify({ success: false, error: "missing call_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: pbxCall } = await admin.from("pbx_call_records")
      .select("id, organization_id, caller_number, caller_name, destination, destination_number, direction, duration_seconds, raw_data")
      .eq("id", call_id)
      .maybeSingle();

    if (pbxCall) {
      organization_id = organization_id || (pbxCall as any).organization_id;
      const isServiceCall = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
      if (!user && !isServiceCall) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (user) {
        const [m1, m2, m3, m4] = await Promise.all([
          admin.from("organization_members").select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle(),
          admin.from("org_members").select("org_id").eq("user_id", user.id).eq("org_id", organization_id).maybeSingle(),
          admin.from("pbx_softphone_users").select("organization_id").eq("portal_user_id", user.id).eq("organization_id", organization_id).maybeSingle(),
          admin.from("user_roles").select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle(),
        ]);
        if (![m1, m2, m3, m4].some((r) => r.data)) {
          return new Response(JSON.stringify({ success: false, error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (!transcript) {
        const { data: tr } = await admin.from("pbx_call_transcripts")
          .select("transcript_text, provider, created_at")
          .eq("call_record_id", call_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        transcript = (tr as any)?.transcript_text || (pbxCall as any)?.raw_data?.transcript_text || "";
      }

      if (!transcript || !String(transcript).trim()) {
        return new Response(JSON.stringify({ success: false, error: "missing transcript", message: "Transcription audio absente: lancez d'abord la transcription voice-to-text." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!force) {
        const { data: cached } = await admin.from("pbx_ai_insights").select("*").eq("call_record_id", call_id).maybeSingle();
        if (cached) return new Response(JSON.stringify({ success: true, cached: true, insights: cached, transcript_text: transcript }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const apiKey = (await getSecret(admin, "anthropic", "api_key")) ?? Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return new Response(JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY non configuré" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Appel: ${(pbxCall as any).caller_name || (pbxCall as any).caller_number || "inconnu"} → ${(pbxCall as any).destination_number || (pbxCall as any).destination || "inconnu"}\nDirection: ${(pbxCall as any).direction}\nDurée: ${(pbxCall as any).duration_seconds || 0}s\n\nTranscription:\n${String(transcript).slice(0, 18000)}` }],
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

      const row = {
        organization_id,
        call_record_id: call_id,
        summary: insights.summary ?? null,
        sentiment: ["positive", "neutral", "negative"].includes(insights.sentiment) ? insights.sentiment : "neutral",
        satisfaction_score: insights.lead_score ?? null,
        quality_score: insights.quality_score ?? (insights.lead_score ? Math.round(Number(insights.lead_score || 0) * 10) : null),
        intent: insights.customer_intent ?? null,
        topics: insights.objections ?? insights.topics ?? [],
        action_items: (insights.tasks || []).map((t: any) => typeof t === "string" ? t : t?.title).filter(Boolean),
        coaching_notes: [insights.coaching, insights.next_action, insights.lead_score_reason].filter(Boolean),
        coaching_score: insights.lead_score ?? null,
        risks: insights.risks ?? [],
        sales_opportunities: insights.buying_signals ?? [],
        escalation_needed: false,
        key_phrases: insights.key_phrases ?? [],
        prompt_version: "claude-mobile-v1",
        ai_model: "claude-sonnet-4-5-20250929",
      };

      await admin.from("pbx_ai_insights").delete().eq("call_record_id", call_id);
      const { data: inserted, error: insertError } = await admin.from("pbx_ai_insights").insert(row).select().single();
      if (insertError) throw insertError;
      try {
        await admin.channel(`ai-insights:${organization_id}`).send({
          type: "broadcast",
          event: "insights",
          payload: { call_record_id: call_id, insights: inserted },
        });
      } catch (_) {}

      await admin.from("pbx_call_records").update({
        analyzed: true,
        ai_processing: false,
        ai_summary: row.summary,
        raw_data: {
          ...(((pbxCall as any)?.raw_data as Record<string, unknown>) || {}),
          transcript_text: transcript,
          ai: inserted,
          ai_model: row.ai_model,
          ai_updated_at: new Date().toISOString(),
        },
      }).eq("id", call_id);

      return new Response(JSON.stringify({ success: true, insights: inserted, analysis: inserted, transcript_text: transcript }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!transcript || !String(transcript).trim()) {
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
        model: "claude-sonnet-4-5-20250929",
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
      model: "claude-sonnet-4-5-20250929",
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
