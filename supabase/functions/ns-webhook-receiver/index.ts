import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

const ok = () => new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // FIX 2 — strict shared-secret validation
  const expected = Deno.env.get("NS_WEBHOOK_SECRET");
  const got = req.headers.get("x-webhook-secret")
    ?? req.headers.get("authorization")?.replace("Bearer ", "")
    ?? req.headers.get("x-ns-secret");
  if (!expected || got !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event: any;
  try { event = await req.json(); } catch { return ok(); }

  // FIX 4 — return 200 immediately, process async
  EdgeRuntime.waitUntil(processEvent(event).catch((e) => console.error("ns-webhook async error", e)));
  return ok();
});

async function processEvent(event: any) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const type = event?.type ?? event?.event?.type;
  const data = event?.data ?? event?.payload ?? event;

  const ext = data?.extension ?? data?.user ?? data?.to ?? data?.callee ?? null;
  let userId: string | null = null;
  let brokerProfile: any = null;
  if (ext) {
    const { data: p } = await admin
      .from("planipret_profiles").select("user_id, dnd_enabled, dnd_auto_schedule, dnd_start_time, dnd_end_time, dnd_message_fr")
      .eq("extension", String(ext)).maybeSingle();
    userId = p?.user_id ?? null;
    brokerProfile = p;
  }

  function isDndActive(p: any): boolean {
    if (!p) return false;
    if (p.dnd_enabled) return true;
    if (p.dnd_auto_schedule && p.dnd_start_time && p.dnd_end_time) {
      const now = new Date();
      const hh = now.getHours(), mm = now.getMinutes();
      const cur = hh * 60 + mm;
      const [sh, sm] = String(p.dnd_start_time).split(":").map(Number);
      const [eh, em] = String(p.dnd_end_time).split(":").map(Number);
      const s = sh * 60 + sm, e = eh * 60 + em;
      if (s < e) return cur >= s && cur < e;
      return cur >= s || cur < e; // overnight window
    }
    return false;
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
}
