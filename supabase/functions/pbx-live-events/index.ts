// Receives FusionPBX/FreeSWITCH webhook events and upserts telecom_live_calls.
// Frontend subscribes to telecom_live_calls via Supabase Realtime.
import { corsHeaders, getServiceClient, jsonResponse } from "../_shared/fusionpbx.ts";

interface EventPayload {
  organizationId: string;
  channelUuid: string;
  state: "ringing" | "answered" | "hold" | "ended";
  direction?: string;
  callerNumber?: string;
  callerName?: string;
  destinationNumber?: string;
  extension?: string;
  queue?: string;
  sipCallId?: string;
  raw?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method not allowed" });
  const supabase = getServiceClient();
  const body = (await req.json().catch(() => null)) as EventPayload | null;
  if (!body?.organizationId || !body?.channelUuid || !body?.state) {
    return jsonResponse(400, { error: "missing required fields" });
  }
  const now = new Date().toISOString();
  if (body.state === "ended") {
    await supabase
      .from("telecom_live_calls")
      .delete()
      .eq("organization_id", body.organizationId)
      .eq("channel_uuid", body.channelUuid);
    return jsonResponse(200, { ok: true, removed: true });
  }
  const row: Record<string, unknown> = {
    organization_id: body.organizationId,
    channel_uuid: body.channelUuid,
    state: body.state,
    direction: body.direction ?? null,
    caller_number: body.callerNumber ?? null,
    caller_name: body.callerName ?? null,
    destination_number: body.destinationNumber ?? null,
    extension: body.extension ?? null,
    queue: body.queue ?? null,
    sip_call_id: body.sipCallId ?? null,
    last_event_at: now,
    raw: body.raw ?? {},
  };
  if (body.state === "answered") row.answered_at = now;
  const { error } = await supabase
    .from("telecom_live_calls")
    .upsert(row, { onConflict: "organization_id,channel_uuid" });
  if (error) return jsonResponse(500, { error: error.message });
  return jsonResponse(200, { ok: true });
});
