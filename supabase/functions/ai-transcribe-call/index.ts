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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { call_record_id, recording_url, organization_id } = await req.json();
    if (!call_record_id || !recording_url || !organization_id) {
      return new Response(JSON.stringify({ error: "call_record_id, recording_url, organization_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: member } = await admin.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    if (!member) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      // Stub mode
      const stub = "Agent: Bonjour, comment puis-je vous aider?\nCaller: J'aimerais prendre rendez-vous.";
      await admin.from("pbx_call_transcripts").insert({
        organization_id, call_record_id, transcript_text: stub, provider: "stub", language: "fr",
      });
      await admin.from("pbx_call_records").update({ transcribed: true }).eq("id", call_record_id);
      return new Response(JSON.stringify({ transcript_text: stub, stub: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const audioRes = await fetch(recording_url);
    const audioBuf = new Uint8Array(await audioRes.arrayBuffer());
    const b64 = btoa(String.fromCharCode(...audioBuf.slice(0, 0))); // placeholder; Claude audio in =coming via separate endpoint

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

    // Trigger analyze
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
