// pp-admin-transcribe — Transcribe a planipret_phone_calls row via Lovable AI.
// Resolves a fresh recording URL, fetches the audio, and stores the transcript.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("is_planipret_admin", { _user_id: userData.user.id });
    const { data: isMember } = await admin.rpc("is_planipret_member", { _user_id: userData.user.id });
    if (isAdmin !== true && isMember !== true) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const callId = body.call_id ?? body.call_row_id ?? body.id;
    if (!callId) return json({ error: "call_id required" }, 400);

    const { data: row } = await admin
      .from("planipret_phone_calls")
      .select("id, recording_url, transcript")
      .eq("id", callId)
      .maybeSingle();
    if (!row) return json({ error: "call not found" }, 404);
    if (row.transcript) return json({ ok: true, transcript: row.transcript, cached: true });

    // Resolve fresh URL
    let recUrl = row.recording_url as string | null;
    const resolveRes = await fetch(`${SUPABASE_URL}/functions/v1/pp-admin-recording-resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({ call_row_id: callId, force: true }),
    });
    if (resolveRes.ok) {
      const j = await resolveRes.json().catch(() => ({}));
      if (j?.recording_url) recUrl = j.recording_url;
    }
    if (!recUrl) return json({ error: "no recording available" }, 422);

    // Fetch audio
    const audioRes = await fetch(recUrl);
    if (!audioRes.ok) return json({ error: `audio fetch failed (${audioRes.status})` }, 502);
    const audioBuf = new Uint8Array(await audioRes.arrayBuffer());
    if (audioBuf.length < 1024) return json({ error: "audio empty" }, 422);

    // Call Lovable AI transcription
    const ct = audioRes.headers.get("content-type") ?? "audio/wav";
    const ext = ct.includes("mp3") ? "mp3" : ct.includes("mp4") ? "mp4" : ct.includes("webm") ? "webm" : "wav";
    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([audioBuf], { type: ct }), `recording.${ext}`);

    const sttRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: form,
    });
    if (!sttRes.ok) {
      const t = await sttRes.text().catch(() => "");
      return json({ error: `STT failed (${sttRes.status})`, detail: t.slice(0, 400) }, sttRes.status === 402 ? 402 : 502);
    }
    const sttJson = await sttRes.json().catch(() => ({}));
    const transcript = String(sttJson?.text ?? "").trim();
    if (!transcript) return json({ error: "empty transcript" }, 422);

    await admin.from("planipret_phone_calls")
      .update({ transcript, recording_url: recUrl })
      .eq("id", callId);

    return json({ ok: true, transcript });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
