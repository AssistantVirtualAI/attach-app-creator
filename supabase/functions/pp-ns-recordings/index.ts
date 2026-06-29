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
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
      const end = url.searchParams.get("end") ?? new Date().toISOString();
      const start = url.searchParams.get("start") ??
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Récupérer les CDRs avec enregistrements depuis Supabase (déjà synchronisés)
      const { data: recordings, error } = await supabase
        .from("planipret_phone_calls")
        .select("id, ns_call_id, direction, from_number, from_name, to_number, to_name, started_at, duration_seconds, recording_url, ai_summary")
        .eq("user_id", ctx.userId)
        .not("recording_url", "is", null)
        .gte("started_at", start)
        .lte("started_at", end)
        .order("started_at", { ascending: false })
        .limit(limit);

      if (error) {
        return jsonResponse({ error: "Erreur base de données", details: error.message }, 500);
      }

      return jsonResponse({
        ok: true,
        count: recordings?.length ?? 0,
        items: recordings ?? [],
      });
    }

    return jsonResponse({ error: `Action inconnue: ${action}` }, 400);

  } catch (e) {
    console.error("[pp-ns-recordings] Erreur:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
