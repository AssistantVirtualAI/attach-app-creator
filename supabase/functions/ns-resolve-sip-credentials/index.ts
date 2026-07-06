// Return SIP credentials for a Planiprêt broker based on client_type.
// NEW APPROACH: credentials are FIXED and read from environment secrets — no
// more per-user NS-API device lookups / provisioning. Mobile app and Web
// widget map to two dedicated NetSapiens devices (113_mobile / 113_web) that
// are pre-provisioned on the tenant. Each surface registers with its own
// device so both can ring at the same time.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type ClientType = "mobile" | "widget" | "web";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeClientType(v: unknown): ClientType {
  if (v === "widget" || v === "web") return "widget";
  return "mobile";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body allowed */ }
  const clientType: ClientType = normalizeClientType(body?.client_type);

  // Auth check — brokers only.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: "not_authenticated" }, 401);

  const isMobile = clientType === "mobile";
  const prefix = isMobile ? "NS_SIP_MOBILE_" : "NS_SIP_WEB_";

  const sipUsername = Deno.env.get(`${prefix}USERNAME`) ?? "";
  const sipPassword = Deno.env.get(`${prefix}PASSWORD`) ?? "";
  const sipDomain = Deno.env.get(`${prefix}DOMAIN`) ?? "planipret.ca";
  const sipProxy = Deno.env.get(`${prefix}OUTBOUND_PROXY`) ?? "core1.cluster1.ucstack.io";
  const sipWssUrl = Deno.env.get(`${prefix}WSS_URL`) ?? `wss://${sipProxy}:443/ws`;

  if (!sipUsername || !sipPassword) {
    return json({ ok: false, error: "sip_credentials_not_configured", client_type: clientType }, 500);
  }

  return json({
    ok: true,
    client_type: clientType,
    device_id: sipUsername,
    sip_username: sipUsername,
    sip_extension: sipUsername.replace(/_(web|mobile)$/i, ""),
    sip_domain: sipDomain,
    sip_proxy: sipProxy,
    sip_core_server: sipProxy,
    sip_wss_url: sipWssUrl,
    sip_wss_urls: [sipWssUrl],
    sip_password: sipPassword,
    sip_uri: `sip:${sipUsername}@${sipDomain}`,
    // legacy compat
    password: sipPassword,
  });
});
