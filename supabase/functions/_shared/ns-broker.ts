// Per-broker NS-API JWT helpers — AVA Planiprêt only.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export { corsHeaders };
export const AVA_ORG_ID = "17d6507f-a9ca-409d-8e49-371d50332615";

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function nsEnv() {
  const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL");
  const NS_API_USER = Deno.env.get("NS_API_USER");
  const NS_API_PASSWORD = Deno.env.get("NS_API_PASSWORD");
  const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? Deno.env.get("NS_API_DOMAIN") ?? "";
  if (!NS_API_BASE_URL || !NS_API_USER || !NS_API_PASSWORD) {
    throw new Error("NS-API secrets not configured");
  }
  // Tolerate base URL with or without trailing /ns-api/v2 or /ns-api
  const base = NS_API_BASE_URL.replace(/\/$/, "").replace(/\/ns-api(\/v2)?$/, "");
  return {
    base,
    user: NS_API_USER,
    password: NS_API_PASSWORD,
    domain: NS_DEFAULT_DOMAIN,
  };
}

export function supaAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function authBroker(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ success: false, error: "Unauthorized", code: 401 }, 401) };
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (!claims?.claims?.sub) {
    return { error: jsonResponse({ success: false, error: "Unauthorized", code: 401 }, 401) };
  }
  const admin = supaAdmin();
  const userId = claims.claims.sub as string;
  const { data: isMember } = await admin.rpc("is_planipret_member", { _user_id: userId });
  if (isMember !== true) {
    return { error: jsonResponse({ success: false, error: "Accès non autorisé", code: 403 }, 403) };
  }
  const { data: profile } = await admin
    .from("planipret_profiles")
    .select("id, extension, role, ns_jwt, ns_refresh_token, ns_jwt_expires_at, organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile || profile.organization_id !== AVA_ORG_ID) {
    return { error: jsonResponse({ success: false, error: "Profil introuvable", code: 404 }, 404) };
  }
  return { admin, userId, profile };
}

export async function requirePlanipretAdmin(req: Request) {
  const res = await authBroker(req);
  if ("error" in res) return res;
  if ((res as any).profile.role !== "admin") {
    return { error: jsonResponse({ success: false, error: "Accès refusé", code: 403 }, 403) };
  }
  return res;
}

export async function obtainBrokerJwt(extension: string) {
  const env = nsEnv();
  const clientId = Deno.env.get("NS_API_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("NS_API_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) {
    throw new Error(
      "NS-API client credentials missing: set NS_API_CLIENT_ID and NS_API_CLIENT_SECRET (NetSapiens OAuth2 app — error OA101 = invalid client).",
    );
  }
  const username = env.domain ? `${extension}@${env.domain}` : extension;

  const oauthForm = new URLSearchParams({
    grant_type: "password",
    username,
    password: env.password,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const attempts: Array<{ label: string; url: string; init: RequestInit }> = [
    {
      label: "oauth2/token",
      url: `${env.base}/ns-api/oauth2/token`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: oauthForm,
      },
    },
    {
      // some NS installs expose oauth2 at root (no /ns-api prefix)
      label: "oauth2/token(root)",
      url: `${env.base}/oauth2/token`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: oauthForm,
      },
    },
    {
      label: "v2/jwt",
      url: `${env.base}/ns-api/v2/jwt`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          username,
          password: env.password,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    },
  ];

  const errors: string[] = [];
  for (const a of attempts) {
    const res = await fetch(a.url, a.init);
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* keep text */ }
    if (res.ok) {
      const token = data.access_token ?? data.token ?? data.jwt;
      if (!token) { errors.push(`${a.label}: no token`); continue; }
      return {
        token,
        refresh: data.refresh_token ?? data.refresh ?? null,
        expiresIn: Number(data.expires_in ?? 3600),
      };
    }
    errors.push(`${a.label}: ${res.status} ${text.slice(0, 200)}`);
  }
  throw new Error(`NS-API auth failed: ${errors.join(" | ")}`);
}

export async function refreshBrokerJwt(refreshToken: string) {
  const env = nsEnv();
  const clientId = Deno.env.get("NS_API_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("NS_API_CLIENT_SECRET") ?? "";
  const res = await fetch(`${env.base}/ns-api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      ...(clientId ? { client_id: clientId } : {}),
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? `NS-API refresh failed (${res.status})`);
  return {
    token: data.access_token ?? data.token ?? data.jwt,
    refresh: data.refresh_token ?? refreshToken,
    expiresIn: Number(data.expires_in ?? 3600),
  };
}

export async function ensureBrokerJwt(
  admin: ReturnType<typeof supaAdmin>,
  profile: { id: string; extension: string; ns_jwt: string | null; ns_refresh_token: string | null; ns_jwt_expires_at: string | null },
): Promise<string> {
  const expSoon = !profile.ns_jwt_expires_at ||
    new Date(profile.ns_jwt_expires_at).getTime() - Date.now() < 60_000;
  if (profile.ns_jwt && !expSoon) return profile.ns_jwt;

  let result;
  try {
    result = profile.ns_refresh_token
      ? await refreshBrokerJwt(profile.ns_refresh_token)
      : await obtainBrokerJwt(profile.extension);
  } catch {
    result = await obtainBrokerJwt(profile.extension);
  }
  await admin.from("planipret_profiles").update({
    ns_jwt: result.token,
    ns_refresh_token: result.refresh,
    ns_jwt_expires_at: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
  }).eq("id", profile.id);
  return result.token;
}

export async function nsBrokerFetch(
  admin: ReturnType<typeof supaAdmin>,
  profile: any,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const env = nsEnv();
  const url = path.startsWith("http") ? path : `${env.base}/ns-api/v2${path.startsWith("/") ? path : `/${path}`}`;
  let token = await ensureBrokerJwt(admin, profile);
  const doFetch = (t: string) =>
    fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
        ...(init.headers ?? {}),
      },
    });
  let res = await doFetch(token);
  if (res.status === 401) {
    profile.ns_jwt = null;
    profile.ns_jwt_expires_at = null;
    token = await ensureBrokerJwt(admin, profile);
    res = await doFetch(token);
  }
  return res;
}

export function nsPath(domain: string, extension: string, sub = "") {
  return `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}${sub}`;
}

/** Insert one row in planipret_audit_log. Never throws. */
export async function logAudit(
  admin: ReturnType<typeof supaAdmin>,
  req: Request,
  entry: {
    user_id?: string | null;
    admin_id?: string | null;
    action: string;
    resource_type?: string | null;
    resource_id?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("cf-connecting-ip") ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    await admin.from("planipret_audit_log").insert({
      user_id: entry.user_id ?? null,
      admin_id: entry.admin_id ?? null,
      action: entry.action,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      ip_address: ip,
      user_agent: ua,
      metadata: entry.metadata ?? {},
    });
  } catch (_e) { /* swallow */ }
}
