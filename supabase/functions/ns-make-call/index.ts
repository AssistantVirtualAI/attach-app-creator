// ns-make-call — outbound call initiation via NS-API v2 (official endpoint).
// Reference: NS-API v2 — POST /domains/{domain}/users/{extension}/calls
// Body: { destination, "caller-id-number", "caller-id-name" }
//
// This is the canonical outbound entry point used by the mobile app and the
// desktop softphone when a click-to-call is needed instead of a WebRTC INVITE.

import {
  authBroker,
  corsHeaders,
  jsonResponse,
  logAudit,
  nsBrokerFetch,
  nsEnv,
  nsPath,
} from "../_shared/ns-broker.ts";

function toE164(raw: string): string {
  const s = String(raw).trim();
  if (s.startsWith("+")) return s;
  let d = s.replace(/\D/g, "");
  if (d.length === 10) d = "1" + d;
  return "+" + d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed", code: 405 }, 405);
  }

  try {
    const auth = await authBroker(req);
    if ("error" in auth) return auth.error;
    const { admin, userId, profile } = auth;
    const env = nsEnv();
    const ext = profile.extension;
    if (!ext) return jsonResponse({ success: false, error: "NO_EXTENSION", code: 400 }, 400);

    const body = await req.json().catch(() => ({} as any));
    const rawDest =
      body?.to_number ?? body?.destination ?? body?.number ?? body?.to ?? null;
    if (!rawDest || typeof rawDest !== "string") {
      return jsonResponse({ success: false, error: "destination requise", code: 400 }, 400);
    }
    const destination = toE164(rawDest);

    const callerIdNumber = body?.caller_id_number ?? body?.["caller-id-number"] ?? ext;
    const callerIdName =
      body?.caller_id_name ?? body?.["caller-id-name"] ?? profile.full_name ?? "Courtier Planiprêt";

    // NS-API v2 outbound call — user-scoped path.
    const path = nsPath(env.domain, ext, "/calls");
    const res = await nsBrokerFetch(admin, profile, path, {
      method: "POST",
      body: JSON.stringify({
        destination,
        "caller-id-number": callerIdNumber,
        "caller-id-name": callerIdName,
      }),
    });

    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      return jsonResponse({
        success: false,
        error: typeof data === "string" ? data : (data?.message ?? "NS-API error"),
        code: res.status,
      }, 200);
    }

    const callId = data?.["call-id"] ?? data?.call_id ?? data?.id ?? null;

    // Record the attempt in planipret_phone_calls so the CDR tab reflects it.
    try {
      await admin.from("planipret_phone_calls").insert({
        user_id: userId,
        call_id: callId,
        direction: "outbound",
        caller_number: callerIdNumber,
        callee_number: destination,
        status: "outbound_ringing",
      });
    } catch { /* non-fatal */ }

    await logAudit(admin, req, {
      user_id: profile.id,
      action: "CALL_START",
      resource_type: "call",
      resource_id: callId ? String(callId) : null,
      metadata: { direction: "outbound", to: destination, via: "ns-make-call" },
    });

    return jsonResponse({ success: true, call_id: callId, data });
  } catch (e) {
    console.error("ns-make-call error", e);
    return jsonResponse({ success: false, error: (e as Error).message ?? "unexpected", code: 500 }, 500);
  }
});
