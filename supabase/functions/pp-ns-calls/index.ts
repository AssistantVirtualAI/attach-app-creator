// pp-ns-calls — Active call control via NS-API v2.
// AVA Planiprêt brokers only.
// GET    ?action=list                          → list active calls
// POST   ?action=start  body { to_number, caller_id_number?, caller_id_name? }
// PATCH  ?action=answer|hold|unhold|transfer|disconnect|reject  body { call_id, ... }

import {
  corsHeaders,
  jsonResponse,
  requirePlanipretBroker,
  nsFetch,
} from "../_shared/planipret-ns.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requirePlanipretBroker(req);
  if (guard instanceof Response) return guard;
  const { ctx } = guard;

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";
  const base = `/domains/${encodeURIComponent(ctx.nsDomain)}/users/${encodeURIComponent(ctx.extension)}/calls`;

  try {
    if (req.method === "GET" && action === "list") {
      const res = await nsFetch(base, { method: "GET" });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && action === "start") {
      const payload = await req.json().catch(() => ({}));
      if (!payload?.to_number || typeof payload.to_number !== "string") {
        return jsonResponse({ error: "to_number required" }, 400);
      }
      const res = await nsFetch(base, {
        method: "POST",
        body: JSON.stringify({
          destination: payload.to_number,
          caller_id_number: payload.caller_id_number,
          caller_id_name: payload.caller_id_name,
        }),
      });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      const payload = await req.json().catch(() => ({}));
      const callId = payload?.call_id;
      if (!callId) return jsonResponse({ error: "call_id required" }, 400);

      const allowed = ["answer", "hold", "unhold", "transfer", "disconnect", "reject"];
      if (!allowed.includes(action)) return jsonResponse({ error: "invalid action" }, 400);

      const path = `${base}/${encodeURIComponent(callId)}/${action}`;
      const body = action === "transfer" ? JSON.stringify({ destination: payload.destination }) : undefined;
      const res = await nsFetch(path, { method: "PATCH", body });
      const txt = await res.text();
      return new Response(txt || "{}", {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return jsonResponse({ error: "unsupported action/method" }, 400);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 502);
  }
});
