// Resolve a logged-in broker's SIP credentials. Returns SIP config to be used
// by the softphone (PJSIP). Generates/fetches a device password from NS-API,
// stores it securely (Vault if available, else service-role-restricted column),
// and returns it ONCE over TLS. Never logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NS_API_KEY = Deno.env.get("NS_API_KEY") ?? "";
const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "planipret.ca";
const NS_SIP_PROXY = Deno.env.get("NS_SIP_PROXY") ?? "voice.ava-telecom.ca";
const NS_SIP_WSS_URL = Deno.env.get("NS_SIP_WSS_URL") ?? `wss://${NS_SIP_PROXY}:7443`;
const NS_SIP_WSS_URLS = (Deno.env.get("NS_SIP_WSS_URLS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function nsFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${NS_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${NS_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

function randomPassword(len = 20): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "not_authenticated" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile, error: pErr } = await admin
    .from("planipret_profiles")
    .select("id,ns_extension,ns_domain,ns_sip_username,ns_sip_password_ref,ns_linked")
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr) return json({ error: "profile_lookup_failed" }, 500);
  if (!profile) return json({ error: "no_profile" }, 404);
  if (!profile.ns_linked || !profile.ns_extension) {
    return json({ error: "not_linked", needs_link: true }, 409);
  }

  const domain = profile.ns_domain || NS_DEFAULT_DOMAIN;
  const extension = String(profile.ns_extension);
  const sipUsername = profile.ns_sip_username || extension;

  // Try to retrieve existing password from Vault
  let sipPassword: string | null = null;
  const ref = profile.ns_sip_password_ref;
  if (ref) {
    try {
      const { data: v } = await admin.rpc("read_planipret_sip_secret", { _name: ref });
      if (typeof v === "string" && v.length) sipPassword = v;
    } catch { /* vault not accessible */ }
  }

  if (!sipPassword) {
    // Need to generate / fetch a fresh device password
    // Look for existing softphone device on NS-API
    const devicesRes = await nsFetch(`/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices`);
    let device: any = Array.isArray(devicesRes.data) ? devicesRes.data.find((d: any) =>
      String(d?.device ?? d?.aor ?? "").toLowerCase().includes("softphone") ||
      String(d?.["device-provisioning-protocol"] ?? "").toLowerCase() === "sip"
    ) ?? devicesRes.data[0] : null;

    sipPassword = randomPassword(22);

    if (device) {
      // Update existing device password
      const deviceId = device.device ?? device.aor ?? device["device-aor"];
      await nsFetch(
        `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices/${encodeURIComponent(deviceId)}`,
        { method: "PUT", body: JSON.stringify({ "authentication-key": sipPassword }) },
      );
    } else {
      // Create a new softphone device
      const deviceId = `${extension}_app`;
      await nsFetch(
        `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices`,
        {
          method: "POST",
          body: JSON.stringify({
            device: deviceId,
            "authentication-key": sipPassword,
            "device-provisioning-protocol": "sip",
            "device-model": "Generic Softphone",
          }),
        },
      );
    }

    // Store in Vault
    const secretName = `pp_sip_${profile.id}`;
    try {
      await admin.rpc("create_planipret_sip_secret", {
        _name: secretName, _value: sipPassword, _broker_id: profile.id,
      });
    } catch (e) {
      console.error("vault_store_failed", (e as Error).message);
    }

    await admin.from("planipret_profiles")
      .update({ ns_sip_password_ref: secretName })
      .eq("id", profile.id);
  }

  return json({
    ok: true,
    sip_username: sipUsername,
    sip_extension: extension,
    sip_domain: domain,
    sip_proxy: NS_SIP_PROXY,
    sip_wss_url: NS_SIP_WSS_URL,
    sip_wss_urls: Array.from(new Set([NS_SIP_WSS_URL, ...NS_SIP_WSS_URLS])),
    sip_password: sipPassword,
    // never log this response
  });
});
