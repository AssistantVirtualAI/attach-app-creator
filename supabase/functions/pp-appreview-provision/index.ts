// One-shot: provision a NetSapiens test SIP account for App Store / Play
// Store review. Creates the user (extension) and a mobile device with the
// supplied auth key. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NS_API_KEY = Deno.env.get("NS_API_KEY") ?? "";
const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function ns(path: string, init: RequestInit = {}) {
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
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" as any });
  const { data: isSuper } = await admin.rpc("has_role", { _user_id: user.id, _role: "super_admin" as any });
  if (!isAdmin && !isSuper) return json({ error: "forbidden" }, 403);

  const body: any = await req.json().catch(() => ({}));
  const domain = String(body?.domain ?? "appreview");
  const ext = String(body?.extension ?? "2000");
  const password = String(body?.password ?? "Appreview2026!");
  const email = String(body?.email ?? "appreview@planipret.ca");
  const firstName = String(body?.first_name ?? "App");
  const lastName = String(body?.last_name ?? "Review");

  const steps: any[] = [];

  // 1) Ensure the user (extension) exists on the domain.
  const userRes = await ns(`/domains/${encodeURIComponent(domain)}/users`, {
    method: "POST",
    body: JSON.stringify({
      user: ext,
      extension: ext,
      first_name: firstName,
      last_name: lastName,
      email,
      password,
      "name-first-name": firstName,
      "name-last-name": lastName,
    }),
  });
  steps.push({ step: "create_user", status: userRes.status, ok: userRes.ok, data: userRes.data });

  // 2) Create the mobile SIP device with the requested auth key.
  const deviceId = `${ext}_mobile`;
  const devRes = await ns(`/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(ext)}/devices`, {
    method: "POST",
    body: JSON.stringify({
      device: deviceId,
      "authentication-key": password,
      "device-provisioning-protocol": "sip",
      "device-model": "Mobile Softphone",
    }),
  });
  steps.push({ step: "create_mobile_device", status: devRes.status, ok: devRes.ok, data: devRes.data });

  // 3) Also create a widget device so both endpoints can ring during review.
  const widgetId = `${ext}_web`;
  const webRes = await ns(`/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(ext)}/devices`, {
    method: "POST",
    body: JSON.stringify({
      device: widgetId,
      "authentication-key": password,
      "device-provisioning-protocol": "sip",
      "device-model": "WebRTC",
    }),
  });
  steps.push({ step: "create_widget_device", status: webRes.status, ok: webRes.ok, data: webRes.data });

  return json({
    ok: userRes.ok || userRes.status === 409,
    domain,
    extension: ext,
    devices: { mobile: deviceId, widget: widgetId },
    credentials: { username: ext, domain, password },
    steps,
  });
});
