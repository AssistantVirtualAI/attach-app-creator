// POST /functions/v1/maestro-transcript
// Body: { call_id: uuid, force?: boolean }
// Pipeline: NS-API transcript → Lovable AI Gateway transcription fallback → store + push to Maestro → trigger AI analysis.
import {
  adminClient,
  broadcastPipeline,
  corsHeaders,
  getBrokerAuth,
  getMaestroConfig,
  json,
  maestroAudit,
  maestroFetch,
  pipelineLog,
  setPipelineStep,
  updateCallPipeline,
} from "../_shared/maestro.ts";


async function transcribeViaLovable(audioUrl: string): Promise<{ text: string; segments: any[] } | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || !audioUrl) return null;

  try {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) return null;
    const blob = await audioRes.blob();
    const form = new FormData();
    form.append("file", blob, "call.wav");
    form.append("model", "openai/gpt-4o-mini-transcribe");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey },
      body: form,
    });
    if (!res.ok) {
      console.warn("Lovable transcription failed", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return { text: data.text ?? "", segments: data.segments ?? [] };
  } catch (e) {
    console.warn("transcribeViaLovable error", e);
    return null;
  }
}

async function tryNsTranscript(admin: any, nsCallId: string | null): Promise<{ text: string; segments: any[] } | null> {
  if (!nsCallId) return null;
  const base = Deno.env.get("NS_API_BASE_URL");
  const domain = Deno.env.get("NS_API_DOMAIN") ?? "planipret.ca";
  const user = Deno.env.get("NS_API_USER");
  const pass = Deno.env.get("NS_API_PASSWORD");
  if (!base || !user || !pass) return null;
  try {
    const auth = btoa(`${user}:${pass}`);
    const res = await fetch(
      `${base.replace(/\/$/, "")}/domains/${encodeURIComponent(domain)}/transcriptions?callId=${encodeURIComponent(nsCallId)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry?.text && !entry?.transcript) return null;
    return {
      text: entry.text ?? entry.transcript ?? "",
      segments: entry.segments ?? [],
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { call_id, force } = await req.json().catch(() => ({}));
    if (!call_id) return json({ success: false, error: "call_id_required" }, 400);

    const admin = adminClient();
    const { data: call } = await admin
      .from("planipret_phone_calls")
      .select("id, user_id, ns_call_id, maestro_call_id, recording_url, transcript, transcript_segments, transcript_language")
      .eq("id", call_id)
      .maybeSingle();
    if (!call) return json({ success: false, error: "call_not_found" }, 404);

    if (call.transcript && !force) {
      // Still trigger AI in case it wasn't done
      triggerAi(call_id);
      return json({
        success: true,
        transcript: call.transcript,
        segments: call.transcript_segments ?? [],
        language: call.transcript_language ?? "fr-CA",
        cached: true,
      });
    }

    await setPipelineStep(admin, call_id, "transcript", "running");

    // 1. Try NS-API
    let result = await tryNsTranscript(admin, call.ns_call_id);
    let source: "ns" | "lovable" | null = result ? "ns" : null;

    // 2. Fallback to Lovable AI Gateway (Whisper-style)
    if (!result && call.recording_url) {
      result = await transcribeViaLovable(call.recording_url);
      source = result ? "lovable" : null;
    }

    // 2b. Try fetching recording URL from Maestro if still nothing
    if (!result) {
      const cfg = await getMaestroConfig(admin);
      if (cfg.url && cfg.key) {
        const auth = await getBrokerAuth(admin, call.user_id);
        const recRes = await maestroFetch(cfg, {
          method: "GET",
          path: `/api/v1/calls/${encodeURIComponent(call.maestro_call_id ?? call.ns_call_id ?? call.id)}/recording`,
          token: auth.token,
        });
        if (recRes.ok && recRes.data?.url) {
          result = await transcribeViaLovable(recRes.data.url);
          source = result ? "lovable" : null;
        }
      }
    }

    if (!result) {
      await setPipelineStep(admin, call_id, "transcript", "error", { reason: "no_audio_or_transcript" });
      return json({ success: false, error: "transcript_unavailable" }, 200);
    }

    // 3. Store
    await admin
      .from("planipret_phone_calls")
      .update({
        transcript: result.text,
        transcript_segments: result.segments,
        transcript_language: "fr-CA",
      })
      .eq("id", call.id);

    // 4. Push to Maestro
    try {
      const cfg = await getMaestroConfig(admin);
      if (cfg.url && cfg.key) {
        const auth = await getBrokerAuth(admin, call.user_id);
        const mId = call.maestro_call_id ?? call.ns_call_id ?? call.id;
        await maestroFetch(cfg, {
          method: "POST",
          path: `/api/v1/calls/${encodeURIComponent(mId)}/transcript`,
          token: auth.token,
          body: {
            language: "fr-CA",
            text: result.text,
            segments: result.segments,
            confidence: 0.95,
          },
        });
      }
    } catch (e) {
      console.warn("push transcript to maestro failed", e);
    }

    await setPipelineStep(admin, call_id, "transcript", "done", { source });
    await maestroAudit(admin, "transcript_ready", { call_id, source, chars: result.text.length });

    // 5. Trigger AI analysis (fire and forget)
    triggerAi(call_id);

    return json({
      success: true,
      transcript: result.text,
      segments: result.segments,
      language: "fr-CA",
      source,
    });
  } catch (e: any) {
    console.error("maestro-transcript error", e);
    return json({ success: false, error: e?.message ?? "server_error" }, 500);
  }
});

function triggerAi(call_id: string) {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    fetch(`${url}/functions/v1/maestro-ai-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ call_id }),
    }).catch(() => {});
  } catch {}
}
