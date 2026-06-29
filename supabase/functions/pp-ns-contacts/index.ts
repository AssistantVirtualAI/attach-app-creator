// pp-ns-contacts — Proxy NS-API v2 Contacts pour Planiprêt.
// AVA Planiprêt uniquement. Segmentation par extension utilisateur.
//
// GET  ?action=list               → Contacts personnels de l'utilisateur
// GET  ?action=shared             → Contacts partagés du domaine
// GET  ?action=directory          → Annuaire interne (extensions du domaine)
// POST ?action=create  body {...} → Créer un contact personnel
// PUT  ?action=update  body {...} → Mettre à jour un contact
// DELETE ?contact_id=X            → Supprimer un contact
//
// Sécurité : requirePlanipretBroker() + segmentation par extension

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

  const userBase = `/domains/${encodeURIComponent(ctx.nsDomain)}/users/${encodeURIComponent(ctx.extension)}`;
  const domainBase = `/domains/${encodeURIComponent(ctx.nsDomain)}`;

  try {
    // ── GET contacts personnels ──────────────────────────────────────────────
    if (req.method === "GET" && action === "list") {
      const limit = url.searchParams.get("limit") ?? "500";
      const res = await nsFetch(`${userBase}/contacts?limit=${limit}`, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API contacts fetch failed", status: res.status, body: txt }, 502);
      }
      const raw = await res.json();
      const contacts = Array.isArray(raw) ? raw : (raw?.contacts ?? raw?.data ?? []);
      return jsonResponse({ ok: true, count: contacts.length, contacts });
    }

    // ── GET contacts partagés du domaine ─────────────────────────────────────
    if (req.method === "GET" && action === "shared") {
      const limit = url.searchParams.get("limit") ?? "500";
      const res = await nsFetch(`${domainBase}/contacts?limit=${limit}`, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API shared contacts fetch failed", status: res.status, body: txt }, 502);
      }
      const raw = await res.json();
      const contacts = Array.isArray(raw) ? raw : (raw?.contacts ?? raw?.data ?? []);
      return jsonResponse({ ok: true, count: contacts.length, contacts });
    }

    // ── GET annuaire interne (extensions) ────────────────────────────────────
    if (req.method === "GET" && action === "directory") {
      const res = await nsFetch(`${domainBase}/users?limit=500`, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API directory fetch failed", status: res.status, body: txt }, 502);
      }
      const raw = await res.json();
      const users = Array.isArray(raw) ? raw : (raw?.users ?? raw?.data ?? []);
      // Normaliser pour l'annuaire
      const directory = users.map((u: any) => ({
        extension: u.user ?? u.extension ?? u.uid,
        name: u.name ?? u.display_name ?? u.full_name ?? u.user,
        email: u.email ?? null,
        department: u.department ?? null,
        presence: u.presence ?? u.status ?? "unknown",
      }));
      return jsonResponse({ ok: true, count: directory.length, directory });
    }

    // ── POST créer un contact ────────────────────────────────────────────────
    if (req.method === "POST" && action === "create") {
      const payload = await req.json().catch(() => ({}));
      const { first_name, last_name, phone, email, company } = payload ?? {};
      if (!first_name && !last_name) {
        return jsonResponse({ error: "first_name ou last_name requis" }, 400);
      }

      const res = await nsFetch(`${userBase}/contacts`, {
        method: "POST",
        body: JSON.stringify({ first_name, last_name, phone, email, company }),
      });

      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API create contact failed", status: res.status, body: txt }, 502);
      }

      const result = await res.json().catch(() => ({}));
      return jsonResponse({ ok: true, contact: result });
    }

    // ── PUT mettre à jour un contact ─────────────────────────────────────────
    if (req.method === "PUT" && action === "update") {
      const payload = await req.json().catch(() => ({}));
      const { contact_id, ...fields } = payload ?? {};
      if (!contact_id) return jsonResponse({ error: "contact_id requis" }, 400);

      const res = await nsFetch(`${userBase}/contacts/${encodeURIComponent(contact_id)}`, {
        method: "PUT",
        body: JSON.stringify(fields),
      });

      if (!res.ok) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API update contact failed", status: res.status, body: txt }, 502);
      }

      const result = await res.json().catch(() => ({}));
      return jsonResponse({ ok: true, contact: result });
    }

    // ── DELETE supprimer un contact ──────────────────────────────────────────
    if (req.method === "DELETE") {
      const contactId = url.searchParams.get("contact_id");
      if (!contactId) return jsonResponse({ error: "contact_id requis" }, 400);

      const res = await nsFetch(`${userBase}/contacts/${encodeURIComponent(contactId)}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 404) {
        const txt = await res.text();
        return jsonResponse({ error: "NS-API delete contact failed", status: res.status, body: txt }, 502);
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: `Action inconnue: ${action}` }, 400);

  } catch (e) {
    console.error("[pp-ns-contacts] Erreur:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
