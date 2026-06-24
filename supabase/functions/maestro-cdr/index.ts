// POST /functions/v1/maestro-cdr
// Body: { call_id: uuid }  — reads call row, pushes CDR to Maestro, triggers transcript pipeline.
import {
  adminClient,
  corsHeaders,
  getBrokerAuth,
  getMaestroConfig,
  json,
  maestroAudit,
  maestroFetch,
  normalizePhone,
  setPipelineStep,
} from "../_shared/maestro.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { call_id } = await req.json().catch(() => ({}));
    if (!call_id) return json({ success: false, error: "call_id_required" }, 400);

    const admin = adminClient();
    const { data: call } = await admin
      .from("planipret_phone_calls")
      .select(
        "id, user_id, direction, from_number, to_number, started_at, ended_at, duration_seconds, recording_url, maestro_synced, maestro_client_id, ns_call_id",
      )
      .eq("id", call_id)
      .maybeSingle();

    if (!call) return json({ success: false, error: "call_not_found" }, 404);
    if (call.maestro_synced) {
      return json({ success: true, already_synced: true });
    }

    const cfg = await getMaestroConfig(admin);
    if (!cfg.url || !cfg.key) {
      await setPipelineStep(admin, call_id, "cdr", "error", { reason: "not_configured" });
      return json({ success: false, error: "maestro_not_configured" }, 200);
    }

    await setPipelineStep(admin, call_id, "cdr", "running");
    const auth = await getBrokerAuth(admin, call.user_id);

    // Inline client lookup if not already set
    let maestroClientId = call.maestro_client_id ?? null;
    if (!maestroClientId) {
      const lookupPhone = call.direction === "inbound"
        ? normalizePhone(call.from_number)
        : normalizePhone(call.to_number);
      if (lookupPhone) {
        const lookup = await maestroFetch(cfg, {
          method: "GET",
          path: `/api/v1/clients/lookup?phone=${encodeURIComponent(lookupPhone)}`,
          token: auth.token,
        });
        if (lookup.ok && lookup.data) {
          const c = lookup.data?.client ?? lookup.data;
          maestroClientId = c?.id ?? c?.client_id ?? null;
        }
      }
    }

    // Fetch broker extension
    const { data: profile } = await admin
      .from("planipret_profiles")
      .select("ns_extension")
      .eq("user_id", call.user_id ?? "")
      .maybeSingle();

    const body = {
      call_id: call.ns_call_id ?? call.id,
      direction: call.direction,
      caller_number: call.from_number,
      callee_number: call.to_number,
      started_at: call.started_at,
      ended_at: call.ended_at,
      duration_sec: call.duration_seconds ?? 0,
      recording_url: call.recording_url,
      broker_ext: profile?.ns_extension ?? null,
      maestro_client_id: maestroClientId,
    };

    const res = await maestroFetch(cfg, {
      method: "POST",
      path: "/api/v1/calls/cdr",
      token: auth.token,
      body,
      idempotencyKey: call.id,
    });

    // 409 = already exists in Maestro; treat as success
    if (res.ok || res.status === 409) {
      await admin
        .from("planipret_phone_calls")
        .update({
          maestro_synced: true,
          maestro_call_id: res.data?.id ?? res.data?.call_id ?? null,
          maestro_client_id: maestroClientId,
        })
        .eq("id", call.id);
      await setPipelineStep(admin, call_id, "cdr", "done", { conflict: res.status === 409 });
      await maestroAudit(admin, "cdr_pushed", { call_id, status: res.status, client_id: maestroClientId });

      // Fire-and-forget transcript trigger (delayed via separate invocation)
      try {
        const supaUrl = Deno.env.get("SUPABASE_URL")!;
        const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
        // Don't await — fire and forget
        fetch(`${supaUrl}/functions/v1/maestro-transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
          body: JSON.stringify({ call_id }),
        }).catch(() => {});
      } catch {}

      return json({ success: true, maestro_call_id: res.data?.id ?? null, client_id: maestroClientId });
    }

    await setPipelineStep(admin, call_id, "cdr", "error", { status: res.status });
    await maestroAudit(admin, "cdr_failed", { call_id, status: res.status, data: res.data });
    return json({ success: false, status: res.status, details: res.data }, 200);
  } catch (e: any) {
    console.error("maestro-cdr error", e);
    return json({ success: false, error: e?.message ?? "server_error" }, 500);
  }
});
