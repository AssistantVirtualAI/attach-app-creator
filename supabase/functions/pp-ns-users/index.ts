// pp-ns-users — Lists all NetSapiens subscribers (brokers) for the Planiprêt domain.
// Admin-only. Used by /planipret/admin/users to show ALL brokers from the phone system,
// not just the local planipret_profiles rows.
import {
  corsHeaders,
  jsonResponse,
  nsFetch,
  getEnv,
  AVA_ORG_ID,
} from "../_shared/planipret-ns.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace(/^Bearer\s+/i, ""),
    );
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // Must be Planipret member (admins / super_admins included)
    const { data: isMember } = await admin.rpc("is_planipret_member", { _user_id: userId });
    if (isMember !== true) return jsonResponse({ error: "Forbidden" }, 403);

    const env = getEnv();
    const domain = new URL(req.url).searchParams.get("domain") ?? env.NS_DEFAULT_DOMAIN;
    if (!domain) return jsonResponse({ error: "NS domain not configured" }, 412);

    // Fetch all users from NS-API for this domain — degrade gracefully on auth/network failure
    let raw: any = null;
    let nsWarning: string | null = null;
    try {
      const res = await nsFetch(`/domains/${encodeURIComponent(domain)}/users?limit=2000`, {
        method: "GET",
      });
      if (!res.ok) {
        const txt = await res.text();
        nsWarning = `NS-API users fetch failed: ${res.status} ${txt.slice(0, 200)}`;
      } else {
        raw = await res.json();
      }
    } catch (e) {
      nsWarning = `NS-API unreachable: ${(e as Error).message}`;
    }
    const list: any[] = Array.isArray(raw) ? raw : (raw?.users ?? raw?.data ?? raw?.items ?? []);

    // Merge with local planipret_profiles for app/agent flags
    const { data: profiles } = await admin
      .from("planipret_profiles")
      .select("user_id, email, full_name, extension, mobile_app_enabled, voice_agent_enabled, ns_domain, elevenlabs_agent_id, dnd_enabled, updated_at, created_at")
      .eq("organization_id", AVA_ORG_ID);
    const byExt = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => { if (p.extension) byExt.set(String(p.extension), p); });

    const brokers = list.map((u: any) => {
      const ext = String(u.user ?? u.extension ?? u.subscriber_login ?? u.user_id ?? "");
      const local = byExt.get(ext);
      const first = u.first_name ?? u.firstName ?? "";
      const last = u.last_name ?? u.lastName ?? "";
      const fullName = local?.full_name || `${first} ${last}`.trim() || u.display_name || u.name || ext;
      const email = local?.email ?? u.email ?? u.email_address ?? "";
      return {
        user_id: local?.user_id ?? `ns:${domain}:${ext}`,
        ns_only: !local,
        extension: ext,
        full_name: fullName,
        email,
        ns_domain: domain,
        mobile_app_enabled: local?.mobile_app_enabled ?? false,
        voice_agent_enabled: local?.voice_agent_enabled ?? false,
        dnd_enabled: local?.dnd_enabled ?? !!u.do_not_disturb,
        elevenlabs_agent_id: local?.elevenlabs_agent_id ?? null,
        scope: u.scope ?? u.user_scope ?? null,
        status: u.status ?? u.presence ?? null,
        updated_at: local?.updated_at ?? u.last_modified ?? null,
        created_at: local?.created_at ?? u.creation_date ?? null,
      };
    }).filter((b: any) => !/@lemtel\.com$/i.test(String(b.email || "").trim()));

    return jsonResponse({ ok: true, count: brokers.length, domain, brokers });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
