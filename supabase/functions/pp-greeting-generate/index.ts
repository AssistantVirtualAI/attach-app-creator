// AVA Planiprêt — generate voicemail greeting (ElevenLabs TTS) and optionally
// push it to NS-API. Stores in voicemail-greetings bucket, updates profile.
import {
  AVA_ORG_ID,
  authBroker,
  corsHeaders,
  jsonResponse,
  nsBrokerFetch,
} from "../_shared/ns-broker.ts";

const DOMAIN = "planipret.ca";

type Body = {
  text?: string;
  voice_id?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  push_to_ns?: boolean; // false = preview only
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "method_not_allowed" }, 405);

  const auth = await authBroker(req);
  if ("error" in auth) return auth.error;
  const { admin, userId, profile } = auth;
  if (profile.organization_id !== AVA_ORG_ID) {
    return jsonResponse({ success: false, error: "wrong_org" }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const text = (body.text ?? "").trim();
  const voiceId = body.voice_id || "EXAVITQu4vr4xnSDxMaL";
  if (text.length < 10 || text.length > 500) {
    return jsonResponse({ success: false, error: "text_length_invalid" }, 400);
  }

  const elKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!elKey) return jsonResponse({ success: false, error: "elevenlabs_not_configured" }, 500);

  // Step 1: ElevenLabs TTS
  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": elKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: body.voice_settings?.stability ?? 0.6,
        similarity_boost: body.voice_settings?.similarity_boost ?? 0.8,
        style: body.voice_settings?.style ?? 0.3,
        use_speaker_boost: body.voice_settings?.use_speaker_boost ?? true,
      },
    }),
  });
  if (!ttsRes.ok) {
    const detail = await ttsRes.text().catch(() => "");
    return jsonResponse({ success: false, error: "tts_failed", detail, status: ttsRes.status }, 200);
  }
  const audioBytes = new Uint8Array(await ttsRes.arrayBuffer());

  // Step 2: Storage
  const fileName = `greeting_${userId}_${Date.now()}.mp3`;
  const path = `${profile.organization_id}/${userId}/${fileName}`;
  const { error: upErr } = await admin.storage
    .from("voicemail-greetings")
    .upload(path, audioBytes, { contentType: "audio/mpeg", upsert: false });
  if (upErr) return jsonResponse({ success: false, error: "storage_failed", detail: upErr.message }, 200);

  const { data: signed } = await admin.storage
    .from("voicemail-greetings")
    .createSignedUrl(path, 60 * 60 * 24); // 24h preview

  const audioUrl = signed?.signedUrl ?? null;

  // Step 3: profile update
  await admin
    .from("planipret_profiles")
    .update({
      voicemail_greeting_text: text,
      voicemail_greeting_voice_id: voiceId,
      voicemail_greeting_audio_url: path, // store the path; sign on demand
      voicemail_greeting_updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  // Step 4: optionally push to NS-API
  let pushedToNs = false;
  let pushMethod: string | null = null;
  let pushError: string | null = null;

  if (body.push_to_ns && profile.extension) {
    const ext = encodeURIComponent(profile.extension);
    const endpoint = `/domains/${DOMAIN}/users/${ext}/voicemails/greeting`;

    // Attempt 1: multipart upload
    try {
      const fd = new FormData();
      fd.append("file", new Blob([audioBytes], { type: "audio/mpeg" }), fileName);
      const r = await nsBrokerFetch(admin, profile, endpoint, { method: "PUT", body: fd as any });
      if (r.ok) { pushedToNs = true; pushMethod = "multipart"; }
      else pushError = `multipart_${r.status}`;
    } catch (e) { pushError = `multipart_exception: ${String(e)}`; }

    // Attempt 2: JSON with URL
    if (!pushedToNs && audioUrl) {
      try {
        const r = await nsBrokerFetch(admin, profile, endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ greeting_url: audioUrl }),
        });
        if (r.ok) { pushedToNs = true; pushMethod = "url"; pushError = null; }
        else pushError = (pushError ?? "") + `;url_${r.status}`;
      } catch (e) { pushError = (pushError ?? "") + `;url_exception: ${String(e)}`; }
    }

    if (pushedToNs) {
      await admin
        .from("planipret_profiles")
        .update({ voicemail_greeting_active: true })
        .eq("id", profile.id);
    }

    await admin.from("planipret_audit_log").insert({
      user_id: userId,
      action: "voicemail_greeting_push",
      metadata: {
        push_method: pushMethod,
        error: pushError,
        voice_id: voiceId,
        text_length: text.length,
      },
    }).then(() => null).catch(() => null);
  }

  // Voice name lookup (best effort)
  let voiceName = voiceId;
  try {
    const v = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { headers: { "xi-api-key": elKey } });
    if (v.ok) voiceName = (await v.json()).name ?? voiceId;
  } catch (_) { /* noop */ }

  return jsonResponse({
    success: true,
    audio_url: audioUrl,
    storage_path: path,
    duration_seconds: Math.round((audioBytes.length / 16000) * 1) || null,
    voice_name: voiceName,
    pushed_to_ns: pushedToNs,
    push_method: pushMethod,
    push_error: pushError,
    message: pushedToNs ? "Boîte vocale mise à jour avec succès" : "Audio généré (non publié)",
  });
});
