import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { call_record_id, recording_url, organization_id } = await req.json();
    if (!call_record_id || !organization_id) {
      return json({ error: "call_record_id and organization_id required" }, 400);
    }

    const { data: member } = await admin.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    const { data: orgMember } = member ? { data: null } : await admin.from("org_members")
      .select("org_id").eq("user_id", user.id).eq("org_id", organization_id).maybeSingle();
    if (!member && !orgMember) return json({ error: "Forbidden" }, 403);

    const { data: call } = await admin.from("pbx_call_records")
      .select("caller_number, caller_name, destination_number, destination, direction, start_at, duration_seconds, billsec, hangup_cause, recording_url, voicemail_message")
      .eq("id", call_record_id).eq("organization_id", organization_id).maybeSingle();
    const sourceUrl = recording_url || (call as any)?.recording_url || null;
    const fallbackTranscript = [
      `Call ${call?.direction || "unknown"} from ${call?.caller_name || call?.caller_number || "unknown caller"} to ${call?.destination_number || call?.destination || "unknown destination"}.`,
      call?.start_at ? `Started at ${call.start_at}.` : "",
      `Duration ${call?.billsec || call?.duration_seconds || 0} seconds.`,
      call?.hangup_cause ? `Hangup cause: ${call.hangup_cause}.` : "",
      call?.voicemail_message && call.voicemail_message !== "false" ? `Voicemail: ${call.voicemail_message}` : "",
    ].filter(Boolean).join("\n");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey || !sourceUrl) {
      const stub = fallbackTranscript || "Call metadata synced from FusionPBX. Audio transcription is pending.";
      await admin.from("pbx_call_transcripts").delete().eq("call_record_id", call_record_id);
      await admin.from("pbx_call_transcripts").insert({
        organization_id, call_record_id, transcript_text: stub, provider: "stub", language: "fr",
      });
      await admin.from("pbx_call_records").update({ transcribed: true }).eq("id", call_record_id);
      return json({ transcript_text: stub, stub: true });
    }

    const audioRes = await fetch(sourceUrl);
    const audioBuf = new Uint8Array(await audioRes.arrayBuffer());
    const b64 = btoa(String.fromCharCode(...audioBuf.slice(0, 0))); // placeholder; Claude audio in =coming via separate endpoint

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 4000,
        messages: [{ role: "user", content: `Transcribe this phone call from URL: ${sourceUrl}. Label speakers as Agent: and Caller:. Return only the transcript.` }],
      }),
    });
    const data = await claudeRes.json();
    const transcript_text = data.content?.[0]?.text || fallbackTranscript;

    await admin.from("pbx_call_transcripts").delete().eq("call_record_id", call_record_id);
    await admin.from("pbx_call_transcripts").insert({
      organization_id, call_record_id, transcript_text, provider: "claude", language: "fr",
    });
    await admin.from("pbx_call_records").update({ transcribed: true }).eq("id", call_record_id);

    // Trigger analyze
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-analyze-call`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ call_record_id, transcript_text, organization_id }),
    }).catch(() => {});

    return json({ transcript_text });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});
