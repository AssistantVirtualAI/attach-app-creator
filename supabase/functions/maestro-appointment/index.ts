// POST /functions/v1/maestro-appointment
// Body: { maestro_client_id, title, start_at, end_at, notes?, type?, call_id? }
import {
  adminClient,
  corsHeaders,
  getBrokerAuth,
  getMaestroConfig,
  json,
  maestroAudit,
  maestroFetch,
} from "../_shared/maestro.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const { maestro_client_id, title, start_at, end_at, notes, type, call_id } = body;
    if (!maestro_client_id || !title || !start_at) {
      return json({ success: false, error: "missing_fields" }, 400);
    }
    const userIdHeader = req.headers.get("x-user-id");

    const admin = adminClient();
    const cfg = await getMaestroConfig(admin);
    if (!cfg.url || !cfg.key) return json({ success: false, error: "maestro_not_configured" }, 200);

    let userId = userIdHeader;
    if (!userId && call_id) {
      const { data } = await admin
        .from("planipret_phone_calls")
        .select("user_id")
        .eq("id", call_id)
        .maybeSingle();
      userId = data?.user_id ?? null;
    }
    const auth = await getBrokerAuth(admin, userId);

    const res = await maestroFetch(cfg, {
      method: "POST",
      path: `/api/v1/clients/${encodeURIComponent(maestro_client_id)}/appointments`,
      token: auth.token,
      body: {
        title,
        start_at,
        end_at: end_at ?? null,
        notes: notes ?? null,
        type: type ?? "phone",
        broker_id: auth.brokerId,
        related_call_id: call_id ?? null,
      },
    });

    if (!res.ok) {
      await maestroAudit(admin, "appt_create_failed", { client_id: maestro_client_id, status: res.status });
      return json({ success: false, status: res.status, details: res.data }, 200);
    }
    const apptId = res.data?.id ?? res.data?.appointment_id;
    await maestroAudit(admin, "appt_created", { appointment_id: apptId, call_id, client_id: maestro_client_id });
    return json({ success: true, appointment_id: apptId });
  } catch (e: any) {
    console.error("maestro-appointment error", e);
    return json({ success: false, error: e?.message ?? "server_error" }, 500);
  }
});
