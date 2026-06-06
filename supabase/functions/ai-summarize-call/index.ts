import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;

    const { callId, force } = await req.json();
    if (!callId) return new Response(JSON.stringify({ error: "callId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: call, error: callErr } = await admin
      .from("pbx_call_records")
      .select("id, organization_id, caller_number, caller_name, destination, direction, duration_seconds, recording_url")
      .eq("id", callId)
      .single();
    if (callErr || !call) {
      return new Response(JSON.stringify({ error: "Call not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Membership check
    const { data: member } = await admin
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", call.organization_id)
      .maybeSingle();
    if (!member) {
      const { data: isSa } = await admin.rpc("is_super_admin", { _user_id: userId });
      if (!isSa) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!force) {
      const { data: existing } = await admin
        .from("pbx_ai_insights")
        .select("*")
        .eq("call_record_id", callId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ insight: existing, cached: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Try to find an existing transcript
    let transcript = "";
    const { data: tr } = await admin
      .from("pbx_call_transcripts")
      .select("transcript_text")
      .eq("call_record_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tr?.transcript_text) transcript = tr.transcript_text;

    // If no transcript and recording is available, transcribe via ElevenLabs
    if (!transcript && call.recording_url && ELEVENLABS_KEY) {
      try {
        const audioRes = await fetch(call.recording_url);
        if (audioRes.ok) {
          const audioBlob = await audioRes.blob();
          const fd = new FormData();
          fd.append("file", audioBlob, "recording.mp3");
          fd.append("model_id", "scribe_v2");
          fd.append("diarize", "true");
          const sttRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_KEY },
            body: fd,
          });
          if (sttRes.ok) {
            const sttJson = await sttRes.json();
            transcript = sttJson.text ?? "";
            if (transcript) {
              await admin.from("pbx_call_transcripts").insert({
                organization_id: call.organization_id,
                call_record_id: call.id,
                transcript_text: transcript,
                provider: "elevenlabs",
                language: sttJson.language_code ?? "fr",
              });
              await admin.from("pbx_call_records").update({ transcribed: true }).eq("id", call.id);
            }
          }
        }
      } catch (e) {
        console.error("STT failed", e);
      }
    }

    if (!transcript) {
      return new Response(JSON.stringify({ error: "No transcript or recording available to summarize." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Summarize with Lovable AI Gateway via tool calling
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert call-center analyst. Produce concise, factual summaries in the call's language." },
          { role: "user", content: `Summarize this call. Caller: ${call.caller_name ?? call.caller_number ?? "unknown"} → ${call.destination ?? "unknown"}. Direction: ${call.direction}. Duration: ${call.duration_seconds ?? 0}s.\n\nTranscript:\n${transcript.slice(0, 12000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_insight",
            description: "Save structured insight for this call",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string", description: "2-4 sentence summary" },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                satisfaction_score: { type: "number" },
                quality_score: { type: "number" },
                intent: { type: "string" },
                topics: { type: "array", items: { type: "string" } },
                action_items: { type: "array", items: { type: "string" } },
                risks: { type: "array", items: { type: "string" } },
                sales_opportunities: { type: "array", items: { type: "string" } },
                escalation_needed: { type: "boolean" },
                key_phrases: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "sentiment", "topics"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_insight" } },
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited, please retry shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errTxt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : {};

    const insightRow = {
      organization_id: call.organization_id,
      call_record_id: call.id,
      summary: parsed.summary ?? null,
      sentiment: parsed.sentiment ?? null,
      satisfaction_score: parsed.satisfaction_score ?? null,
      quality_score: parsed.quality_score ?? null,
      intent: parsed.intent ?? null,
      topics: parsed.topics ?? [],
      action_items: parsed.action_items ?? [],
      risks: parsed.risks ?? [],
      sales_opportunities: parsed.sales_opportunities ?? [],
      escalation_needed: parsed.escalation_needed ?? false,
      key_phrases: parsed.key_phrases ?? [],
      ai_model: "google/gemini-3-flash-preview",
      prompt_version: "v1",
    };

    // upsert
    await admin.from("pbx_ai_insights").delete().eq("call_record_id", callId);
    const { data: inserted, error: insErr } = await admin.from("pbx_ai_insights").insert(insightRow).select().single();
    if (insErr) {
      console.error(insErr);
      return new Response(JSON.stringify({ error: "Failed to save insight" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await admin.from("pbx_call_records").update({ analyzed: true }).eq("id", callId);

    return new Response(JSON.stringify({ insight: inserted, cached: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
