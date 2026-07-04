// ns-sync-user — fetches all users from NS-API domain and links extensions
// to matching planipret_profiles by email. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const NS_API_KEY = Deno.env.get("NS_API_KEY") ?? "";
  const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
  const NS_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "planipret.ca";

  try {
    // Auth: admin only
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: "not_authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    let isAdmin = false;
    try { const { data } = await admin.rpc("is_planipret_admin", { _user_id: caller.id }); if (data) isAdmin = true; } catch { /**/ }
    if (!isAdmin) {
      try { const { data } = await admin.rpc("is_super_admin", { _user_id: caller.id }); if (data) isAdmin = true; } catch { /**/ }
    }
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body: any = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "sync_from_ns");

    if (action !== "sync_from_ns") {
      return json({ error: "unsupported_action", detail: "Use pp-admin-user for create/update. This function only supports sync_from_ns." }, 400);
    }

    if (!NS_API_KEY) return json({ error: "ns_api_key_missing" }, 500);

    // Fetch all NS-API users (paginated)
    const nsHeaders = { Authorization: `Bearer ${NS_API_KEY}`, Accept: "application/json" };
    let allNs: any[] = [];
    let offset = 0;
    const limit = 100;
    for (let page = 0; page < 20; page++) {
      const r = await fetch(`${NS_API_BASE_URL}/domains/${encodeURIComponent(NS_DOMAIN)}/users?limit=${limit}&offset=${offset}`, { headers: nsHeaders });
      if (!r.ok) { console.error("ns list failed", r.status, await r.text().catch(() => "")); break; }
      const pageData = await r.json().catch(() => []);
      const arr = Array.isArray(pageData) ? pageData : (pageData?.users ?? []);
      if (!arr.length) break;
      allNs = allNs.concat(arr);
      if (arr.length < limit) break;
      offset += limit;
    }

    // Load existing profiles
    const { data: profiles } = await admin
      .from("planipret_profiles")
      .select("id, user_id, email, ns_extension");

    let matched = 0, updated = 0, unmatched = 0;
    const unmatchedList: Array<{ ext: string; email: string }> = [];

    for (const nsUser of allNs) {
      const ext = String(nsUser?.user ?? nsUser?.extension ?? "").trim();
      const email = String(nsUser?.["email-address"] ?? nsUser?.email ?? "").trim().toLowerCase();
      if (!ext) continue;

      const profile = (profiles ?? []).find((p) =>
        (p.email?.toLowerCase() === email && email) ||
        (p.ns_extension && String(p.ns_extension) === ext)
      );

      if (!profile) {
        unmatched++;
        unmatchedList.push({ ext, email });
        continue;
      }
      matched++;
      if (!profile.ns_extension) {
        const { error } = await admin.from("planipret_profiles").update({
          ns_extension: ext,
          ns_domain: NS_DOMAIN,
          ns_sip_username: ext,
          ns_linked: true,
          ns_linked_at: new Date().toISOString(),
          ns_link_method: "auto_email_match",
        }).eq("id", profile.id);
        if (!error) updated++;
      }
    }

    return json({
      success: true,
      total_ns_users: allNs.length,
      matched,
      updated,
      unmatched,
      unmatched_sample: unmatchedList.slice(0, 20),
    });
  } catch (e: any) {
    console.error("ns-sync-user error", e?.message, e?.stack);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
