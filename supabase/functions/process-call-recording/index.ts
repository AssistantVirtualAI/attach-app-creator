// process-call-recording: single idempotent pipeline that transcribes + analyzes + coaches a call recording.
// Short-circuits when results already exist so we never bill or run twice for the same recording.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function buildResult(insight: any, transcript: string | null, status: string) {
  return {
    status,
    insight,
    transcript,
    summary: insight?.summary ?? null,
    sentiment: insight?.sentiment ?? null,
    satisfaction_score: insight?.satisfaction_score ?? null,
    quality_score: insight?.quality_score ?? null,
    coaching_score: insight?.coaching_score ?? null,
    coaching_notes: insight?.coaching_notes ?? [],
    action_items: insight?.action_items ?? [],
    topics: insight?.topics ?? [],
    key_phrases: insight?.key_phrases ?? [],
    intent: insight?.intent ?? null,
    risks: insight?.risks ?? [],
    sales_opportunities: insight?.sales_opportunities ?? [],
    escalation_needed: insight?.escalation_needed ?? false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const token = auth.replace("Bearer ", "");
    const { data: claims, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { callId, force } = body ?? {};
    if (!callId) return json({ error: "callId required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: call, error: callErr } = await admin
      .from("pbx_call_records")
      .select("id, organization_id, caller_number, caller_name, destination, destination_number, direction, duration_seconds, recording_url, has_recording")
      .eq("id", callId)
      .single();
    if (callErr || !call) return json({ error: "Call not found" }, 404);

    // Membership / super admin check
    const { data: member } = await admin
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", call.organization_id)
      .maybeSingle();
    if (!member) {
      const { data: isSa } = await admin.rpc("is_super_admin", { _user_id: userId });
      if (!isSa) return json({ error: "Forbidden" }, 403);
    }

    // Short-circuit: already processed
    const { data: existingInsight } = await admin
      .from("pbx_ai_insights")
      .select("*")
      .eq("call_record_id", callId)
      .maybeSingle();
    const { data: existingTr } = await admin
      .from("pbx_call_transcripts")
      .select("transcript_text")
      .eq("call_record_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!force && existingInsight && existingTr?.transcript_text) {
      return json(buildResult(existingInsight, existingTr.transcript_text, "cached"));
    }

    // Advisory lock to prevent concurrent duplicate work
    const lockKey = `call-intel:${callId}`;
    const { data: lockRes } = await admin.rpc("pg_try_advisory_lock", { key: lockKey } as any).catch(() => ({ data: null }));
    // (best-effort; if rpc not available we proceed — short-circuit above is the main guard)

    try {
      // Step 1: ensure transcript
      let transcript = existingTr?.transcript_text ?? "";
      if (!transcript) {
        if (!call.recording_url) {
          return json({ status: "pending_sync", message: "Recording not yet available from PBX" }, 202);
        }
        if (!ELEVENLABS_KEY) {
          return json({ error: "Transcription provider not configured" }, 500);
        }
        try {
          const audioRes = await fetch(call.recording_url);
          if (!audioRes.ok) {
            return json({ status: "pending_sync", message: "Recording not yet retrievable", retry_after_ms: 5000 }, 202);
          }
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
          if (!sttRes.ok) {
            const t = await sttRes.text();
            console.error("STT failed", sttRes.status, t);
            return json({ error: "Transcription failed", details: t }, 502);
          }
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
        } catch (e) {
          console.error("STT error", e);
          return json({ status: "pending_sync", message: "Transcription temporarily unavailable", retry_after_ms: 5000 }, 202);
        }
      }

      if (!transcript) {
        return json({ status: "pending_sync", message: "Empty transcript", retry_after_ms: 5000 }, 202);
      }

      // Step 2: analyze + coach (skip if cached and not force)
      if (existingInsight && !force) {
        return json(buildResult(existingInsight, transcript, "cached"));
      }

      const destination = call.destination ?? call.destination_number ?? "unknown";
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "edge-function",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are an expert call-center analyst and coach. Produce concise, factual analysis AND constructive coaching feedback for the human agent. Always answer in the call's language.",
            },
            {
              role: "user",
              content: `Analyze this call.\nCaller: ${call.caller_name ?? call.caller_number ?? "unknown"} → ${destination}\nDirection: ${call.direction}\nDuration: ${call.duration_seconds ?? 0}s.\n\nTranscript:\n${transcript.slice(0, 16000)}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "save_insight",
                description: "Save structured insight + coaching for this call",
                parameters: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    summary: { type: "string" },
                    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                    satisfaction_score: { type: "number" },
                    quality_score: { type: "number" },
                    intent: { type: "string" },
                    topics: { type: "array", items: { type: "string" } },
                    action_items: { type: "array", items: { type: "string" } },
                    coaching_notes: { type: "array", items: { type: "string" } },
                    coaching_score: { type: "number" },
                    risks: { type: "array", items: { type: "string" } },
                    sales_opportunities: { type: "array", items: { type: "string" } },
                    escalation_needed: { type: "boolean" },
                    key_phrases: { type: "array", items: { type: "string" } },
                  },
                  required: ["summary", "sentiment", "topics", "action_items", "coaching_notes"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "save_insight" } },
        }),
      });

      if (aiRes.status === 429) return json({ error: "Rate limited, please retry shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      if (!aiRes.ok) {
        const t = await aiRes.text();
        console.error("AI gateway", aiRes.status, t);
        return json({ error: "AI gateway error", details: t }, 500);
      }
      const aiJson = await aiRes.json();
      const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : {};

      const row = {
        organization_id: call.organization_id,
        call_record_id: call.id,
        summary: parsed.summary ?? null,
        sentiment: parsed.sentiment ?? null,
        satisfaction_score: parsed.satisfaction_score ?? null,
        quality_score: parsed.quality_score ?? null,
        intent: parsed.intent ?? null,
        topics: parsed.topics ?? [],
        action_items: parsed.action_items ?? [],
        coaching_notes: parsed.coaching_notes ?? [],
        coaching_score: parsed.coaching_score ?? null,
        risks: parsed.risks ?? [],
        sales_opportunities: parsed.sales_opportunities ?? [],
        escalation_needed: parsed.escalation_needed ?? false,
        key_phrases: parsed.key_phrases ?? [],
        ai_model: "google/gemini-3-flash-preview",
        prompt_version: "v2-coaching",
      };

      await admin.from("pbx_ai_insights").delete().eq("call_record_id", callId);
      const { data: inserted, error: insErr } = await admin
        .from("pbx_ai_insights")
        .insert(row)
        .select()
        .single();
      if (insErr) {
        console.error(insErr);
        return json({ error: "Failed to save insight" }, 500);
      }
      await admin.from("pbx_call_records").update({ analyzed: true, transcribed: true }).eq("id", call.id);

      return json(buildResult(inserted, transcript, force ? "regenerated" : "created"));
    } finally {
      if (lockRes) {
        await admin.rpc("pg_advisory_unlock", { key: lockKey } as any).catch(() => {});
      }
    }
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
