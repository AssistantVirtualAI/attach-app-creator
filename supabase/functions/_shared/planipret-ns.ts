// Shared helpers for Planiprêt NS-API v2 edge functions.
// IMPORTANT: AVA-only. Never used by Lemtel PBX functions.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export const AVA_ORG_ID = "17d6507f-a9ca-409d-8e49-371d50332615";

export { corsHeaders };

export type NsContext = {
  userId: string;
  profileId: string;
  extension: string;
  nsDomain: string;
};

let cachedToken: { token: string; exp: number } | null = null;

export function getEnv() {
  const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL");
  const NS_API_USER = Deno.env.get("NS_API_USER");
  const NS_API_PASSWORD = Deno.env.get("NS_API_PASSWORD");
  const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "";
  if (!NS_API_BASE_URL || !NS_API_USER || !NS_API_PASSWORD) {
    throw new Error("NS-API secrets not configured");
  }
  return { NS_API_BASE_URL, NS_API_USER, NS_API_PASSWORD, NS_DEFAULT_DOMAIN };
}

function nsBase() {
  // Tolerate either form: with or without trailing /ns-api/v2
  const raw = getEnv().NS_API_BASE_URL.replace(/\/$/, "");
  return raw.replace(/\/ns-api\/v2$/, "");
}

export async function getNsJwt(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const staticKey = Deno.env.get("NS_API_KEY") ?? "";
  if (!staticKey) throw new Error("NS_API_KEY not configured (NS-API v2 uses static Bearer key)");
  cachedToken = { token: staticKey, exp: Date.now() + 3600_000 };
  return staticKey;
}

export async function nsFetch(path: string, init: RequestInit = {}, opts: { functionName?: string } = {}) {
  let token: string;
  try {
    token = await getNsJwt();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message, degraded: true }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
  const url = `${nsBase()}/ns-api/v2${path}`;
  const method = (init.method ?? "GET").toUpperCase();
  const t0 = Date.now();
  console.log(`[${opts.functionName ?? "nsFetch"}][NS] ${method} ${path}`);
  let res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    cachedToken = null;
    try {
      const fresh = await getNsJwt();
      res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${fresh}`,
          ...(init.headers ?? {}),
        },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: (e as Error).message, degraded: true }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
  }
  // Fire & forget log to planipret_ns_request_log
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const [pathOnly, qs] = path.split("?");
    const query_params: Record<string, string> = {};
    if (qs) for (const [k, v] of new URLSearchParams(qs)) query_params[k] = v;
    admin.from("planipret_ns_request_log").insert({
      function_name: opts.functionName ?? "shared",
      method,
      path: pathOnly,
      query_params: qs ? query_params : null,
      full_url: url,
      status: res.status,
      duration_ms: Date.now() - t0,
      ok: res.ok,
      error: res.ok ? null : `HTTP ${res.status}`,
    }).then(() => {}, () => {});
  } catch { /* ignore */ }
  return res;
}

/**
 * Authenticates the caller via Supabase JWT, ensures the user is a Planiprêt
 * member of the AVA organization, and returns their NS-API extension/domain.
 */
export async function requirePlanipretBroker(
  req: Request,
): Promise<{ ctx: NsContext; supabase: ReturnType<typeof createClient>; userClient: ReturnType<typeof createClient> } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  // App-separation guard: block Lemtel-only users outright
  const { data: lemtelOnly } = await supabase.rpc("is_lemtel_only", { _user_id: userId });
  if (lemtelOnly === true) {
    return new Response(JSON.stringify({ error: "forbidden_wrong_app", app: "lemtel" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AVA scope check via security definer helper
  const { data: isMember, error: rpcErr } = await supabase.rpc("is_planipret_member", {
    _user_id: userId,
  });
  if (rpcErr || isMember !== true) {
    return new Response(JSON.stringify({ error: "Forbidden — Planiprêt access only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile, error: profErr } = await supabase
    .from("planipret_profiles")
    .select("id, extension, ns_domain, organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profErr || !profile) {
    return new Response(JSON.stringify({ error: "Planiprêt profile not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (profile.organization_id !== AVA_ORG_ID) {
    return new Response(JSON.stringify({ error: "Wrong organization scope" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!profile.extension || !profile.ns_domain) {
    // Soft response: profile not yet linked to NS extension.
    // Returning 200 + needs_link lets the UI render an empty state instead of blanking.
    return new Response(
      JSON.stringify({
        ok: true,
        needs_link: true,
        items: [],
        count: 0,
        data: [],
        error: "Extension or NS domain missing on profile",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return {
    ctx: { userId, profileId: profile.id, extension: profile.extension, nsDomain: profile.ns_domain },
    supabase,
    userClient,
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
