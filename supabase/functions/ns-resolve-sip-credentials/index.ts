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
  // Only ns_extension is strictly required — if ns_linked is false but an
  // extension exists we can still (re)provision {ext}_mobile/{ext}_web on
  // NS-API and flip ns_linked=true on success. This is what makes the mobile
  // app self-heal when the admin flow forgot to mark the profile as linked.
  if (!profile.ns_extension) {
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

  // Fallback discovery is ONLY for widget (legacy Maestro naming). For mobile
  // we ALWAYS use `{ext}_mobile` and never inspect other devices, so we can
  // never accidentally hijack the widget's registration/password.
  if (!device && !storedDeviceId && clientType === "widget") {
    const hints = ["_web", "_widget", "web", "widget", "maestro"];
    device = deviceList.find((d) => {
      const id = (deviceIdOf(d) || "").toLowerCase();
      if (!id) return false;
      if (otherStoredId && id === String(otherStoredId).toLowerCase()) return false;
      return hints.some((h) => id.includes(h));
    }) ?? null;
  }

  const resolvedDeviceId = device ? (deviceIdOf(device) ?? targetId) : targetId;
  let createDetails: any = null;

  if (!device) {
    // Create a dedicated device for this client_type. Do NOT touch other devices.
    sipPassword = sipPassword || randomPassword(22);
    const modelPref = clientType === "widget" ? "Web Softphone" : "Mobile Softphone";
    // Try with device-model first. If NS rejects (some tenants restrict the
    // catalog), retry without it — device-model is optional on NS-API v2.
    const buildBody = (withModel: boolean) => JSON.stringify({
      device: resolvedDeviceId,
      "authentication-key": sipPassword,
      "device-provisioning-protocol": "sip",
      ...(withModel ? { "device-model": modelPref } : {}),
      });
    });
    let createRes = await nsFetch(
      `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices`,
      { method: "POST", body: buildBody(true) },
    );
    if (!createRes.ok) {
      const retry = await nsFetch(
        `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices`,
        { method: "POST", body: buildBody(false) },
      );
      createDetails = { first: { status: createRes.status, data: createRes.data }, retry: { status: retry.status, data: retry.data } };
      createRes = retry;
    } else {
      createDetails = { first: { status: createRes.status, data: createRes.data } };
    }

    // Trace per-broker provisioning (idempotent). Best-effort — the log table
    // may not have action/status/details columns on older deployments.
    try {
      await admin.from("planipret_ns_migration_log").insert({
        broker_id: profile.id,
        action: `create_${clientType}_device`,
        status: createRes.ok ? "ok" : "error",
        details: { device_id: resolvedDeviceId, ns_status: createRes.status, ns_body: createRes.data },
      });
    } catch { /* logging is best-effort */ }

    // Verify the device actually exists on NS before persisting our mapping.
    const verify = await nsFetch(
      `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(extension)}/devices`,
    );
    const verifyList: any[] = Array.isArray(verify.data) ? verify.data : [];
    const exists = verifyList.some((d) => deviceIdOf(d) === resolvedDeviceId);
    if (!exists) {
      return json({
        ok: false,
        error: "device_create_failed",
        client_type: clientType,
        target_device_id: resolvedDeviceId,
        ns_extension: extension,
        ns_domain: domain,
        ns_create: createDetails,
        ns_devices_now: verifyList.map((d) => deviceIdOf(d)).filter(Boolean),
      }, 502);
    }
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
  if (!profile.ns_linked) {
    updatePatch.ns_linked = true;
    updatePatch.ns_linked_at = new Date().toISOString();
  }
  await admin.from("planipret_profiles").update(updatePatch).eq("id", profile.id);

  return json({
    ok: true,
    client_type: clientType,
    device_id: resolvedDeviceId,
    device_created: !device,
    ns_create: createDetails,
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

