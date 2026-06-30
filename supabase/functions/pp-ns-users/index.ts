// pp-ns-users — Lists all NetSapiens subscribers (brokers) for the Planiprêt domain.
// Admin-only. Uses per-broker JWT (the calling admin's NS-API token) which works
// reliably against this NetSapiens deployment, unlike the system oauth2/token path.
import { corsHeaders, jsonResponse, nsBrokerFetch, nsEnv, requirePlanipretAdmin } from "../_shared/ns-broker.ts";

const AVA_ORG_ID = "17d6507f-a9ca-409d-8e49-371d50332615";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requirePlanipretAdmin(req);
    if ("error" in auth) return auth.error;
    const { admin, profile } = auth;

    const domain = new URL(req.url).searchParams.get("domain") ?? nsEnv().domain ?? "planipret.ca";

    // Fetch all users from NS-API for this domain via the admin broker JWT
    let raw: any = null;
    let nsWarning: string | null = null;
    try {
      const res = await nsBrokerFetch(admin, profile, `/domains/${encodeURIComponent(domain)}/users?limit=2000`);
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
      .select("user_id, email, full_name, extension, ns_extension, mobile_app_enabled, voice_agent_enabled, ns_domain, elevenlabs_agent_id, dnd_enabled, updated_at, created_at")
      .eq("organization_id", AVA_ORG_ID);
    const byExt = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => {
      const k = p.extension ?? p.ns_extension;
      if (k) byExt.set(String(k), p);
    });

    const sourceList: any[] = list.length > 0
      ? list
      : (profiles ?? []).map((p: any) => ({
          user: p.extension ?? p.ns_extension,
          email: p.email,
          first_name: (p.full_name || "").split(" ")[0] ?? "",
          last_name: (p.full_name || "").split(" ").slice(1).join(" "),
        }));

    const brokers = sourceList.map((u: any) => {
      const ext = String(
        u.user ?? u.extension ?? u.subscriber_login ?? u.user_id ?? u.id ?? "",
      );
      const local = byExt.get(ext);
      const first = u.first_name ?? u.firstName ?? u["name-first-name"] ?? "";
      const last = u.last_name ?? u.lastName ?? u["name-last-name"] ?? "";
      const fullName = local?.full_name || `${first} ${last}`.trim() || u.display_name || u.name || ext;
      const email = local?.email ?? u.email ?? u.email_address ?? u["email-address"] ?? "";
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
    }).filter((b: any) => !/@lemtel\.com$/i.test(String(b.email || "").trim()) && b.extension);

    return jsonResponse({ ok: true, count: brokers.length, domain, brokers, ns_warning: nsWarning, degraded: !!nsWarning });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
