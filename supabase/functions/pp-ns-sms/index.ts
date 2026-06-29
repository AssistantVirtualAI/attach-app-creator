// pp-ns-sms — Proxy NS-API v2 SMS/Messages pour Planiprêt.
// AVA Planiprêt uniquement. Segmentation stricte par extension utilisateur.
//
// GET  ?action=threads              → Liste des sessions de messages (threads)
// GET  ?action=messages&thread_id=X → Messages d'un thread
// POST ?action=send  body { to, message, type? }  → Envoyer SMS/Chat
// GET  ?action=sms-numbers          → Numéros SMS assignés à l'utilisateur
//
// Sécurité : requirePlanipretBroker() vérifie :
//   1. JWT Supabase valide
//   2. Utilisateur membre de l'organisation Planiprêt (is_planipret_member)
//   3. Profil planipret_profiles avec extension et ns_domain
//   4. Bloque les utilisateurs Lemtel-only

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
  const action = url.searchParams.get("action") ?? "threads";

  // Base path NS-API pour cet utilisateur (segmentation par extension)
  const userBase = `/domains/${encodeURIComponent(ctx.nsDomain)}/users/${encodeURIComponent(ctx.extension)}`;

  try {
    // ── GET threads ─────────────────────────────────────────────────────────
    if (req.method === "GET" && action === "threads") {
      const limit = url.searchParams.get("limit") ?? "50";
      const res = await nsFetch(`${userBase}/messagesessions?limit=${limit}`, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API threads fetch failed", status: res.status, body: txt }, 502);
      }
      const raw = await res.json();
      const threads = Array.isArray(raw) ? raw : (raw?.messagesessions ?? raw?.data ?? []);
      return jsonResponse({ ok: true, count: threads.length, threads });
    }

    // ── GET messages d'un thread ─────────────────────────────────────────────
    if (req.method === "GET" && action === "messages") {
      const threadId = url.searchParams.get("thread_id");
      if (!threadId) return jsonResponse({ error: "thread_id requis" }, 400);
      const limit = url.searchParams.get("limit") ?? "100";
      const res = await nsFetch(
        `${userBase}/messagesessions/${encodeURIComponent(threadId)}/messages?limit=${limit}`,
        { method: "GET" }
      );
      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API messages fetch failed", status: res.status, body: txt }, 502);
      }
      const raw = await res.json();
      const messages = Array.isArray(raw) ? raw : (raw?.messages ?? raw?.data ?? []);
      return jsonResponse({ ok: true, count: messages.length, messages });
    }

    // ── GET numéros SMS ──────────────────────────────────────────────────────
    if (req.method === "GET" && action === "sms-numbers") {
      const res = await nsFetch(
        `/domains/${encodeURIComponent(ctx.nsDomain)}/users/${encodeURIComponent(ctx.extension)}/smsnumbers`,
        { method: "GET" }
      );
      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API SMS numbers fetch failed", status: res.status, body: txt }, 502);
      }
      const raw = await res.json();
      const numbers = Array.isArray(raw) ? raw : (raw?.smsnumbers ?? raw?.data ?? []);
      return jsonResponse({ ok: true, numbers });
    }

    // ── POST envoyer un message ──────────────────────────────────────────────
    if (req.method === "POST" && action === "send") {
      const payload = await req.json().catch(() => ({}));
      const { to, message, type = "sms", thread_id } = payload ?? {};

      if (!to || !message) {
        return jsonResponse({ error: "to et message sont requis" }, 400);
      }

      let nsPath: string;
      let nsBody: Record<string, unknown>;

      if (thread_id) {
        // Répondre dans un thread existant
        nsPath = `${userBase}/messagesessions/${encodeURIComponent(thread_id)}/messages`;
        nsBody = { message, type };
      } else {
        // Créer un nouveau thread
        nsPath = `${userBase}/messagesessions`;
        nsBody = {
          type,
          destination: to,
          message,
        };
      }

      const res = await nsFetch(nsPath, {
        method: "POST",
        body: JSON.stringify(nsBody),
      });

      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API send failed", status: res.status, body: txt }, 502);
      }

      const result = await res.json().catch(() => ({}));

      // Persister dans Supabase pour l'historique local
      await supabase
        .from("planipret_phone_messages")
        .insert({
          user_id: ctx.userId,
          direction: "outbound",
          to_number: to,
          from_number: ctx.extension,
          body: message,
          type,
          ns_thread_id: thread_id ?? result?.messagesession_id ?? null,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      return jsonResponse({ ok: true, result });
    }

    return jsonResponse({ error: `Action inconnue: ${action}` }, 400);

  } catch (e) {
    console.error("[pp-ns-sms] Erreur:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
