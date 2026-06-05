import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const event = payload?.data;
    if (event?.event_type !== "message.received") return new Response("ok", { headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const from = event.payload.from.phone_number;
    const to = event.payload.to[0].phone_number;
    const text = event.payload.text;

    const message = { direction: "inbound", text, ts: new Date().toISOString(), id: event.payload.id };
    const { data: existing } = await admin.from("lemtel_sms_threads")
      .select("id, messages, unread_count").eq("did_number", to).eq("contact_number", from).maybeSingle();
    if (existing) {
      await admin.from("lemtel_sms_threads").update({
        messages: [...(existing.messages || []), message],
        last_message_at: new Date().toISOString(),
        unread_count: (existing.unread_count || 0) + 1,
      }).eq("id", existing.id);
    } else {
      await admin.from("lemtel_sms_threads").insert({
        did_number: to, contact_number: from, messages: [message],
        last_message_at: new Date().toISOString(), unread_count: 1,
      });
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
