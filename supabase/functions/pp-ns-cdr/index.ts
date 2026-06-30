// pp-ns-cdr — Pull NS-API v2 CDR records and sync into planipret_phone_calls.
// AVA Planiprêt only.
// GET    ?start=ISO&end=ISO&limit=200          → fetch + return recent CDRs (cached)
// POST   ?action=sync   body { start?, end? }  → fetch & upsert into planipret_phone_calls

import {
  corsHeaders,
  jsonResponse,
  requirePlanipretBroker,
  nsFetch,
  AVA_ORG_ID,
} from "../_shared/planipret-ns.ts";

function pickDirection(raw: any): "inbound" | "outbound" | "missed" {
  const dir = (raw?.direction ?? raw?.call_direction ?? "").toString().toLowerCase();
  if (dir.includes("in")) {
    if (raw?.answered === false || raw?.disposition === "no-answer") return "missed";
    return "inbound";
  }
  return "outbound";
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requirePlanipretBroker(req);
  if (guard instanceof Response) {
    // If the only problem is a profile not yet linked to an NS extension,
    // return an empty list instead of an error so the UI doesn't blank out.
    if (guard.status === 412) {
      return new Response(
        JSON.stringify({ ok: true, count: 0, items: [], needs_link: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return guard;
  }
  const { ctx, supabase } = guard;

  const url = new URL(req.url);
  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }
  const action = body.action ?? url.searchParams.get("action") ?? "list";

  const end = body.end ?? url.searchParams.get("end") ?? new Date().toISOString();
  const start = body.start ?? url.searchParams.get("start") ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(Number(body.limit ?? url.searchParams.get("limit") ?? 200), 1000);

  const nsPath =
    `/domains/${encodeURIComponent(ctx.nsDomain)}/users/${encodeURIComponent(ctx.extension)}/cdrs` +
    `?start-time=${encodeURIComponent(start)}&end-time=${encodeURIComponent(end)}&limit=${limit}`;

  try {
    const res = await nsFetch(nsPath, { method: "GET" }, { functionName: "pp-ns-cdr" });
    if (!res.ok) {
      const txt = await res.text();
      return jsonResponse({ error: "NS-API CDR fetch failed", status: res.status, body: txt }, 502);
    }
    const raw = await res.json();
    const items: any[] = Array.isArray(raw) ? raw : raw?.cdrs ?? raw?.data ?? [];

    if (action === "list") {
      return jsonResponse({ ok: true, count: items.length, items });
    }

    if (action === "sync") {
      const { data: runRow } = await supabase
        .from("planipret_edge_function_runs")
        .insert({
          function_name: "pp-ns-cdr",
          status: "running",
          triggered_by: ctx.userId,
          summary: { extension: ctx.extension, domain: ctx.nsDomain, start, end, fetched: items.length },
        })
        .select("id")
        .maybeSingle();
      const runId = runRow?.id as string | undefined;

      const rows = items.map((it) => ({
        user_id: ctx.userId,
        organization_id: AVA_ORG_ID,
        ns_call_id: it.id ?? it.call_id ?? it.uuid ?? null,
        ns_domain: ctx.nsDomain,
        extension: ctx.extension,
        direction: pickDirection(it),
        status: it.disposition ?? it.status ?? null,
        from_number: it.from_number ?? it.caller_id_number ?? null,
        from_name: it.from_name ?? it.caller_id_name ?? null,
        to_number: it.to_number ?? it.destination ?? null,
        to_name: it.to_name ?? null,
        started_at: toIso(it.start_time ?? it.started_at),
        answered_at: toIso(it.answer_time ?? it.answered_at),
        ended_at: toIso(it.end_time ?? it.ended_at),
        duration_seconds: Number(it.duration ?? it.billsec ?? 0) || 0,
        recording_url: it.recording_url ?? null,
        metadata: it,
      }));

      const withId = rows.filter((r) => r.ns_call_id);
      const withoutId = rows.filter((r) => !r.ns_call_id);

      let upserted = 0;
      try {
        if (withId.length) {
          const { error, count } = await supabase
            .from("planipret_phone_calls")
            .upsert(withId, { onConflict: "ns_call_id", count: "exact", ignoreDuplicates: false });
          if (error) throw new Error(error.message);
          upserted = count ?? withId.length;
        }
        if (withoutId.length) {
          const { error } = await supabase.from("planipret_phone_calls").insert(withoutId);
          if (error) throw new Error(error.message);
        }
      } catch (e) {
        const msg = (e as Error).message;
        if (runId) await supabase.from("planipret_edge_function_runs").update({ status: "error", finished_at: new Date().toISOString(), error: msg }).eq("id", runId);
        return jsonResponse({ error: msg }, 500);
      }

      const summary = { extension: ctx.extension, domain: ctx.nsDomain, start, end, fetched: items.length, upserted, inserted_no_id: withoutId.length };
      if (runId) await supabase.from("planipret_edge_function_runs").update({ status: "success", finished_at: new Date().toISOString(), summary }).eq("id", runId);

      return jsonResponse({ ok: true, ...summary });
    }

    return jsonResponse({ error: "unsupported action/method" }, 400);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 502);
  }
});
