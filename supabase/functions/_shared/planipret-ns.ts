// Shared helpers for Planiprêt NS-API v2 edge functions.
// IMPORTANT: AVA-only. Never used by Lemtel PBX functions.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export const AVA_ORG_ID = "17d6507f-a9ca-409d-8e49-371d50332615";

export { corsHeaders };

export type NsContext = {
  userId: string;
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

export async function getNsJwt(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const env = getEnv();
  const res = await fetch(`${env.NS_API_BASE_URL.replace(/\/$/, "")}/ns-api/v2/jwt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env.NS_API_USER, password: env.NS_API_PASSWORD }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`NS-API auth failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const token = data.token ?? data.access_token ?? data.jwt;
  if (!token) throw new Error("NS-API auth: no token in response");
  // tokens typically last ~1h; default to 50 min if exp not provided
  cachedToken = { token, exp: Date.now() + 50 * 60 * 1000 };
  return token;
}

export async function nsFetch(path: string, init: RequestInit = {}) {
  const env = getEnv();
  const token = await getNsJwt();
  const url = `${env.NS_API_BASE_URL.replace(/\/$/, "")}/ns-api/v2${path}`;
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
  }
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
    .select("extension, ns_domain, organization_id")
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
    return new Response(
      JSON.stringify({ error: "Extension or NS domain missing on profile" }),
      { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return {
    ctx: { userId, extension: profile.extension, nsDomain: profile.ns_domain },
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
