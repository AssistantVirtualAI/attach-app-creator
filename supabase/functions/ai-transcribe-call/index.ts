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
    let { call_record_id, recording_url, organization_id, recording_path, recording_name, xml_cdr_uuid, record_name, record_path, domain_uuid } = body || {};
    // Accept aliases from UI
    recording_name = recording_name || record_name;
    recording_path = recording_path || record_path;
    if (!call_record_id) call_record_id = xml_cdr_uuid;
    if (!call_record_id) call_record_id = body?.callId;
    if (!organization_id) {
      const { data: sp } = await admin.from("pbx_softphone_users")
        .select("organization_id")
        .eq("portal_user_id", user.id)
        .maybeSingle();
      organization_id = sp?.organization_id || null;
    }
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
        .select("id, caller_number, caller_name, destination_number, destination, direction, start_at, duration_seconds, billsec, hangup_cause, recording_url, recording_path, recording_name, voicemail_message, domain_uuid, domain_name")
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
          .select("id, caller_number, caller_name, destination_number, destination, direction, start_at, duration_seconds, billsec, hangup_cause, recording_url, recording_path, recording_name, voicemail_message, domain_uuid, domain_name")
          .eq("id", call_record_id).maybeSingle();
        call = r2.data || { ...r.data, start_at: r.data.recorded_at };
      } else if (r.data) {
        call = { ...r.data, start_at: r.data.recorded_at };
      }
    }

    const persistTranscriptOnCall = async (text: string, provider: string) => {
      const { data: existingCall } = await admin.from("pbx_call_records")
        .select("raw_data, ai_summary, sentiment, call_score, coaching_points")
        .eq("id", call_record_id)
        .maybeSingle();
      // Save transcript to ALL columns so every platform sees it via Realtime
      await admin.from("pbx_call_records").update({
        transcribed: !provider.startsWith("stub"),
        transcription: text,
        analyzed: false,
        ai_processing: false,
        raw_data: {
          ...((existingCall?.raw_data as Record<string, unknown>) || {}),
          transcript_text: text,
          transcript_provider: provider,
          transcript_updated_at: new Date().toISOString(),
        },
      }).eq("id", call_record_id).then(() => {}, () => {});
    };

    if (body?.force !== true) {
      const { data: existingTranscript } = await admin.from("pbx_call_transcripts")
        .select("transcript_text, provider, created_at")
        .eq("call_record_id", call_record_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const provider = String((existingTranscript as any)?.provider || "");
      const text = String((existingTranscript as any)?.transcript_text || "").trim();
      if (text && !provider.startsWith("stub")) {
        await persistTranscriptOnCall(text, provider);
        await audit("cached", { provider, message: "Transcript already exists — skipped re-transcription", metadata: { cached_at: (existingTranscript as any)?.created_at } });
        return json({ transcript_text: text, cached: true, stub: false, provider, skipped_reason: "Transcript already exists — no STT tokens used." });
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
      await persistTranscriptOnCall(text, provider);
    };

    // Try to fetch audio. Order: FusionPBX first (recordings live on PBX) → direct URL → Twilio
    let audioBytes: Uint8Array | null = null;
    let audioMime = "audio/wav";
    let audioSource: string | null = null;
    const fetchErrors: string[] = [];
    var storagePendingSync = false;
    const isTwilio = /api\.twilio\.com/i.test(sourceUrl || "") || /^RE[0-9a-f]{32}$/i.test(call?.recording_name || "");

    const effectiveRecName = recording_name || call?.recording_name;
    const effectiveRecPath = recording_path || call?.recording_path;

    try {
      // 1. FusionPBX FIRST — recordings live on PBX, not Supabase Storage.
      // IMPORTANT: fusionpbx-proxy reads from body.params (same shape the
      // mobile app uses via loadPbxRecordingAudioMobile). Sending flat fields
      // makes the proxy resolve nothing and return RECORDING_NOT_FOUND.
      if (!isTwilio && (effectiveRecName || effectiveRecPath || call_record_id)) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const recName = effectiveRecName
          ? (/\.(mp3|wav|ogg|m4a|webm)$/i.test(effectiveRecName) ? effectiveRecName : `${effectiveRecName}.mp3`)
          : "";
        const proxyPayload = {
          organization_id,
          params: {
            xml_cdr_uuid: call_record_id,
            record_path: effectiveRecPath || "",
            record_name: recName,
            domain_uuid: domain_uuid || call?.domain_uuid || undefined,
            domain_name: call?.domain_name || undefined,
            recorded_at: call?.start_at || undefined,
            local_recording_url: sourceUrl || undefined,
            expires_in: 300,
          },
        };

        // 1a. Try signed-url first (matches mobile path that's known to work).
        try {
          const signed = await fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
            body: JSON.stringify({ action: "get-recording-signed-url", ...proxyPayload }),
          });
          if (signed.ok) {
            const j = await signed.json().catch(() => null);
            const url = (j as any)?.url;
            if (url) {
              const r = await fetch(url);
              if (r.ok) {
                audioBytes = new Uint8Array(await r.arrayBuffer());
                audioMime = detectMime(url, r.headers.get("content-type"));
                audioSource = "fusionpbx-signed-url";
              } else {
                fetchErrors.push(`fusion-signed:${r.status}`);
              }
            } else {
              fetchErrors.push(`fusion-signed:${(j as any)?.error || "no-url"}`);
            }
          } else {
            const errTxt = await signed.text().catch(() => "");
            fetchErrors.push(`fusion-signed:${signed.status}:${errTxt.slice(0, 120)}`);
          }
        } catch (e: any) { fetchErrors.push(`fusion-signed:${e?.message || "err"}`); }

        // 1b. Fall back to binary get-recording.
        if (!audioBytes) {
          try {
            const proxyRes = await fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
              body: JSON.stringify({ action: "get-recording", ...proxyPayload }),
            });
            const ct = proxyRes.headers.get("content-type") || "";
            if (proxyRes.ok && /audio\//i.test(ct)) {
              audioBytes = new Uint8Array(await proxyRes.arrayBuffer());
              audioMime = ct.split(";")[0];
              audioSource = "fusionpbx-proxy";
            } else if (proxyRes.ok && /json/i.test(ct)) {
              const j = await proxyRes.json().catch(() => null);
              const b64 = (j as any)?.audio_base64 || (j as any)?.recording_base64;
              if (b64) {
                const bin = atob(b64);
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                audioBytes = arr;
                audioMime = detectMime(recName);
                audioSource = "fusionpbx-proxy";
              } else {
                fetchErrors.push(`fusion:${(j as any)?.error || "no-audio"}`);
              }
            } else {
              const errTxt = await proxyRes.text().catch(() => "");
              fetchErrors.push(`fusion:${proxyRes.status}:${errTxt.slice(0, 120)}`);
            }
          } catch (e: any) { fetchErrors.push(`fusion:${e?.message || "err"}`); }
        }
      }


      // 2. Direct URL fallback
      if (!audioBytes && sourceUrl && !isTwilio) {
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

      // 3. Twilio recording proxy
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
      // Surface specific PBX errors so the UI can show actionable messages.
      const errBlob = fetchErrors.join(" | ");
      const isAuth = /FUSIONPBX_AUTH_FAILED|login[_ ]failed|401|403/i.test(errBlob);
      const isNotFound = /RECORDING_NOT_FOUND|no-url|file_missing/i.test(errBlob);
      const hasAnyPath = !!(recording_path || call?.recording_path || recording_name || call?.recording_name || sourceUrl);
      let reason: string;
      let retryAfterMs = 0;
      if (isAuth) {
        reason = "pbx-auth-failed";
      } else if (storagePendingSync) {
        reason = "recording-pending-sync";
        retryAfterMs = 15000;
      } else if (isNotFound) {
        reason = "recording-not-found";
      } else {
        reason = hasAnyPath ? "no-audio" : "recording-not-synced";
        if (reason === "recording-not-synced") retryAfterMs = 20000;
      }
      console.error("ai-transcribe-call NO_AUDIO", { call_record_id, reason, fetchErrors });
      await writeTranscript(fallbackTranscript, `stub-${reason}`);
      await audit(reason, { error_code: reason, message: `fetch errors: ${errBlob || "none"}`, metadata: { fetchErrors, retryAfterMs } });
      return json({ transcript_text: fallbackTranscript, stub: true, reason, fetchErrors, retry_after_ms: retryAfterMs, pending_sync: storagePendingSync || reason === "recording-not-synced" }, 200);
    }

    // Gemini supports inline audio up to ~20MB
    if (audioBytes.length > 20 * 1024 * 1024) {
      await writeTranscript(fallbackTranscript, "stub-too-large");
      await audit("ai-error", { error_code: "audio-too-large", message: `${audioBytes.length} bytes` });
      return json({ transcript_text: fallbackTranscript, stub: true, reason: "audio-too-large", size: audioBytes.length });
    }

    // STT: Lovable Gateway gpt-4o-mini-transcribe ONLY (no audio fallback).
    // Claude 3.5 Sonnet runs after for TEXT cleanup / speaker labels.
    const audioFormat = audioMime.split("/")[1] || "wav";
    const sttPrompt = "Transcribe verbatim. Preserve French or English. Include filler words.";

    type ProviderResult = { text?: string; provider: string; model: string; error?: string; status?: number };

    const tryGatewayTranscribe = async (model: string): Promise<ProviderResult> => {
      const ext = ({ mpeg: "mp3", mp3: "mp3", wav: "wav", webm: "webm", ogg: "ogg", mp4: "m4a" } as Record<string, string>)[audioFormat] || "wav";
      const fd = new FormData();
      fd.append("model", model);
      fd.append("file", new Blob([audioBytes!], { type: audioMime }), `recording.${ext}`);
      fd.append("prompt", sttPrompt);
      const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "edge-function" },
        body: fd,
      });
      if (!r.ok) {
        const errTxt = await r.text();
        console.error(`gateway STT ${model} error`, r.status, errTxt.slice(0, 300));
        return { error: errTxt.slice(0, 400), status: r.status, provider: "lovable-ai", model };
      }
      const d = await r.json();
      return { text: String(d?.text || "").trim(), provider: "lovable-ai", model };
    };

    // Claude post-processing: TEXT cleanup only (Anthropic Messages API has no audio input).
    const claudePostProcess = async (raw: string): Promise<{ text: string; used: boolean; error?: string; status?: number }> => {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) return { text: raw, used: false, error: "no-anthropic-key" };
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 8000,
            system: "You clean up phone-call transcripts. Preserve the original language (French or English). Label speakers as 'Agent:' and 'Caller:' on separate lines. Keep meaning intact, remove duplicate stutters, fix obvious STT errors. Return ONLY the cleaned transcript — no preamble, no markdown, no commentary.",
            messages: [{ role: "user", content: `Clean and re-label this transcript:\n\n${raw}` }],
          }),
        });
        if (!r.ok) {
          const errTxt = await r.text();
          console.error("claude cleanup error", r.status, errTxt.slice(0, 300));
          return { text: raw, used: false, error: errTxt.slice(0, 400), status: r.status };
        }
        const d = await r.json();
        const cleaned = String(d?.content?.[0]?.text || "").trim();
        return cleaned ? { text: cleaned, used: true } : { text: raw, used: false, error: "empty-cleanup" };
      } catch (e: any) {
        return { text: raw, used: false, error: e?.message || "err" };
      }
    };

    const disableClaude = body?.disable_claude === true;
    const attempts: Array<{ provider: string; model: string; status?: number; error?: string }> = [];

    // PRIMARY: OpenAI Whisper-1 — best accuracy on 8kHz phone audio.
    const tryOpenAIWhisper = async (): Promise<ProviderResult> => {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) return { error: "no-openai-key", provider: "openai", model: "whisper-1" };
      const ext = ({ mpeg: "mp3", mp3: "mp3", wav: "wav", webm: "webm", ogg: "ogg", mp4: "m4a" } as Record<string, string>)[audioFormat] || "wav";
      const fd = new FormData();
      fd.append("model", "whisper-1");
      fd.append("file", new Blob([audioBytes!], { type: audioMime }), `recording.${ext}`);
      fd.append("language", "fr");
      fd.append("response_format", "json");
      fd.append("prompt", sttPrompt);
      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}` },
        body: fd,
      });
      if (!r.ok) {
        const errTxt = await r.text();
        console.error("openai whisper error", r.status, errTxt.slice(0, 300));
        return { error: errTxt.slice(0, 400), status: r.status, provider: "openai", model: "whisper-1" };
      }
      const d = await r.json();
      return { text: String(d?.text || "").trim(), provider: "openai", model: "whisper-1" };
    };

    let sttResult = await tryOpenAIWhisper();
    if (!sttResult.text) {
      attempts.push({ provider: sttResult.provider, model: sttResult.model, status: sttResult.status, error: (sttResult.error || "empty").slice(0, 200) });
      // FALLBACK: Lovable Gateway (Gemini-based) STT.
      sttResult = await tryGatewayTranscribe("openai/gpt-4o-mini-transcribe");
    }
    const final: ProviderResult | null = sttResult.text ? sttResult : null;
    if (!sttResult.text) {
      attempts.push({ provider: sttResult.provider, model: sttResult.model, status: sttResult.status, error: (sttResult.error || "empty").slice(0, 200) });
      if (sttResult.status === 402) {
        await audit("ai-error", { error_code: "credits-exhausted", http_status: 402, message: sttResult.error, provider: sttResult.provider, model: sttResult.model });
        return json({ error: "credits-exhausted", details: sttResult.error, attempts }, 402);
      }
    }




    if (!final?.text) {
      await writeTranscript(fallbackTranscript, "stub-all-providers-failed");
      await audit("ai-error", { error_code: "all-providers-failed", message: JSON.stringify(attempts).slice(0, 400) });
      return json({ transcript_text: fallbackTranscript, stub: true, reason: "all-providers-failed", attempts }, 200);
    }

    let finalText = final.text;
    let providerLabel = `${final.provider}/${final.model}`;
    let cleanupInfo: any = { used: false };
    if (!disableClaude) {
      const cleanup = await claudePostProcess(final.text);
      cleanupInfo = cleanup;
      if (cleanup.used && cleanup.text) {
        finalText = cleanup.text;
        providerLabel = `${final.provider}/${final.model}+claude-3-5-sonnet-cleanup`;
      }
    }
    console.log("ai-transcribe-call ai result", { provider: providerLabel, length: finalText.length, audioSource, attempts, cleanup: cleanupInfo });
    await writeTranscript(finalText, providerLabel);
    await audit("ok", { provider: final.provider, model: final.model, metadata: { audioSource, length: finalText.length, attempts, claude_cleanup: cleanupInfo } });
    return json({ transcript_text: finalText, audioSource, provider: providerLabel, attempts, claude_cleanup: cleanupInfo });

  } catch (e: any) {
    console.error("ai-transcribe-call error", e);
    await audit("error", { error_code: "exception", message: String(e?.message || e).slice(0, 400) });
    return json({ error: e?.message || "transcription failed" }, 500);
  }
});
