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
  let action = url.searchParams.get("action") ?? "list";
  // Also accept action from JSON body (supabase.functions.invoke can't pass ?query)
  let cachedBody: any = null;
  if (req.method !== "GET") {
    try { cachedBody = await req.clone().json(); } catch { cachedBody = null; }
    if (cachedBody?.action) action = cachedBody.action;
  }
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
      const raw = payload?.to_number;
      if (!raw || typeof raw !== "string") {
        return jsonResponse({ error: "to_number required" }, 400);
      }
      // Normalize to E.164 (NA default: +1XXXXXXXXXX)
      let dest = raw.replace(/[^\d+]/g, "");
      if (!dest.startsWith("+")) {
        const digits = dest.replace(/\D/g, "");
        dest = "+" + (digits.length === 10 ? "1" + digits : digits);
      }
      const clientCallId = crypto.randomUUID();
      // Official NetSapiens Click-to-Call payload. The agent's device rings
      // first; once they answer NetSapiens dials the client and bridges both.
      const nsBody = {
        "synchronous": "yes",
        "call-id": clientCallId,
        "callid": clientCallId,
        "call-orig-user": `${ctx.extension}@${ctx.nsDomain}`,
        "call-term-user": dest,
        "destination": dest,
        "auto-answer-enabled": "no",
        "caller-id-number": payload.caller_id_number ?? ctx.extension,
        "caller-id-name": payload.caller_id_name ?? "Courtier Planiprêt",
      };
      const res = await nsFetch(base, { method: "POST", body: JSON.stringify(nsBody) });
      const body = await res.text();
      let parsed: any = null;
      try { parsed = body ? JSON.parse(body) : null; } catch { /* keep raw */ }

      if (res.ok) {
        const nsCallId = parsed?.["call-id"] ?? parsed?.call_id ?? parsed?.id ?? clientCallId;
        try {
          await guard.supabase.from("planipret_phone_calls").insert({
            user_id: ctx.userId,
            ns_call_id: nsCallId,
            ns_callid: nsCallId,
            ns_domain: ctx.nsDomain,
            extension: ctx.extension,
            direction: "outbound",
            from_number: String(payload.caller_id_number ?? ctx.extension),
            to_number: dest,
            status: "outbound_ringing",
            started_at: new Date().toISOString(),
            metadata: { click_to_call: true, client_call_id: clientCallId, ns_response: parsed ?? body },
          });
        } catch (_e) { /* non-fatal */ }
      }

      return new Response(body || JSON.stringify({ ok: res.ok, call_id: clientCallId }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call-control actions: accept either PATCH or POST-with-action-in-body
    // (supabase.functions.invoke only issues POST).
    const controlActions = ["answer", "hold", "unhold", "transfer", "disconnect", "reject"];
    if (controlActions.includes(action)) {
      const payload = cachedBody ?? (await req.json().catch(() => ({})));
      const callId = payload?.call_id;
      if (!callId) return jsonResponse({ error: "call_id required" }, 400);
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
