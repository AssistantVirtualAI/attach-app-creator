// Resolve a logged-in broker's SIP credentials for a SPECIFIC client type
// (mobile app vs Maestro widget). Each client_type maps to its OWN NS-API
// device so the mobile app and the widget can both register at the same time
// and ring simultaneously (NetSapiens forks INVITEs to every registered
// device of an extension by default). We never touch a device that doesn't
// match the requested client_type, so rotating the mobile password never
// invalidates the widget (and vice-versa).
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

type ClientType = "mobile" | "widget";

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

function randomPassword(len = 22): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
  return s;
}

function normalizeClientType(v: unknown): ClientType {
  return v === "widget" ? "widget" : "mobile";
}

function defaultDeviceId(extension: string, clientType: ClientType): string {
  return clientType === "widget" ? `${extension}_web` : `${extension}_mobile`;
}

function deviceIdOf(d: any): string | null {
  const id = d?.device ?? d?.aor ?? d?.["device-aor"] ?? d?.["aor-user"] ?? null;
  return id ? String(id) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body allowed */ }
  const clientType: ClientType = normalizeClientType(body?.client_type);

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
    .select("id,ns_extension,ns_domain,ns_sip_username,ns_sip_password_ref,ns_sip_password_ref_mobile,ns_mobile_device_id,ns_widget_device_id,ns_linked")
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

  // Which device id do we own for this client_type?
  const storedDeviceId = clientType === "widget"
    ? profile.ns_widget_device_id
    : profile.ns_mobile_device_id;
  const passwordRefColumn = clientType === "widget"
    ? "ns_sip_password_ref"
    : "ns_sip_password_ref_mobile";
  const storedRef = clientType === "widget"
    ? profile.ns_sip_password_ref
    : profile.ns_sip_password_ref_mobile;

  // Try Vault first (never rotate an existing password unless we must).
  let sipPassword: string | null = null;
  if (storedRef) {
    try {
      const { data: v } = await admin.rpc("read_planipret_sip_secret", { _name: storedRef });
      if (typeof v === "string" && v.length) sipPassword = v;
    } catch { /* vault unavailable */ }
  }

  // Find our device on NS-API (only the one that matches this client_type).
  const devicesRes = await nsFetch(
    `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices`,
  );
  const deviceList: any[] = Array.isArray(devicesRes.data) ? devicesRes.data : [];

  const targetId = storedDeviceId || defaultDeviceId(extension, clientType);
  const otherStoredId = clientType === "widget"
    ? profile.ns_mobile_device_id
    : profile.ns_widget_device_id;

  let device = deviceList.find((d) => deviceIdOf(d) === targetId) ?? null;

  // Fallback discovery: if we don't have a stored id yet, try to detect an
  // existing device with a naming hint (_web/_widget for widget, _mobile/_app
  // for mobile) but NEVER pick the device already claimed by the other
  // client type.
  if (!device && !storedDeviceId) {
    const hints = clientType === "widget"
      ? ["_web", "_widget", "web", "widget", "maestro"]
      : ["_mobile", "_app", "mobile"];
    device = deviceList.find((d) => {
      const id = (deviceIdOf(d) || "").toLowerCase();
      if (!id) return false;
      if (otherStoredId && id === String(otherStoredId).toLowerCase()) return false;
      return hints.some((h) => id.includes(h));
    }) ?? null;
  }

  const resolvedDeviceId = device ? (deviceIdOf(device) ?? targetId) : targetId;

  if (!device) {
    // Create a dedicated device for this client_type. Do NOT touch other devices.
    sipPassword = sipPassword || randomPassword(22);
    await nsFetch(
      `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices`,
      {
        method: "POST",
        body: JSON.stringify({
          device: resolvedDeviceId,
          "authentication-key": sipPassword,
          "device-provisioning-protocol": "sip",
          "device-model": clientType === "widget" ? "Web Softphone" : "Mobile Softphone",
        }),
      },
    );
  } else if (!sipPassword) {
    // We own the device but lost the password (fresh Vault, migration, etc.).
    // Rotate ONLY this device's key.
    sipPassword = randomPassword(22);
    await nsFetch(
      `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices/${encodeURIComponent(resolvedDeviceId)}`,
      { method: "PUT", body: JSON.stringify({ "authentication-key": sipPassword }) },
    );
  }

  // Persist Vault secret + device id mapping.
  const secretName = `pp_sip_${profile.id}_${clientType}`;
  try {
    await admin.rpc("create_planipret_sip_secret", {
      _name: secretName, _value: sipPassword, _broker_id: profile.id,
    });
  } catch (e) {
    console.error("vault_store_failed", (e as Error).message);
  }

  const updatePatch: Record<string, unknown> = { [passwordRefColumn]: secretName };
  if (clientType === "widget") updatePatch.ns_widget_device_id = resolvedDeviceId;
  else updatePatch.ns_mobile_device_id = resolvedDeviceId;
  await admin.from("planipret_profiles").update(updatePatch).eq("id", profile.id);

  return json({
    ok: true,
    client_type: clientType,
    device_id: resolvedDeviceId,
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
