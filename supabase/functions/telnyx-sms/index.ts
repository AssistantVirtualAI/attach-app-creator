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
    const { data: member } = await admin
      .from("organization_members").select("organization_id")
      .eq("user_id", user.id).eq("organization_id", "71755d33-ed64-4ad5-a828-61c9d2029eb7").maybeSingle();
    if (!member) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const { data: cfg } = await admin.from("lemtel_config").select("key, value").in("key", ["TELNYX_API_KEY", "TELNYX_MESSAGING_PROFILE_ID"]);
    const config = Object.fromEntries((cfg || []).map((r: any) => [r.key, r.value]));

    if (req.method === "POST") {
      const { from, to, text, media_urls } = await req.json();
      if (!from || !to || !text) throw new Error("from, to, text required");

      const res = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.TELNYX_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, text, media_urls, messaging_profile_id: config.TELNYX_MESSAGING_PROFILE_ID }),
      });
      const result = await res.json();

      // Append to thread
      const message = { direction: "outbound", text, media_urls, ts: new Date().toISOString(), id: result.data?.id };
      const { data: existing } = await admin.from("lemtel_sms_threads")
        .select("id, messages").eq("did_number", from).eq("contact_number", to).maybeSingle();
      if (existing) {
        await admin.from("lemtel_sms_threads").update({
          messages: [...(existing.messages || []), message], last_message_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await admin.from("lemtel_sms_threads").insert({
          did_number: from, contact_number: to, messages: [message], last_message_at: new Date().toISOString(),
        });
      }

      return new Response(JSON.stringify(result), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
