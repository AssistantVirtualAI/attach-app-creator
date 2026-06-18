import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function bufToBase64(buf: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function detectMime(url: string, ct?: string | null): string {
  if (ct && /audio\//.test(ct)) return ct.split(";")[0];
  const u = url.toLowerCase();
  if (u.endsWith(".mp3")) return "audio/mpeg";
  if (u.endsWith(".ogg") || u.endsWith(".oga")) return "audio/ogg";
  if (u.endsWith(".m4a")) return "audio/mp4";
  if (u.endsWith(".webm")) return "audio/webm";
  return "audio/wav";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = Date.now();
  const admin0 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let auditOrg: string | null = null;
  let auditUser: string | null = null;
  let auditCall: string | null = null;
  const audit = async (status: string, extras: Record<string, any> = {}) => {
    try {
      await admin0.from("ai_request_audit_log").insert({
        organization_id: auditOrg, user_id: auditUser, call_record_id: auditCall,
        request_type: "transcribe", status,
        latency_ms: Date.now() - startedAt,
        error_code: extras.error_code || null,
        http_status: extras.http_status || null,
        message: extras.message || null,
        provider: extras.provider || null,
        model: extras.model || null,
        metadata: extras.metadata || {},
      });
    } catch (_) { /* fire-and-forget */ }
  };
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) { await audit("forbidden", { error_code: "no-auth", http_status: 401 }); return json({ error: "Unauthorized" }, 401); }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { await audit("forbidden", { error_code: "no-user", http_status: 401 }); return json({ error: "Unauthorized" }, 401); }
    auditUser = user.id;

    const admin = admin0;
    const body = await req.json().catch(() => ({}));
    let { call_record_id, recording_url, organization_id, recording_path, recording_name } = body || {};
    if (!call_record_id) call_record_id = body?.callId;
    if (!call_record_id || !organization_id) {
      await audit("bad-request", { error_code: "missing-fields", http_status: 400 });
      return json({ error: "call_record_id and organization_id required" }, 400);
    }
    auditOrg = organization_id; auditCall = call_record_id;

    // Membership check
    const checks = await Promise.all([
      admin.from("organization_members").select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle(),
      admin.from("org_members").select("org_id").eq("user_id", user.id).eq("org_id", organization_id).maybeSingle(),
      admin.from("pbx_softphone_users").select("organization_id").eq("portal_user_id", user.id).eq("organization_id", organization_id).maybeSingle(),
      admin.from("user_roles").select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle(),
    ]);
    if (!checks.some((c) => c.data)) return json({ error: "Forbidden" }, 403);

    // Resolve call: callId may be a recording id, not a call record id
    let call: any = null;
    {
      const r = await admin.from("pbx_call_records")
        .select("id, caller_number, caller_name, destination_number, destination, direction, start_at, duration_seconds, billsec, hangup_cause, recording_url, recording_path, recording_name, voicemail_message")
        .eq("id", call_record_id).eq("organization_id", organization_id).maybeSingle();
      call = r.data;
    }
    if (!call) {
      const r = await admin.from("pbx_call_recordings")
        .select("call_record_id, recording_url, recording_path, recording_name, direction, recorded_at, duration_seconds")
        .eq("id", call_record_id).eq("organization_id", organization_id).maybeSingle();
      if (r.data?.call_record_id) {
        call_record_id = r.data.call_record_id;
        const r2 = await admin.from("pbx_call_records")
          .select("id, caller_number, caller_name, destination_number, destination, direction, start_at, duration_seconds, billsec, hangup_cause, recording_url, recording_path, recording_name, voicemail_message")
          .eq("id", call_record_id).maybeSingle();
        call = r2.data || { ...r.data, start_at: r.data.recorded_at };
      } else if (r.data) {
        call = { ...r.data, start_at: r.data.recorded_at };
      }
    }

    const sourceUrl = recording_url || call?.recording_url || null;
    const fallbackTranscript = [
      `Call ${call?.direction || "unknown"} from ${call?.caller_name || call?.caller_number || "unknown caller"} to ${call?.destination_number || call?.destination || "unknown destination"}.`,
      call?.start_at ? `Started at ${call.start_at}.` : "",
      `Duration ${call?.billsec || call?.duration_seconds || 0} seconds.`,
      call?.hangup_cause ? `Hangup cause: ${call.hangup_cause}.` : "",
    ].filter(Boolean).join("\n");

    const writeTranscript = async (text: string, provider: string) => {
      await admin.from("pbx_call_transcripts").delete().eq("call_record_id", call_record_id);
      await admin.from("pbx_call_transcripts").insert({
        organization_id, call_record_id, transcript_text: text, provider, language: "fr",
      });
      await admin.from("pbx_call_records").update({ transcribed: !provider.startsWith("stub") }).eq("id", call_record_id).then(() => {}, () => {});
    };

    // Try to fetch audio. Order: direct URL → Supabase Storage path → fusionpbx-proxy → twilio-recording-proxy
    let audioBytes: Uint8Array | null = null;
    let audioMime = "audio/wav";
    let audioSource: string | null = null;
    const fetchErrors: string[] = [];
    const isTwilio = /api\.twilio\.com/i.test(sourceUrl || "") || /^RE[0-9a-f]{32}$/i.test(call?.recording_name || "");

    try {
      // 1. Direct URL (skip for Twilio — needs basic auth via proxy)
      if (sourceUrl && !isTwilio) {
        try {
          const r = await fetch(sourceUrl);
          if (r.ok) {
            audioBytes = new Uint8Array(await r.arrayBuffer());
            audioMime = detectMime(sourceUrl, r.headers.get("content-type"));
            audioSource = "direct-url";
          } else {
            fetchErrors.push(`direct:${r.status}`);
          }
        } catch (e: any) { fetchErrors.push(`direct:${e?.message || "err"}`); }
      }

      // 2. Supabase Storage — verify bucket exists, then retry with
      //    exponential backoff so a recording that's still syncing from the
      //    PBX doesn't immediately fall through to "no audio".
      const storagePath = recording_path || call?.recording_path;
      var storagePendingSync = false;
      if (!audioBytes && storagePath && typeof storagePath === "string" && !storagePath.startsWith("http")) {
        const parts = storagePath.split("/");
        const bucket = parts.shift()!;
        const path = parts.join("/");
        const delays = [0, 750, 2000, 4000]; // ~7s upper bound total
        for (let attempt = 0; attempt < delays.length && !audioBytes; attempt++) {
          if (delays[attempt]) await new Promise((r) => setTimeout(r, delays[attempt]));
          try {
            const { data: bucketInfo } = await admin.storage.getBucket(bucket);
            if (!bucketInfo) {
              storagePendingSync = true;
              fetchErrors.push(`storage:bucket-missing:${bucket}:try${attempt + 1}`);
              continue;
            }
            const dl = await admin.storage.from(bucket).download(path);
            if (dl.data) {
              audioBytes = new Uint8Array(await dl.data.arrayBuffer());
              audioMime = detectMime(storagePath, dl.data.type);
              audioSource = "storage";
              storagePendingSync = false;
              break;
            }
            if (dl.error) {
              const msg = dl.error.message || "";
              const transient = /not.?found|temporar|timeout|fetch|network/i.test(msg);
              fetchErrors.push(`storage:${msg}:try${attempt + 1}`);
              storagePendingSync = transient;
              if (!transient) break;
            }
          } catch (e: any) {
            const msg = e?.message || "err";
            fetchErrors.push(`storage:${msg}:try${attempt + 1}`);
            storagePendingSync = /not.?found|temporar|timeout|fetch|network/i.test(msg);
          }
        }
      }

      // 3. FusionPBX proxy
      if (!audioBytes && (recording_path || recording_name || call?.recording_path || call?.recording_name)) {
        try {
          const proxyRes = await admin.functions.invoke("fusionpbx-proxy", {
            body: {
              organization_id, action: "get-recording",
              xml_cdr_uuid: call_record_id,
              record_path: recording_path || call?.recording_path,
              record_name: recording_name || call?.recording_name,
            },
          });
          const b64 = (proxyRes.data as any)?.audio_base64 || (proxyRes.data as any)?.recording_base64;
          if (b64) {
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            audioBytes = arr;
            audioMime = detectMime(recording_name || call?.recording_name || "");
            audioSource = "fusionpbx-proxy";
          } else if (proxyRes.error) {
            fetchErrors.push(`fusion:${proxyRes.error.message}`);
          }
        } catch (e: any) { fetchErrors.push(`fusion:${e?.message || "err"}`); }
      }

      // 4. Twilio recording proxy
      if (!audioBytes && (isTwilio || /^RE/.test(call?.recording_name || ""))) {
        try {
          const proxyRes = await admin.functions.invoke("twilio-recording-proxy", {
            body: { organization_id, recording_sid: call?.recording_name, recording_url: sourceUrl },
          });
          const b64 = (proxyRes.data as any)?.audio_base64;
          if (b64) {
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            audioBytes = arr;
            audioMime = "audio/wav";
            audioSource = "twilio-proxy";
          } else if (proxyRes.error) {
            fetchErrors.push(`twilio:${proxyRes.error.message}`);
          }
        } catch (e: any) { fetchErrors.push(`twilio:${e?.message || "err"}`); }
      }
    } catch (e: any) { fetchErrors.push(`outer:${e?.message || "err"}`); }

    console.log("ai-transcribe-call audio resolution", { call_record_id, audioSource, bytes: audioBytes?.length || 0, fetchErrors });

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      await writeTranscript(fallbackTranscript, "stub-no-key");
      await audit("missing-key", { error_code: "LOVABLE_API_KEY", message: "Lovable AI key not configured", provider: "lovable-ai" });
      return json({ transcript_text: fallbackTranscript, stub: true, reason: "missing-ai-key", fetchErrors });
    }
    if (!audioBytes || audioBytes.length === 0) {
      // Friendlier reason when there's no recording metadata at all yet.
      const hasAnyPath = !!(recording_path || call?.recording_path || recording_name || call?.recording_name || sourceUrl);
      const reason = hasAnyPath ? "no-audio" : "recording-not-synced";
      await writeTranscript(fallbackTranscript, `stub-${reason}`);
      await audit(reason, { error_code: reason, message: `fetch errors: ${fetchErrors.join("; ") || "none"}`, metadata: { fetchErrors } });
      return json({ transcript_text: fallbackTranscript, stub: true, reason, fetchErrors }, 200);
    }

    // Gemini supports inline audio up to ~20MB
    if (audioBytes.length > 20 * 1024 * 1024) {
      await writeTranscript(fallbackTranscript, "stub-too-large");
      await audit("ai-error", { error_code: "audio-too-large", message: `${audioBytes.length} bytes` });
      return json({ transcript_text: fallbackTranscript, stub: true, reason: "audio-too-large", size: audioBytes.length });
    }

    // Lovable AI Gateway (OpenAI-compatible) with inline audio
    const b64 = bufToBase64(audioBytes);
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": lovableKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcribe this phone call verbatim in the original language spoken (French or English). Label speakers as Agent: and Caller: on separate lines. Include filler words. Return ONLY the transcript text, no preamble, no commentary, no markdown." },
            { type: "input_audio", input_audio: { data: b64, format: audioMime.split("/")[1] || "wav" } },
          ],
        }],
      }),
    });
    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      console.error("ai gateway error", aiRes.status, errTxt);
      // 429 / 402 are user-facing billing issues — surface them, don't silently stub
      if (aiRes.status === 429 || aiRes.status === 402) {
        await audit("ai-error", { error_code: aiRes.status === 429 ? "rate-limited" : "credits-exhausted", http_status: aiRes.status, message: errTxt.slice(0, 400), provider: "lovable-ai", model: "google/gemini-2.5-pro" });
        return json({ error: aiRes.status === 429 ? "rate-limited" : "credits-exhausted", details: errTxt }, aiRes.status);
      }
      await writeTranscript(fallbackTranscript, `stub-ai-${aiRes.status}`);
      await audit("ai-error", { error_code: `ai_gateway_${aiRes.status}`, http_status: aiRes.status, message: errTxt.slice(0, 400), provider: "lovable-ai", model: "google/gemini-2.5-pro" });
      return json({ transcript_text: fallbackTranscript, stub: true, error: `ai_gateway_${aiRes.status}` });
    }
    const data = await aiRes.json();
    const finishReason = data?.choices?.[0]?.finish_reason;
    const transcript_text = String(data?.choices?.[0]?.message?.content || "").trim();
    console.log("ai-transcribe-call ai result", { finishReason, length: transcript_text.length, audioSource });
    if (!transcript_text) {
      await writeTranscript(fallbackTranscript, "stub-empty-ai");
      await audit("ai-error", { error_code: "empty-ai-response", message: `finish_reason: ${finishReason}`, provider: "lovable-ai", model: "google/gemini-2.5-pro" });
      return json({ transcript_text: fallbackTranscript, stub: true, reason: "empty-ai-response", finishReason });
    }
    await writeTranscript(transcript_text, "lovable-ai/gemini-2.5-pro");
    await audit("ok", { provider: "lovable-ai", model: "google/gemini-2.5-pro", metadata: { audioSource, length: transcript_text.length } });
    return json({ transcript_text, audioSource, finishReason });
  } catch (e: any) {
    console.error("ai-transcribe-call error", e);
    await audit("error", { error_code: "exception", message: String(e?.message || e).slice(0, 400) });
    return json({ error: e?.message || "transcription failed" }, 500);
  }
});
