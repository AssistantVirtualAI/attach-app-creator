import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Shared secret check
  const expected = Deno.env.get("NS_WEBHOOK_SECRET");
  const got = req.headers.get("x-webhook-secret") ?? req.headers.get("x-ns-secret");
  if (!expected || got !== expected) {
    console.warn("ns-webhook-receiver: bad secret");
    return new Response("ok", { status: 200 }); // always 200 to NS
  }

  let event: any;
  try { event = await req.json(); } catch { return ok(); }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const type = event?.type ?? event?.event?.type;
    const data = event?.data ?? event?.payload ?? event;

    // Resolve user_id from ns_extension when possible
    const ext = data?.extension ?? data?.user ?? data?.to ?? data?.callee ?? null;
    let userId: string | null = null;
    if (ext) {
      const { data: p } = await admin
        .from("planipret_profiles").select("user_id").eq("extension", String(ext)).maybeSingle();
      userId = p?.user_id ?? null;
    }

    if (type === "cdr") {
      const callId = data.call_id ?? data.id;
      if (callId) {
        await admin.from("planipret_phone_calls").upsert({
          user_id: userId,
          call_id: callId,
          direction: data.direction ?? null,
          caller_number: data.caller_number ?? data.from ?? null,
          callee_number: data.callee_number ?? data.to ?? null,
          duration_seconds: data.duration ?? data.duration_seconds ?? null,
          status: "completed",
        }, { onConflict: "call_id" });

        // Fire-and-forget triggers
        const authH = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
        fetch(`${SUPABASE_URL}/functions/v1/ns-transcription?call_id=${encodeURIComponent(callId)}`, {
          method: "GET", headers: { Authorization: authH },
        }).catch(() => {});
        fetch(`${SUPABASE_URL}/functions/v1/ai-analyze-call`, {
          method: "POST", headers: { Authorization: authH, "Content-Type": "application/json" },
          body: JSON.stringify({ call_id: callId }),
        }).catch(() => {});
      }
    } else if (type === "call.inbound") {
      const callId = data.call_id ?? data.id;
      await admin.from("planipret_phone_calls").insert({
        user_id: userId, call_id: callId, direction: "inbound",
        caller_number: data.from_number ?? data.from ?? null,
        callee_number: data.to_number ?? data.to ?? null,
        status: "inbound_ringing",
      });
      if (userId) {
        await admin.channel(`call-events:${userId}`).send({
          type: "broadcast", event: "inbound_call",
          payload: { type: "inbound_call", call_id: callId, from_number: data.from_number ?? data.from, to_number: data.to_number ?? data.to },
        });
      }
    } else if (type === "message.inbound") {
      await admin.from("planipret_phone_messages").insert({
        user_id: userId, direction: "inbound",
        from_number: data.from_number ?? data.from ?? null,
        to_number: data.to_number ?? data.to ?? null,
        body: data.body ?? data.message ?? "",
        type: "sms",
      });
      if (userId) {
        await admin.channel(`messages:${userId}`).send({
          type: "broadcast", event: "inbound_message",
          payload: { from_number: data.from_number ?? data.from, body: data.body ?? data.message },
        });
      }
    } else if (type === "voicemail.new") {
      const vmId = data.vm_id ?? data.id;
      await admin.from("planipret_voicemails").insert({
        user_id: userId, vm_id: vmId,
        from_number: data.from_number ?? data.from ?? null,
        duration_seconds: data.duration ?? data.duration_seconds ?? null,
        is_read: false,
      });
      if (userId) {
        await admin.channel(`voicemails:${userId}`).send({
          type: "broadcast", event: "new_voicemail",
          payload: { vm_id: vmId, from_number: data.from_number ?? data.from },
        });
      }
    }
  } catch (e) {
    console.error("ns-webhook-receiver error", e);
  }
  return ok();
});
