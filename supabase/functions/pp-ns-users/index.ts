// pp-ns-users — Lists all NetSapiens subscribers (brokers) for the Planiprêt domain.
// Admin-only. Uses NS_API_KEY (static API key) — same auth path as ns-live-test,
// which is the working method for this NetSapiens deployment.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AVA_ORG_ID = "17d6507f-a9ca-409d-8e49-371d50332615";
const NS_API_KEY = Deno.env.get("NS_API_KEY") ?? "";
const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "planipret.ca";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function nsFetch(path: string) {
  const res = await fetch(`${NS_API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${NS_API_KEY}`, Accept: "application/json" },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: res.ok, status: res.status, data, text };
}

async function fetchAllUsers(domain: string): Promise<{ ok: boolean; data: any[]; warning?: string }> {
  const seen = new Set<string>();
  const all: any[] = [];
  const pageSize = 200;
  let prevSize = -1;
  for (let i = 0; i < 25; i++) {
    const start = i * pageSize + 1;
    const r = await nsFetch(`/domains/${encodeURIComponent(domain)}/users?limit=${pageSize}&start=${start}`);
    if (!r.ok) {
      return { ok: all.length > 0, data: all, warning: `NS-API users fetch failed: ${r.status} ${r.text.slice(0, 200)}` };
    }
    const arr = Array.isArray(r.data) ? r.data : (r.data?.users ?? r.data?.data ?? []);
    if (!arr.length) break;
    let added = 0;
    for (const u of arr) {
      const ext = String(u.user ?? u.extension ?? u.subscriber_login ?? u.user_id ?? u.id ?? "").trim();
      if (!ext) continue;
      if (seen.has(ext)) continue;
      seen.add(ext);
      all.push(u);
      added++;
    }
    // NS-API v2 paginates with START/LIMIT. Stop if an install still repeats a page.
    if (added === 0) break;
    if (arr.length < pageSize) break;
    if (all.length === prevSize) break;
    prevSize = all.length;
  }
  return { ok: true, data: all };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isMember } = await admin.rpc("is_planipret_member", { _user_id: userData.user.id });
    if (isMember !== true) return json({ error: "Forbidden" }, 403);

    if (!NS_API_KEY) return json({ error: "NS_API_KEY missing in secrets" }, 500);

    const domain = new URL(req.url).searchParams.get("domain") ?? NS_DEFAULT_DOMAIN;
    const fetched = await fetchAllUsers(domain);
    const list = fetched.data;
    const nsWarning = fetched.warning ?? null;

    // Merge with local planipret_profiles for app/agent flags
    const { data: profiles } = await admin
      .from("planipret_profiles")
      .select("user_id, email, full_name, extension, ns_extension, mobile_app_enabled, voice_agent_enabled, ns_domain, elevenlabs_agent_id, dnd_enabled, updated_at, created_at")
      .eq("organization_id", AVA_ORG_ID);
    const byExt = new Map<string, any>();
    const byEmail = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => {
      const k = p.extension ?? p.ns_extension;
      if (k) byExt.set(String(k), p);
      if (p.email) byEmail.set(String(p.email).toLowerCase(), p);
    });

    const sourceList: any[] = list.length > 0
      ? list
      : (profiles ?? []).map((p: any) => ({
          user: p.extension ?? p.ns_extension,
          email: p.email,
          "name-first-name": (p.full_name || "").split(" ")[0] ?? "",
          "name-last-name": (p.full_name || "").split(" ").slice(1).join(" "),
        }));

    const brokers = sourceList.map((u: any) => {
      const ext = String(u.user ?? u.extension ?? u.subscriber_login ?? u.user_id ?? u.id ?? "");
      const email = String(u.email ?? u.email_address ?? u["email-address"] ?? "").toLowerCase();
      const local = byExt.get(ext) ?? (email ? byEmail.get(email) : undefined);
      const first = u["name-first-name"] ?? u.first_name ?? u.firstName ?? "";
      const last = u["name-last-name"] ?? u.last_name ?? u.lastName ?? "";
      const fullName = local?.full_name || `${first} ${last}`.trim() || u.display_name || u.name || ext;
      return {
        user_id: local?.user_id ?? `ns:${domain}:${ext}`,
        ns_only: !local,
        extension: ext,
        full_name: fullName,
        email: local?.email ?? email ?? "",
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
    }).filter((b: any) => b.extension && !/@lemtel\.com$/i.test(String(b.email || "").trim()));

    return json({ ok: true, count: brokers.length, domain, brokers, ns_warning: nsWarning, degraded: !!nsWarning, strategy: "start_limit_dedupe_by_extension" });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
