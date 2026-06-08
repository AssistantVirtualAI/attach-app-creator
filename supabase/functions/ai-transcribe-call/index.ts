// ai-transcribe-call: looks up recording_url from pbx_call_records when not provided.
// Returns { error: 'NO_RECORDING_YET' } with status 200 when no recording exists yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({} as any));
    let { call_record_id, recording_url, organization_id } = body;

    if (!call_record_id || !organization_id) {
      return new Response(JSON.stringify({ error: "call_record_id and organization_id required" }), { status: 400, headers: corsHeaders });
    }

    // Authorize org membership.
    const { data: member } = await admin.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    if (!member) {
      // Allow softphone users in this org too.
      const { data: sp } = await admin.from("pbx_softphone_users")
        .select("organization_id").eq("portal_user_id", user.id).eq("organization_id", organization_id).maybeSingle();
      if (!sp) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // Look up recording_url server-side when not supplied.
    if (!recording_url) {
      const { data: rec } = await admin.from("pbx_call_records")
        .select("recording_url, has_recording")
        .eq("id", call_record_id).maybeSingle();
      recording_url = rec?.recording_url || null;
    }

    if (!recording_url) {
      return new Response(JSON.stringify({
        error: "NO_RECORDING_YET",
        message: "Recording is not yet available. Try again in a few moments.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      const stub = "Agent: Bonjour, comment puis-je vous aider?\nCaller: J'aimerais prendre rendez-vous.";
      await admin.from("pbx_call_transcripts").insert({
        organization_id, call_record_id, transcript_text: stub, provider: "stub", language: "fr",
      });
      await admin.from("pbx_call_records").update({ transcribed: true }).eq("id", call_record_id);
      return new Response(JSON.stringify({ transcript_text: stub, stub: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 4000,
        messages: [{ role: "user", content: `Transcribe this phone call from URL: ${recording_url}. Label speakers as Agent: and Caller:. Return only the transcript.` }],
      }),
    });
    const data = await claudeRes.json();
    const transcript_text = data.content?.[0]?.text || "";

    await admin.from("pbx_call_transcripts").insert({
      organization_id, call_record_id, transcript_text, provider: "claude", language: "fr",
    });
    await admin.from("pbx_call_records").update({ transcribed: true }).eq("id", call_record_id);

    // Trigger analyze (best-effort)
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-analyze-call`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ call_record_id, transcript_text, organization_id }),
    }).catch(() => {});

    return new Response(JSON.stringify({ transcript_text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
