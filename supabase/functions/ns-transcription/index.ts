import { authBroker, corsHeaders, jsonResponse, nsBrokerFetch, nsEnv } from "../_shared/ns-broker.ts";

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
      `/domains/${encodeURIComponent(env.domain)}/transcriptions?callId=${encodeURIComponent(callId)}`,
      { method: "GET" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return jsonResponse({ success: false, error: data?.message ?? "Transcription introuvable", code: res.status }, 200);

    const transcript: string =
      typeof data === "string" ? data :
      data.transcript ?? data.text ?? (Array.isArray(data) ? data.map((x: any) => x.text ?? "").join("\n") : "");

    if (transcript) {
      await admin.from("planipret_phone_calls").update({ transcript }).eq("call_id", callId);
    }
    return jsonResponse({ success: true, transcript });
  } catch (e) {
    console.error("ns-transcription error", e);
    return jsonResponse({ success: false, error: "Connexion perdue", code: 0 }, 200);
  }
});
