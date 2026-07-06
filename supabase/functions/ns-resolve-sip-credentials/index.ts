// Resolve per-broker SIP credentials by querying NS-API for the real device.
// Uses NS_API_KEY server-side; the browser never sees the NS token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NS_API_KEY = Deno.env.get("NS_API_KEY") ?? "";
const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "planipret.ca";
const FALLBACK_PROXY = Deno.env.get("NS_SIP_PROXY") ?? "core1.cluster1.ucstack.io";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type ClientType = "mobile" | "web" | "widget";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeClientType(v: unknown): ClientType {
  if (v === "widget") return "widget";
  if (v === "web") return "web";
  return "mobile";
}

function deviceNameFor(ext: string, ct: ClientType): string {
  if (ct === "widget") return `${ext}x`;
  return `${ext}_${ct}`;
}

function deviceIdOf(d: any): string | null {
  const id = d?.device ?? d?.aor ?? d?.["device-aor"] ?? null;
  if (!id) return null;
  return String(id).replace(/^sip:/i, "").split("@")[0] || null;
}

async function nsGet(path: string) {
  const res = await fetch(`${NS_API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${NS_API_KEY}`, Accept: "application/json" },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty ok */ }
  const clientType = normalizeClientType(body?.client_type);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ ok: false, error: "not_authenticated" }, 401);

  const { data: profile } = await userClient
    .from("planipret_profiles")
    .select("id, ns_extension, ns_domain")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.ns_extension) {
    return json({
      ok: false,
      error: "no_extension",
      action: "Contactez votre administrateur pour lier votre extension NetSapiens.",
    }, 200);
  }

  const ext = String(profile.ns_extension);
  const domain = profile.ns_domain || NS_DEFAULT_DOMAIN;
  const deviceName = deviceNameFor(ext, clientType);

  console.log(`[ns-resolve] client_type=${clientType} ext=${ext} device=${deviceName}`);

  // Try the specific device first.
  let detail = await nsGet(`/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(ext)}/devices/${encodeURIComponent(deviceName)}`);
  let device: any = detail.ok ? (Array.isArray(detail.data) ? detail.data[0] : detail.data) : null;
  let availableDevices: string[] = [];

  if (!device) {
    const list = await nsGet(`/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(ext)}/devices`);
    const arr: any[] = Array.isArray(list.data) ? list.data : [];
    availableDevices = arr.map(deviceIdOf).filter(Boolean) as string[];
    device = arr.find((d) => {
      const id = (deviceIdOf(d) || "").toLowerCase();
      return id === deviceName.toLowerCase();
    }) ?? null;
  }

  if (!device) {
    return json({
      ok: false,
      error: `device_not_found`,
      device_name: deviceName,
      available_devices: availableDevices,
      extension: ext,
      domain,
      action: "Aucun device SIP trouvé. Lancez la provision (ns-provision-broker-devices) ou contactez votre administrateur.",
    }, 200);
  }

  const resolvedId = deviceIdOf(device) || deviceName;
  const sipPassword = device["device-sip-registration-password"] ?? device["sip-registration-password"] ?? null;
  const rawCore = (device["core-server"] ?? device["device-sip-registration-core-server"] ?? device["sip-registration-core-server"] ?? "").toString().trim();
  const coreServer = (rawCore || FALLBACK_PROXY).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const sipUri = device["device-sip-registration-uri"] ?? `sip:${resolvedId}@${domain}`;
  const sipState = device["device-sip-registration-state"] ?? device["registration-state"] ?? null;
  return json({
    ok: true,
    client_type: clientType,
    device_id: resolvedId,
    sip_username: resolvedId,
    sip_extension: ext,
    sip_domain: domain,
    sip_proxy: coreServer,
    sip_core_server: coreServer,
    sip_password: sipPassword,
    password: sipPassword,
    sip_uri: sipUri,
    sip_state: sipState,
    device_registered: sipState === "registered",
  });
});
