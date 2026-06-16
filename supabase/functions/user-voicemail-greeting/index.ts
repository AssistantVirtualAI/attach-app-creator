// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";

const TOP_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice" },
];

async function ttsToBlob(text: string, voiceId: string): Promise<ArrayBuffer> {
  if (!ELEVEN_KEY) throw new Error("missing_elevenlabs_key");
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
      }),
    },
  );
  if (!r.ok) throw new Error("tts_failed: " + (await r.text()));
  return r.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "missing_auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "invalid_auth" }, 401);
    const userId = userRes.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { action, payload } = await req.json().catch(() => ({}));
    if (!action) return json({ error: "missing_action" }, 400);

    const { data: spu } = await admin
      .from("pbx_softphone_users")
      .select("id, organization_id, extension")
      .eq("portal_user_id", userId)
      .maybeSingle();

    if (action === "voices") return json({ voices: TOP_VOICES });

    if (action === "get_settings") {
      if (!spu) return json({ settings: null });
      const { data } = await admin
        .from("pbx_voicemail_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return json({ settings: data ?? null, voices: TOP_VOICES });
    }

    if (action === "save_settings") {
      if (!spu) return json({ error: "no_extension" }, 400);
      const row = {
        user_id: userId,
        organization_id: spu.organization_id,
        greeting_type: payload.greeting_type ?? "default",
        greeting_tts_text: payload.greeting_tts_text ?? null,
        greeting_voice_id: payload.greeting_voice_id ?? null,
        greeting_voice_name: payload.greeting_voice_name ?? null,
        greeting_storage_path: payload.greeting_storage_path ?? null,
        greeting_audio_url: payload.greeting_audio_url ?? null,
        transcription_enabled: payload.transcription_enabled ?? true,
        ai_summary_enabled: payload.ai_summary_enabled ?? true,
        notify_email: payload.notify_email ?? true,
        attach_audio_email: payload.attach_audio_email ?? false,
        greeting_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await admin
        .from("pbx_voicemail_settings")
        .upsert(row, { onConflict: "user_id" });
      if (error) throw error;
      await admin.from("audit_logs").insert({
        organization_id: spu.organization_id,
        user_id: userId,
        action: "voicemail_settings_saved",
        resource_type: "pbx_voicemail_settings",
        metadata: { source: "desktop_app", greeting_type: row.greeting_type },
      });
      return json({ ok: true });
    }

    if (action === "generate_tts") {
      if (!spu) return json({ error: "no_extension" }, 400);
      const text: string = String(payload?.text ?? "").trim();
      const voiceId: string = String(payload?.voice_id ?? "EXAVITQu4vr4xnSDxMaL");
      if (!text) return json({ error: "missing_text" }, 400);
      const audio = await ttsToBlob(text, voiceId);
      const path = `${spu.organization_id}/${userId}/greeting-${Date.now()}.mp3`;
      const { error: upErr } = await admin.storage.from("voicemail-greetings").upload(path, new Uint8Array(audio), {
        contentType: "audio/mpeg",
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: signed } = await admin.storage.from("voicemail-greetings").createSignedUrl(path, 3600);
      return json({ storage_path: path, url: signed?.signedUrl ?? null });
    }

    if (action === "get_greeting_url") {
      const path: string = payload?.path;
      if (!path) return json({ url: null });
      const { data, error } = await admin.storage.from("voicemail-greetings").createSignedUrl(path, 3600);
      if (error) throw error;
      return json({ url: data.signedUrl });
    }

    // ============= GREETINGS LIBRARY =============

    if (action === "list_greetings") {
      const { data, error } = await admin
        .from("pbx_voicemail_greetings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const greetings = await Promise.all((data ?? []).map(async (g: any) => {
        const { data: s } = await admin.storage.from("voicemail-greetings").createSignedUrl(g.storage_path, 3600);
        return { ...g, audio_url: s?.signedUrl ?? null };
      }));
      const { data: exts } = await admin
        .from("pbx_softphone_users")
        .select("extension, display_name")
        .eq("portal_user_id", userId);
      return json({ greetings, extensions: exts ?? [], voices: TOP_VOICES });
    }

    if (action === "create_greeting") {
      if (!spu) return json({ error: "no_extension" }, 400);
      const name: string = String(payload?.name ?? "").trim() || "Untitled greeting";
      const text: string = String(payload?.text ?? "").trim();
      const voiceId: string = String(payload?.voice_id ?? "EXAVITQu4vr4xnSDxMaL");
      const extension: string | null = payload?.extension ?? null;
      if (!text) return json({ error: "missing_text" }, 400);
      if (text.length > 2000) return json({ error: "text_too_long" }, 400);
      const voiceName = TOP_VOICES.find((v) => v.id === voiceId)?.name ?? null;

      // Insert as "generating" first so the UI can show progress / failure state.
      const { data: pending, error: pErr } = await admin
        .from("pbx_voicemail_greetings")
        .insert({
          user_id: userId,
          organization_id: spu.organization_id,
          extension,
          name,
          source: "tts",
          text_script: text,
          voice_id: voiceId,
          voice_name: voiceName,
          storage_path: `pending-${Date.now()}`,
          status: "generating",
          attempts: 1,
          last_attempt_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (pErr) throw pErr;

      try {
        const audio = await ttsToBlob(text, voiceId);
        const path = `${spu.organization_id}/${userId}/lib-${pending.id}.mp3`;
        const { error: upErr } = await admin.storage
          .from("voicemail-greetings")
          .upload(path, new Uint8Array(audio), { contentType: "audio/mpeg", upsert: true });
        if (upErr) throw upErr;
        const { data: row } = await admin
          .from("pbx_voicemail_greetings")
          .update({ storage_path: path, status: "ready", error_message: null })
          .eq("id", pending.id)
          .select()
          .single();
        const { data: signed } = await admin.storage.from("voicemail-greetings").createSignedUrl(path, 3600);
        return json({ greeting: { ...row, audio_url: signed?.signedUrl ?? null } });
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 500);
        await admin
          .from("pbx_voicemail_greetings")
          .update({ status: "failed", error_message: msg })
          .eq("id", pending.id);
        return json({ error: msg, greeting_id: pending.id }, 502);
      }
    }

    if (action === "retry_greeting") {
      if (!spu) return json({ error: "no_extension" }, 400);
      const id: string = payload?.id;
      if (!id) return json({ error: "missing_id" }, 400);
      const { data: g } = await admin
        .from("pbx_voicemail_greetings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!g || g.user_id !== userId) return json({ error: "forbidden" }, 403);
      if (!g.text_script) return json({ error: "no_script_to_retry" }, 400);
      await admin
        .from("pbx_voicemail_greetings")
        .update({
          status: "generating",
          error_message: null,
          attempts: (g.attempts ?? 0) + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", id);
      try {
        const audio = await ttsToBlob(g.text_script, g.voice_id ?? "EXAVITQu4vr4xnSDxMaL");
        const path = `${g.organization_id}/${userId}/lib-${g.id}.mp3`;
        const { error: upErr } = await admin.storage
          .from("voicemail-greetings")
          .upload(path, new Uint8Array(audio), { contentType: "audio/mpeg", upsert: true });
        if (upErr) throw upErr;
        const { data: row } = await admin
          .from("pbx_voicemail_greetings")
          .update({ storage_path: path, status: "ready", error_message: null })
          .eq("id", id)
          .select()
          .single();
        const { data: signed } = await admin.storage.from("voicemail-greetings").createSignedUrl(path, 3600);
        return json({ greeting: { ...row, audio_url: signed?.signedUrl ?? null } });
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 500);
        await admin
          .from("pbx_voicemail_greetings")
          .update({ status: "failed", error_message: msg })
          .eq("id", id);
        return json({ error: msg }, 502);
      }
    }

    if (action === "delete_greeting") {
      const id: string = payload?.id;
      if (!id) return json({ error: "missing_id" }, 400);
      const { data: g } = await admin
        .from("pbx_voicemail_greetings")
        .select("storage_path,user_id")
        .eq("id", id)
        .maybeSingle();
      if (!g || g.user_id !== userId) return json({ error: "forbidden" }, 403);
      await admin.storage.from("voicemail-greetings").remove([g.storage_path]).catch(() => {});
      await admin.from("pbx_voicemail_greetings").delete().eq("id", id);
      return json({ ok: true });
    }

    if (action === "activate_greeting") {
      if (!spu) return json({ error: "no_extension" }, 400);
      const id: string = payload?.id;
      if (!id) return json({ error: "missing_id" }, 400);
      const { data: g } = await admin
        .from("pbx_voicemail_greetings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!g || g.user_id !== userId) return json({ error: "forbidden" }, 403);
      let q = admin.from("pbx_voicemail_greetings").update({ is_active: false }).eq("user_id", userId);
      q = g.extension ? q.eq("extension", g.extension) : q.is("extension", null);
      await q;
      await admin.from("pbx_voicemail_greetings").update({ is_active: true }).eq("id", id);
      const { data: signed } = await admin.storage
        .from("voicemail-greetings")
        .createSignedUrl(g.storage_path, 3600);
      await admin.from("pbx_voicemail_settings").upsert({
        user_id: userId,
        organization_id: spu.organization_id,
        greeting_type: "tts",
        greeting_tts_text: g.text_script,
        greeting_voice_id: g.voice_id,
        greeting_voice_name: g.voice_name,
        greeting_storage_path: g.storage_path,
        greeting_audio_url: signed?.signedUrl ?? null,
        greeting_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      await admin.from("audit_logs").insert({
        organization_id: spu.organization_id,
        user_id: userId,
        action: "voicemail_greeting_activated",
        resource_type: "pbx_voicemail_greetings",
        resource_id: id,
        metadata: { extension: g.extension, name: g.name },
      });
      return json({ ok: true, audio_url: signed?.signedUrl ?? null });
    }

    if (action === "rename_greeting") {
      const id: string = payload?.id;
      const name: string = String(payload?.name ?? "").trim();
      if (!id || !name) return json({ error: "missing_fields" }, 400);
      const { error } = await admin
        .from("pbx_voicemail_greetings")
        .update({ name })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
