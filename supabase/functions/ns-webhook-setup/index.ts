import { corsHeaders, jsonResponse, nsBrokerFetch, requirePlanipretAdmin } from "../_shared/ns-broker.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requirePlanipretAdmin(req);
    if ("error" in auth) return auth.error;
    const { admin, profile } = auth;

    const target = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ns-webhook-receiver`;
    const events = ["cdr", "message", "voicemail"];
    const subs: any[] = [];

    for (const event of events) {
      const res = await nsBrokerFetch(admin, profile, "/subscriptions", {
        method: "POST",
        body: JSON.stringify({ event, target_url: target }),
      });
      const data = await res.json().catch(() => ({}));
      subs.push({ event, ok: res.ok, status: res.status, data });
    }
    return jsonResponse({ success: true, subscriptions: subs });
  } catch (e) {
    console.error("ns-webhook-setup error", e);
    return jsonResponse({ success: false, error: "Connexion perdue", code: 0 }, 200);
  }
});
