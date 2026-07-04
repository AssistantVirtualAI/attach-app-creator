import { authBroker, corsHeaders, jsonResponse, logAudit, nsBrokerFetch, nsEnv, nsPath } from "../_shared/ns-broker.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  console.log("=== ns-recordings called ===", req.method, req.url);
  try {
    const auth = await authBroker(req);
    if ("error" in auth) {
      console.log("authBroker failed");
      return auth.error;
    }
    const { admin, profile } = auth;
    const env = nsEnv();
    console.log("auth ok — extension:", profile.extension, "domain:", env.domain);

    const url = new URL(req.url);
    let callId = url.searchParams.get("call_id");
    if (!callId && req.method === "POST") {
      try {
        const body = await req.json();
        callId = body?.call_id ?? body?.cdr_id ?? null;
      } catch { /* ignore */ }
    }
    if (!callId) return jsonResponse({ success: false, error: "call_id requis", code: 400 }, 200);

    const path = nsPath(env.domain, profile.extension, `/recordings/${encodeURIComponent(callId)}`);
    console.log("NS-API GET", path);
    const res = await nsBrokerFetch(admin, profile, path, { method: "GET", headers: { Accept: "audio/wav" } });
    console.log("NS-API status:", res.status, "content-type:", res.headers.get("content-type"));

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const hint = res.status === 401
        ? "NS-API token invalide/expiré pour cet enregistrement"
        : res.status === 403
        ? "Le token NS-API n'a pas la permission d'accéder aux enregistrements pour l'extension " + profile.extension
        : res.status === 404
        ? "Aucun enregistrement pour cet appel (call_id introuvable côté NS-API — l'appel n'a peut-être pas été enregistré)"
        : `NS-API a retourné ${res.status}`;
      console.log("NS-API error body:", txt.slice(0, 500));
      return jsonResponse({
        success: false,
        error: hint,
        ns_status: res.status,
        ns_response: txt.slice(0, 500),
        call_id: callId,
        extension: profile.extension,
        attempts: [{ path, status: res.status }],
      }, 200);
    }

    const blob = await res.arrayBuffer();
    console.log("audio bytes:", blob.byteLength);
    if (blob.byteLength < 128) {
      return jsonResponse({
        success: false,
        error: "Fichier audio vide reçu de NS-API",
        ns_status: res.status,
        call_id: callId,
      }, 200);
    }
    await logAudit(admin, req, {
      user_id: profile.id, action: "RECORDING_ACCESS",
      resource_type: "recording", resource_id: callId,
    });
    const ct = res.headers.get("content-type") ?? "audio/wav";
    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": ct.startsWith("audio/") ? ct : "audio/wav",
        "Content-Length": String(blob.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("ns-recordings unexpected error:", e);
    return jsonResponse({
      success: false,
      error: (e as Error)?.message ?? "Erreur inconnue",
      type: (e as Error)?.constructor?.name,
    }, 200);
  }
});
