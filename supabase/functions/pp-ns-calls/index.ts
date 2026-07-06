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
    if (action === "list") {
      const res = await nsFetch(base, { method: "GET" });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "start") {
      const payload = cachedBody ?? (await req.json().catch(() => ({})));
      const raw = payload?.to_number ?? payload?.destination;
      if (!raw || typeof raw !== "string") {
        return jsonResponse({ success: false, error: "destination required" }, 200);
      }
      let dest = raw.replace(/[^\d+]/g, "");
      if (!dest.startsWith("+")) {
        const digits = dest.replace(/\D/g, "");
        dest = "+" + (digits.length === 10 ? "1" + digits : digits);
      }

      const clientType = String(payload.client_type ?? "mobile").toLowerCase();
      const deviceName = clientType === "widget"
        ? `${ctx.extension}x`
        : clientType === "web"
        ? `${ctx.extension}_web`
        : `${ctx.extension}_mobile`;

      // Fetch device to build the exact call-orig-user SIP URI.
      let callOrigUser = payload.call_orig_user ?? `${deviceName}@${ctx.nsDomain}`;
      try {
        const devRes = await nsFetch(`/domains/${encodeURIComponent(ctx.nsDomain)}/users/${encodeURIComponent(ctx.extension)}/devices/${encodeURIComponent(deviceName)}`, { method: "GET" });
        if (devRes.ok) {
          const dd = await devRes.json().catch(() => null);
          const device = Array.isArray(dd) ? dd[0] : dd;
          const uri = device?.["device-sip-registration-uri"];
          if (typeof uri === "string" && uri.length) {
            callOrigUser = uri.replace(/^sip:/i, "");
          }
        }
      } catch { /* fallback to constructed */ }

      const clientCallId = crypto.randomUUID();
      const nsBody = {
        "synchronous": "yes",
        "call-id": clientCallId,
        "call-orig-user": callOrigUser,
        "call-term-user": dest,
        "auto-answer-enabled": "no",
      };

      console.log(`[pp-ns-calls] start orig=${callOrigUser} term=${dest} ext=${ctx.extension}`);

      const res = await nsFetch(base, { method: "POST", body: JSON.stringify(nsBody) });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

      console.log(`[pp-ns-calls] NS status=${res.status} body=${typeof parsed === "string" ? parsed.slice(0,200) : JSON.stringify(parsed).slice(0,200)}`);

      const ok = res.ok || res.status === 202;
      if (ok) {
        const nsCallId = parsed?.["call-id"] ?? parsed?.call_id ?? parsed?.id ?? clientCallId;
        try {
          await guard.supabase.from("planipret_phone_calls").insert({
            user_id: ctx.userId,
            ns_call_id: nsCallId,
            ns_callid: nsCallId,
            ns_domain: ctx.nsDomain,
            extension: ctx.extension,
            direction: "outbound",
            from_number: String(ctx.extension),
            to_number: dest,
            status: "outbound_ringing",
            started_at: new Date().toISOString(),
            metadata: { click_to_call: true, client_call_id: clientCallId, call_orig_user: callOrigUser },
          });
        } catch { /* non-fatal */ }

        return jsonResponse({
          success: true,
          call_id: nsCallId,
          call_orig_user: callOrigUser,
          destination: dest,
          status: "initiated",
          message: "Votre téléphone va sonner — décrochez pour parler au client",
        }, 200);
      }

      return jsonResponse({
        success: false,
        error: (typeof parsed === "object" && parsed?.message) || `NS-API error ${res.status}`,
        ns_status: res.status,
        debug: { call_orig_user: callOrigUser, call_term_user: dest, extension: ctx.extension, domain: ctx.nsDomain, ns_body: parsed },
      }, 200);
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
