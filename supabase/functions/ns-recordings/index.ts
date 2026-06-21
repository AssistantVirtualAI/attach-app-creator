import { authBroker, corsHeaders, jsonResponse, logAudit, nsBrokerFetch, nsEnv, nsPath } from "../_shared/ns-broker.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await authBroker(req);
    if ("error" in auth) return auth.error;
    const { admin, profile } = auth;
    const env = nsEnv();

    const callId = new URL(req.url).searchParams.get("call_id");
    if (!callId) return jsonResponse({ success: false, error: "call_id requis", code: 400 }, 400);

    const res = await nsBrokerFetch(
      admin,
      profile,
      nsPath(env.domain, profile.extension, `/recordings/${encodeURIComponent(callId)}`),
      { method: "GET", headers: { Accept: "audio/wav" } },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return jsonResponse({ success: false, error: txt || "Enregistrement introuvable", code: res.status }, 200);
    }
    const blob = await res.arrayBuffer();
    await logAudit(admin, req, {
      user_id: profile.id, action: "RECORDING_ACCESS",
      resource_type: "recording", resource_id: callId,
    });
    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/wav",
        "Content-Length": String(blob.byteLength),
      },
    });
  } catch (e) {
    console.error("ns-recordings error", e);
    return jsonResponse({ success: false, error: "Connexion perdue", code: 0 }, 200);
  }
});
