// pp-ns-recordings — Proxy NS-API v2 Enregistrements d'appels pour Planiprêt.
// AVA Planiprêt uniquement. Segmentation stricte par extension utilisateur.
//
// GET  ?call_id=X          → Enregistrement d'un appel spécifique
// GET  ?action=list        → Liste des enregistrements récents (via CDR)
//
// Sécurité : requirePlanipretBroker() garantit que l'utilisateur ne peut
// accéder qu'aux enregistrements de sa propre extension.

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

  const { ctx, supabase } = guard;
  const url = new URL(req.url);
  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }
  const callId = body.call_id ?? url.searchParams.get("call_id");
  const action = body.action ?? url.searchParams.get("action") ?? (callId ? "get" : "list");

  try {
    // ── GET enregistrement d'un appel spécifique ─────────────────────────────
    if (action === "get" && callId) {
      // NS-API v2: GET /domains/{domain}/users/{user}/recordings/{call_id}
      const res = await nsFetch(
        `/domains/${encodeURIComponent(ctx.nsDomain)}/users/${encodeURIComponent(ctx.extension)}/recordings/${encodeURIComponent(callId)}`,
        { method: "GET" }
      );

      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API recording fetch failed", status: res.status, body: txt }, 502);
      }

      const contentType = res.headers.get("content-type") ?? "";

      // Si la réponse est JSON, retourner l'URL de l'enregistrement
      if (contentType.includes("application/json")) {
        const data = await res.json();
        return jsonResponse({
          ok: true,
          call_id: callId,
          recording_url: data.url ?? data.recording_url ?? null,
          duration: data.duration ?? null,
        });
      }

      // Proxy du contenu audio directement
      const audioBuffer = await res.arrayBuffer();
      return new Response(audioBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType || "audio/wav",
          "Content-Length": audioBuffer.byteLength.toString(),
          "Content-Disposition": `inline; filename="recording-${callId}.wav"`,
        },
      });
    }

    // ── GET liste des enregistrements récents ────────────────────────────────
    if (action === "list") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? body.limit ?? 50), 200);
      const end = url.searchParams.get("end") ?? body.end ?? new Date().toISOString();
      const start = url.searchParams.get("start") ?? body.start ??
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // 1) Fetch live from NS-API recordings endpoint (per-user extension)
      let nsItems: any[] = [];
      try {
        const nsRes = await nsFetch(
          `/domains/${encodeURIComponent(ctx.nsDomain)}/users/${encodeURIComponent(ctx.extension)}/recordings` +
          `?start-time=${encodeURIComponent(start)}&end-time=${encodeURIComponent(end)}&limit=${limit}`,
          { method: "GET" },
          { functionName: "pp-ns-recordings" },
        );
        if (nsRes.ok) {
          const raw = await nsRes.json();
          nsItems = Array.isArray(raw) ? raw : raw?.recordings ?? raw?.data ?? [];
        } else {
          console.warn("[pp-ns-recordings] NS list failed", nsRes.status);
        }
      } catch (e) {
        console.warn("[pp-ns-recordings] NS list error", (e as Error).message);
      }

      // 2) Merge with enriched local CDR rows (transcript, AI, etc.)
      const { data: local } = await supabase
        .from("planipret_phone_calls")
        .select("id, ns_call_id, direction, from_number, from_name, to_number, to_name, started_at, duration_seconds, recording_url, ai_summary, transcript")
        .eq("user_id", ctx.userId)
        .gte("started_at", start)
        .lte("started_at", end)
        .order("started_at", { ascending: false })
        .limit(limit);
      const byNsId = new Map<string, any>();
      (local ?? []).forEach((r: any) => { if (r.ns_call_id) byNsId.set(r.ns_call_id, r); });

      const items = nsItems.map((it: any, i: number) => {
        const nsId = it.id ?? it.call_id ?? it.uuid ?? it["cdr-id"] ?? null;
        const enriched = nsId ? byNsId.get(nsId) : null;
        const dirRaw = String(it.direction ?? it.call_direction ?? "").toLowerCase();
        const direction = dirRaw.includes("in") ? "inbound" : "outbound";
        return {
          id: enriched?.id ?? nsId ?? `rec-${i}`,
          ns_call_id: nsId,
          direction,
          from_number: it.from_number ?? it.caller_id_number ?? it.orig_from_user
            ?? it.by_number ?? enriched?.from_number ?? null,
          from_name: it.from_name ?? it.caller_id_name ?? enriched?.from_name ?? null,
          to_number: it.to_number ?? it.destination ?? it.term_to_user ?? enriched?.to_number ?? null,
          to_name: it.to_name ?? enriched?.to_name ?? null,
          started_at: it.start_time ?? it.started_at ?? it.time_start ?? enriched?.started_at ?? null,
          duration_seconds: Number(it.duration ?? it.billsec ?? it.time_talking ?? 0) || enriched?.duration_seconds || 0,
          recording_url: it.url ?? it.recording_url ?? it.recording ?? it.record_url
            ?? (nsId ? `/functions/v1/pp-ns-recordings?call_id=${encodeURIComponent(nsId)}` : null)
            ?? enriched?.recording_url ?? null,
          ai_summary: enriched?.ai_summary ?? null,
          transcript: enriched?.transcript ?? null,
        };
      });

      // Fallback: local-only if NS returned nothing
      const finalItems = items.length ? items
        : (local ?? []).filter((r: any) => r.recording_url);

      return jsonResponse({ ok: true, count: finalItems.length, items: finalItems });
    }

    return jsonResponse({ error: `Action inconnue: ${action}` }, 400);

  } catch (e) {
    console.error("[pp-ns-recordings] Erreur:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
