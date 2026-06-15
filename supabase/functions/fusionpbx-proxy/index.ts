// FusionPBX v7 REST proxy for the AVA Statistic / Lemtel app.
// All client calls authenticate via Supabase JWT; the FusionPBX credentials
// (URL, username, API key, domain UUID) live only in Vault.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });

const LEMTEL_ORG = "71755d33-ed64-4ad5-a828-61c9d2029eb7";

// --------------------------------------------------------------------------
// FusionPBX PHP session login cache.
// /app/call_recordings/download.php uses PHP session cookies (not the API
// Basic auth), so we POST to /login.php and reuse the resulting cookie for
// up to 25 minutes per edge-runtime instance.
// --------------------------------------------------------------------------
type FusionSessionEntry = { cookie: string; expiresAt: number };
const FUSION_SESSIONS = new Map<string, FusionSessionEntry>();

// Cache for live SIP registrations (per domain_uuid). Short TTL to shield
// FusionPBX from dashboard polling while still feeling realtime.
type RegCacheEntry = { fetchedAt: number; payload: any };
const REGISTRATIONS_CACHE = new Map<string, RegCacheEntry>();
const REGISTRATIONS_TTL_MS = 15_000;

// Cache for live active calls (per domain_uuid)
type LiveCacheEntry = { fetchedAt: number; payload: any };
const ACTIVE_CALLS_CACHE = new Map<string, LiveCacheEntry>();
const ACTIVE_CALLS_TTL_MS = 5_000;

// Cache for live system health (per origin)
const SYSTEM_HEALTH_CACHE = new Map<string, LiveCacheEntry>();
const SYSTEM_HEALTH_TTL_MS = 10_000;

function fusionBaseOrigin(baseUrl: string) {
  try { return new URL(baseUrl).origin.replace(/\/+$/, ""); }
  catch { return String(baseUrl || "").replace(/\/+$/, ""); }
}

function firstPhpSessionCookie(setCookieHeader: string) {
  return (setCookieHeader || "").match(/PHPSESSID=[^;]+/i)?.[0] || "";
}

async function getFusionSessionCookie(baseUrl: string): Promise<string> {
  const now = Date.now();
  const origin = fusionBaseOrigin(baseUrl);
  const cached = FUSION_SESSIONS.get(origin);
  if (cached?.cookie && cached.expiresAt > now) return cached.cookie;

  const username = Deno.env.get("FUSIONPBX_USERNAME") || "";
  const password = Deno.env.get("FUSIONPBX_PASSWORD") || "";
  if (!username || !password) throw new Error("FUSIONPBX_PASSWORD not configured");

  // 1. Hit /login.php on the same host that will serve the audio to bootstrap
  // the host-scoped PHPSESSID cookie. Recording downloads are served by
  // pbxnode.lemtel.tel, so the session must be created on that host.
  const bootstrap = await fetch(`${origin}/login.php`, { redirect: "manual" });
  let cookie = firstPhpSessionCookie(bootstrap.headers.get("set-cookie") || "");
  const loginHtml = await bootstrap.text().catch(() => "");

  // Extract CSRF hidden inputs. FusionPBX renders one or more hidden inputs
  // with hex-string names AND hex-string values that must be echoed back.
  const csrfFields: Array<[string, string]> = [];
  const inputRegex = /<input\b[^>]*type=["']hidden["'][^>]*>/gi;
  for (const tag of loginHtml.match(inputRegex) || []) {
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
    const valueMatch = tag.match(/\bvalue=["']([^"']*)["']/i);
    if (!nameMatch || !valueMatch) continue;
    const name = nameMatch[1];
    const value = valueMatch[1];
    // Skip well-known non-CSRF fields
    if (/^(username|password|path|persistent)$/i.test(name)) continue;
    csrfFields.push([name, value]);
  }

  // 2. POST credentials with CSRF fields echoed back.
  const form = new URLSearchParams();
  form.set("username", username);
  form.set("password", password);
  form.set("path", "/");
  for (const [n, v] of csrfFields) form.set(n, v);
  const loginRes = await fetch(`${origin}/login.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: form.toString(),
    redirect: "manual",
  });
  const loginLocation = loginRes.headers.get("location") || "";
  const sessionMatch2 = firstPhpSessionCookie(loginRes.headers.get("set-cookie") || "");
  if (sessionMatch2) cookie = sessionMatch2;
  const loginStatus = loginRes.status;
  await loginRes.body?.cancel();
  if (!cookie) throw new Error(`FusionPBX login did not return a session cookie for ${origin}`);
  if (loginStatus >= 400) throw new Error(`FusionPBX login failed for ${origin} (${loginStatus}, csrf=${csrfFields.length})`);
  if (/login\.php/i.test(loginLocation) && loginStatus >= 300 && loginStatus < 400) {
    throw new Error(`FusionPBX login redirected back to login for ${origin} (csrf=${csrfFields.length})`);
  }


  // 3. Verify the session is authenticated by hitting a protected page without
  // following redirects. A redirect to login means the cookie is not authenticated.
  const probe = await fetch(`${origin}/core/user_settings/user_settings.php`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  const status = probe.status;
  const location = probe.headers.get("location") || "";
  await probe.body?.cancel();
  if (status >= 400 || (status >= 300 && status < 400 && /login\.php/i.test(location))) {
    throw new Error(`FusionPBX session probe failed for ${origin} (${status})`);
  }

  FUSION_SESSIONS.set(origin, { cookie, expiresAt: now + 25 * 60 * 1000 });
  return cookie;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Identify caller (JWT in Authorization header OR service-role for pg_cron)
  let userId: string | null = null;
  let organization_id: string | undefined;
  const authHeader = req.headers.get("Authorization") || "";
  const apiKeyHeader = req.headers.get("apikey") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  // Only the service-role key constitutes a trusted server-side call.
  // The anon key is public (shipped to the client) and must NOT bypass auth.
  const isServiceCall =
    authHeader === `Bearer ${serviceKey}` ||
    apiKeyHeader === serviceKey;

  if (!isServiceCall) {
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    userId = user.id;
  }

  // Parse body early to know which action is being requested
  let _bodyEarly: any = {};
  try { _bodyEarly = await req.clone().json(); } catch { /* allow empty */ }
  const _earlyAction: string = _bodyEarly.action || "ping";

  // Authorization: Lemtel members/admins, OR org_admin of the tenant whose
  // domain_uuid is being acted upon. This lets each customer's admin manage
  // their own phone system through the proxy.
  if (!isServiceCall && userId) {
    const readOnly = new Set(["ping", "debug-raw", "list-extensions", "list-domains", "list-cdrs", "get-cdrs", "sync-cdrs", "backfill-cdrs", "sync-domains", "sync-voicemail-messages", "sync-ivr-options", "sync-all", "get-recording", "get-recording-signed-url", "list-queues", "list-ivrs", "list-ring-groups", "list-moh", "list-recordings", "list-devices", "list-destinations", "list-voicemails", "list-voicemail-messages", "list-registrations", "get-registrations", "get-registrations-live", "list-gateways", "list-gateways-all-domains", "list-gateways-merged", "get-gateways", "list-sip-profiles", "list-conferences", "list-hold-music", "list-dialplans", "get-extension", "sync_status", "sync-status", "list-active-calls", "get-active-calls-live", "system-status", "get-system-health-live", "desktop-audit"]);
    const isRead = readOnly.has(_earlyAction);
    const rpcName = isRead ? "is_lemtel_member" : "is_lemtel_admin";
    const { data: allowed } = await admin.rpc(rpcName, { _user_id: userId });
    let permitted = !!allowed;
    if (!permitted) {
      // Fallback: is caller an org_admin of the tenant tied to the requested domain?
      const targetDomain = _bodyEarly?.domain_uuid || _bodyEarly?.params?.domain_uuid;
      if (targetDomain) {
        const { data: org } = await admin.from("organizations").select("id").eq("fusionpbx_domain_uuid", targetDomain).maybeSingle();
        if (org?.id) {
          const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _org_id: org.id, _role: "org_admin" });
          if (isAdmin) permitted = true;
        }
      }
    }
    if (!permitted) {
      return json({ error: "Forbidden", action: _earlyAction, required: rpcName }, 403);
    }
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const action: string = body.action || "ping";
  organization_id = body.organization_id || LEMTEL_ORG;
  const params = body.params || {};

  // Secrets
  const required = (n: string) => {
    const v = Deno.env.get(n);
    if (!v) throw { error: "MISSING_SECRET", secret: n, message: `Configure ${n} in Supabase Vault` };
    return v;
  };

  let FUSIONPBX_API_URL: string, FUSIONPBX_USERNAME: string, FUSIONPBX_API_KEY: string, FUSIONPBX_DOMAIN_UUID: string;
  const PBX_RECORDING_FILE_BASE = "https://pbxnode.lemtel.tel";
  try {
    FUSIONPBX_API_URL = required("FUSIONPBX_API_URL").replace(/\/+$/, "").replace(/\/app\/api(\/\d+)?$/, "");
    FUSIONPBX_USERNAME = required("FUSIONPBX_USERNAME");
    FUSIONPBX_API_KEY = required("FUSIONPBX_API_KEY");
    FUSIONPBX_DOMAIN_UUID = required("FUSIONPBX_DOMAIN_UUID");
  } catch (e: any) {
    return json(e, 400);
  }

  // FusionPBX returns Basic auth with the raw API key as the password value
  // when called with "Authorization: Basic <api_key>" (the API key already
  // encodes the credentials). We support both styles, defaulting to the
  // confirmed-working pattern: Basic <FUSIONPBX_API_KEY>.
  const basicHeader = `Basic ${FUSIONPBX_API_KEY}`;

  // Per-request domain override (each list/action can target any tenant domain)
  const requestedDomain: string = body.domain_uuid || params.domain_uuid || FUSIONPBX_DOMAIN_UUID;
  const domainQ = `domain_uuid=${requestedDomain}`;

  async function pbxFetch(path: string, init: RequestInit = {}) {
    const url = `${FUSIONPBX_API_URL}/app/api/7/${path}`;
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          Authorization: basicHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init.headers || {}),
        },
      });
    } catch (e: any) {
      return { ok: false, status: 0, error: "FUSIONPBX_UNREACHABLE", message: `Cannot reach ${FUSIONPBX_API_URL}: ${e?.message || e}`, latency_ms: Date.now() - started };
    }
    const text = await res.text();
    const latency_ms = Date.now() - started;
    if (res.status === 401 || res.status === 403)
      return { ok: false, status: res.status, error: "FUSIONPBX_AUTH_FAILED", message: "Check FUSIONPBX_API_KEY in Vault", latency_ms, raw: text.slice(0, 500) };
    if (res.status === 404)
      return { ok: false, status: 404, error: "ENDPOINT_NOT_FOUND", resource: path, latency_ms, raw: text.slice(0, 500) };
    let data: any;
    try { data = text ? JSON.parse(text) : {}; }
    catch { return { ok: false, status: res.status, error: "INVALID_RESPONSE", body: text.slice(0, 500), latency_ms }; }
    return { ok: res.ok, status: res.status, data, latency_ms };
  }

  // Normalise a FusionPBX collection response. Endpoints return either an
  // object keyed by the resource (e.g. { extensions: [...] }) or a bare array.
  function collection(data: any, key: string): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data[key])) return data[key];
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function mapExtension(e: any) {
    return {
      organization_id,
      pbx_uuid: e.extension_uuid,
      extension: String(e.extension ?? ""),
      effective_cid_name: e.effective_caller_id_name ?? null,
      effective_cid_number: e.effective_caller_id_number ?? null,
      call_group: e.call_group ?? null,
      voicemail_enabled: e.voicemail_enabled === "true" || e.voicemail_enabled === true,
      call_recording: e.user_record ?? "none",
      do_not_disturb: e.do_not_disturb === "true" || e.do_not_disturb === true,
      forward_all_destination: e.forward_all_destination ?? null,
      enabled: e.enabled === "true" || e.enabled === true || e.enabled === undefined,
      description: e.description ?? null,
      raw_data: e,
      synced_at: new Date().toISOString(),
    };
  }

  function mapDevice(d: any) {
    return {
      organization_id,
      pbx_uuid: d.device_uuid,
      mac_address: d.device_mac_address ?? d.mac_address ?? null,
      label: d.device_label ?? null,
      vendor: d.device_vendor ?? null,
      template: d.device_template ?? null,
      profile: d.device_profile_uuid ?? null,
      enabled: d.device_enabled === "true" || d.device_enabled === true || d.enabled === true,
      raw_data: d,
    };
  }

  function mapIvr(i: any) {
    return {
      organization_id,
      pbx_uuid: i.ivr_menu_uuid,
      name: i.ivr_menu_name ?? i.name ?? "IVR",
      extension: i.ivr_menu_extension ?? null,
      greet_long: i.ivr_menu_greet_long ?? null,
      greet_short: i.ivr_menu_greet_short ?? null,
      timeout_ms: i.ivr_menu_timeout ? parseInt(i.ivr_menu_timeout) : null,
      exit_action: i.ivr_menu_exit_action ?? null,
      direct_dial: i.ivr_menu_direct_dial === "true",
      ringback: i.ivr_menu_ringback ?? null,
      enabled: i.ivr_menu_enabled === "true" || i.ivr_menu_enabled === true,
      description: i.ivr_menu_description ?? null,
      raw_data: i,
    };
  }

  function mapQueue(q: any) {
    return {
      organization_id,
      pbx_uuid: q.call_center_queue_uuid ?? q.queue_uuid,
      name: q.queue_name ?? q.name ?? "Queue",
      extension: q.queue_extension ?? null,
      strategy: q.queue_strategy ?? null,
      music_on_hold: q.queue_moh_sound ?? null,
      record_enabled: q.queue_record_template ? true : false,
      max_wait_time: q.queue_max_wait_time ? parseInt(q.queue_max_wait_time) : null,
      timeout_action: q.queue_timeout_action ?? null,
      enabled: q.queue_enabled === "true" || q.queue_enabled === true,
      description: q.queue_description ?? null,
      raw_data: q,
    };
  }

  function mapRingGroup(r: any) {
    return {
      organization_id,
      pbx_uuid: r.ring_group_uuid,
      name: r.ring_group_name ?? "Ring Group",
      extension: r.ring_group_extension ?? null,
      strategy: r.ring_group_strategy ?? null,
      forwarding: r.ring_group_forward_destination ?? null,
      enabled: r.ring_group_enabled === "true" || r.ring_group_enabled === true,
      description: r.ring_group_description ?? null,
      raw_data: r,
    };
  }

  function mapCdr(c: any) {
    const recName = c.record_name ?? null;
    const hasRec = !!(recName && recName !== "");
    let answer = c.answer_stamp ?? null;
    if (!answer || answer === "1969-12-31 19:00:00-05" || c.answer_epoch === "0" || c.answer_epoch === 0) {
      answer = null;
    }
    const billsec = c.billsec != null ? parseInt(c.billsec) : 0;
    const direction = c.direction ?? null;
    let missed: boolean | null = null;
    if (c.missed_call === "true" || c.missed_call === true) missed = true;
    else if (c.missed_call === "false" || c.missed_call === false) missed = false;
    else missed = (billsec === 0 && direction === "inbound");
    return {
      organization_id,
      pbx_uuid: c.xml_cdr_uuid ?? c.cdr_uuid ?? c.uuid,
      extension_uuid: c.extension_uuid ?? null,
      domain_uuid: c.domain_uuid ?? null,
      domain_name: c.domain_name ?? null,
      direction,
      caller_name: c.caller_id_name ?? null,
      caller_number: c.caller_id_number ?? null,
      extension: c.extension ?? c.extension_number ?? c.caller_extension ?? null,
      destination: c.caller_destination ?? c.destination_number ?? null,
      source_number: c.source_number ?? null,
      destination_number: c.destination_number ?? null,
      start_at: c.start_stamp ?? null,
      answer_at: answer,
      end_at: c.end_stamp ?? null,
      duration_seconds: c.duration ? parseInt(c.duration) : 0,
      billsec,
      mos: c.rtp_audio_in_mos ? parseFloat(c.rtp_audio_in_mos) : null,
      missed_call: missed,
      voicemail_message: c.voicemail_message ?? null,
      has_recording: hasRec,
      recording_path: c.record_path ?? null,
      recording_name: recName,
      hangup_cause: c.hangup_cause ?? null,
      sip_call_id: c.sip_call_id ?? null,
      call_status: c.status ?? null,
      ivr_menu_uuid: c.ivr_menu_uuid ?? null,
      ring_group_uuid: c.ring_group_uuid ?? null,
      waitsec: c.waitsec != null ? parseInt(c.waitsec) : null,
      pdd_ms: c.pdd_ms != null ? parseInt(c.pdd_ms) : null,
      raw_data: c,
    };
  }

  // -------- Actions --------
  try {
    if (action === "ping") {
      const r = await pbxFetch(`extensions?${domainQ}&limit=1`);
      if (!r.ok) return json(r, r.status || 500);
      const exts = collection(r.data, "extensions");
      return json({ status: "ok", latency_ms: r.latency_ms, extensions_count: exts.length });
    }

    if (action === "debug-raw") {
      // Restricted to lemtel/super admins only — exposes raw FusionPBX
      // responses which may contain SIP passwords and other secrets.
      const { data: isAdmin } = await admin.rpc("is_lemtel_admin", { _user_id: userId });
      const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: userId });
      if (!isAdmin && !isSuper) return json({ error: "forbidden" }, 403);
      const p = params.path || "gateways";
      const r = await pbxFetch(p);
      // Strip well-known secret fields from any object before returning.
      const SECRET_KEYS = new Set(["password", "sip_password", "voicemail_password", "secret", "api_key", "auth_token"]);
      const scrub = (val: any): any => {
        if (Array.isArray(val)) return val.map(scrub);
        if (val && typeof val === "object") {
          const out: Record<string, any> = {};
          for (const [k, v] of Object.entries(val)) {
            out[k] = SECRET_KEYS.has(k.toLowerCase()) ? "***" : scrub(v);
          }
          return out;
        }
        return val;
      };
      return json({ ok: r.ok, status: r.status, raw: scrub(r.data), latency_ms: r.latency_ms });
    }

    if (action === "desktop-audit") {
      const auditAction = params.action || body.audit_action || "desktop.event";
      try {
        await admin.from("audit_logs").insert({
          organization_id,
          user_id: userId,
          action: auditAction,
          resource_type: params.resource_type || null,
          resource_id: params.resource_id || null,
          metadata: { source: "ava-softphone-desktop", ...(params.metadata || {}) },
        });
      } catch (auditErr: any) {
        console.warn("desktop audit failed:", auditErr?.message);
      }
      return json({ ok: true });
    }

    if (action === "list-gateways-all-domains") {
      const d = await pbxFetch("domains");
      const domains = collection(d.data, "domains");
      const results = await Promise.all(domains.map(async (dom: any) => {
        const r = await pbxFetch(`gateways?domain_uuid=${dom.domain_uuid}`);
        const rows = collection(r.data, "gateways");
        return rows.map((g: any) => ({ ...g, _domain_name: dom.domain_name, _domain_uuid: dom.domain_uuid }));
      }));
      const all = results.flat();
      return json({ ok: true, data: all, total_domains: domains.length, total_gateways: all.length });
    }

    // Merged: global gateways (no domain filter) + per-domain gateways, de-duped.
    // FusionPBX stores most gateways with domain_uuid=NULL (global to FreeSWITCH),
    // which are filtered OUT when ?domain_uuid= is supplied. The unfiltered call
    // is the one that matches what the FusionPBX GUI shows.
    if (action === "list-gateways-merged") {
      const globalRes = await pbxFetch(`gateways`);
      const globals = collection(globalRes.data, "gateways");
      const d = await pbxFetch("domains");
      const domains = collection(d.data, "domains");
      const perDomain = await Promise.all(domains.map(async (dom: any) => {
        const r = await pbxFetch(`gateways?domain_uuid=${dom.domain_uuid}`);
        return collection(r.data, "gateways").map((g: any) => ({ ...g, _domain_name: dom.domain_name, _domain_uuid: dom.domain_uuid }));
      }));
      const scoped = perDomain.flat();
      const map = new Map<string, any>();
      for (const g of [...globals, ...scoped]) {
        const id = g.gateway_uuid || g.gateway;
        if (id && !map.has(id)) map.set(id, g);
      }
      const data = Array.from(map.values());
      return json({
        ok: true,
        data,
        total_global: globals.length,
        total_scoped: scoped.length,
        total_unique: data.length,
        global_status: globalRes.status,
        global_error: globalRes.ok ? null : ((globalRes as any).error || (globalRes as any).raw || null),
      });
    }

    // ---- LIST actions ----
    const listMap: Record<string, { path: string; key: string }> = {
      "list-extensions":    { path: `extensions?${domainQ}`,          key: "extensions" },
      "list-devices":       { path: `devices?${domainQ}`,             key: "devices" },
      "list-ivrs":          { path: `ivr_menus?${domainQ}`,           key: "ivr_menus" },
      "list-queues":        { path: `call_center_queues?${domainQ}`,  key: "call_center_queues" },
      "list-ring-groups":   { path: `ring_groups?${domainQ}`,         key: "ring_groups" },
      "list-destinations":  { path: `destinations?${domainQ}`,        key: "destinations" },
      "list-voicemails":    { path: `voicemails?${domainQ}`,          key: "voicemails" },
      "list-registrations": { path: `registrations?${domainQ}`,       key: "registrations" },
      "list-moh":           { path: `music_on_hold?${domainQ}`,       key: "music_on_hold" },
      "list-recordings":    { path: `recordings?${domainQ}`,          key: "recordings" },
      "list-domains":       { path: `domains`,                        key: "domains" },
    };
    if (listMap[action]) {
      const m = listMap[action];
      const r = await pbxFetch(m.path);
      if (!r.ok) return json(r, r.status || 500);
      return json({ ok: true, data: collection(r.data, m.key), latency_ms: r.latency_ms });
    }

    // ---- CREATE / UPDATE / DELETE helpers ----
    // FusionPBX API v7 requires QUERY-PARAM auth (?key=...&username=...) for
    // POST/PUT/DELETE — the Authorization header returns 403 on writes.
    async function pbxWrite(path: string, method: "POST" | "PUT" | "DELETE", payload?: unknown) {
      const url = new URL(`${FUSIONPBX_API_URL}/app/api/7/${path}`);
      url.searchParams.set("key", FUSIONPBX_API_KEY);
      url.searchParams.set("username", FUSIONPBX_USERNAME);
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(url.toString(), {
          method,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: payload !== undefined ? JSON.stringify(payload) : undefined,
        });
      } catch (e: any) {
        return { ok: false, status: 0, error: "FUSIONPBX_UNREACHABLE", message: e?.message || String(e), latency_ms: Date.now() - started };
      }
      const text = await res.text();
      const latency_ms = Date.now() - started;
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      const embeddedCode = data?.code || data?.details?.[0]?.code;
      const embeddedMessage = data?.details?.[0]?.message || data?.message || (typeof data?.raw === "string" ? data.raw : null);
      const failed = !res.ok || (embeddedCode && String(embeddedCode) !== "200");
      return { ok: !failed, status: res.status, data, latency_ms, embeddedCode: embeddedCode ?? null, message: embeddedMessage };
    }

    async function writeCollection(path: string, key: string, payload: any) {
      return pbxWrite(path, "POST", { [key]: [{ ...payload, domain_uuid: payload?.domain_uuid || requestedDomain || FUSIONPBX_DOMAIN_UUID }] });
    }

    // ---- DOMAIN management (multi-tenant provisioning) ----
    if (action === "create-domain" || action === "createDomain") {
      const domain_name = body.domain_name || params.domain_name;
      const description = body.domain_description || params.domain_description || `Customer domain`;
      if (!domain_name) return json({ ok: false, error: "domain_name required" }, 400);
      const r = await pbxWrite("domains", "POST", {
        domains: [{ domain_name, domain_description: description, domain_enabled: "true" }],
      });
      if (!r.ok) return json(r, r.status || 500);
      // Try to read back the UUID
      const list = await pbxFetch(`domains?domain_name=${encodeURIComponent(domain_name)}`);
      const arr = collection(list.data, "domains");
      const created = arr.find((d: any) => d.domain_name === domain_name) || arr[0];
      return json({ ok: true, domain_uuid: created?.domain_uuid || null, domain_name, raw: r.data });
    }

    if (action === "delete-domain") {
      const id = body.domain_uuid || params.domain_uuid;
      if (!id) return json({ ok: false, error: "domain_uuid required" }, 400);
      return json(await pbxWrite(`domains/${id}`, "DELETE"));
    }

    if (action === "update-domain") {
      const id = body.domain_uuid || params.domain_uuid;
      if (!id) return json({ ok: false, error: "domain_uuid required" }, 400);
      const patch: Record<string, unknown> = { domain_uuid: id };
      if ("domain_description" in params) patch.domain_description = (params as any).domain_description;
      if ("domain_enabled" in params) patch.domain_enabled = String((params as any).domain_enabled);
      if ("domain_name" in params) patch.domain_name = (params as any).domain_name;
      return json(await pbxWrite(`domains/${id}`, "PUT", { domains: [patch] }));
    }

    if (action === "get-registrations") {
      const r = await pbxFetch(`registrations?${domainQ}`);
      if (!r.ok) return json(r, r.status || 500);
      return json({ ok: true, data: collection(r.data, "registrations") });
    }

    // Live registrations with normalization + short-TTL cache.
    // Resolves domain_uuid from the org when not provided.
    if (action === "get-registrations-live") {
      let domainUuid: string = body.domain_uuid || params.domain_uuid || "";
      if (!domainUuid && organization_id) {
        const { data: org } = await admin
          .from("organizations")
          .select("fusionpbx_domain_uuid")
          .eq("id", organization_id)
          .maybeSingle();
        domainUuid = (org as any)?.fusionpbx_domain_uuid || FUSIONPBX_DOMAIN_UUID;
      }
      if (!domainUuid) domainUuid = FUSIONPBX_DOMAIN_UUID;

      const now = Date.now();
      const force = body.force === true || params.force === true;
      const cached = REGISTRATIONS_CACHE.get(domainUuid);
      if (!force && cached && now - cached.fetchedAt < REGISTRATIONS_TTL_MS) {
        return json({ ...cached.payload, cached: true });
      }

      const r = await pbxFetch(`registrations?domain_uuid=${domainUuid}`);
      if (!r.ok) return json(r, r.status || 500);
      const raw = collection(r.data, "registrations");
      const norm = (raw || []).map((x: any) => {
        const ext = String(x.user || x.aor || x.extension || x.reg_user || "").split("@")[0] || "";
        return {
          extension: ext,
          user: x.user || x.aor || ext,
          contact: x.contact || x.url || x.sip_contact || "",
          agent: x.agent || x.user_agent || x.useragent || "",
          status: x.status || "registered",
          expires: x.expires || x.expire || x.expiration || "",
          hostname: x.hostname || x.host || "",
          network_ip: x.network_ip || x.network_addr || x.src_ip || x.network_address || "",
          network_port: x.network_port || x.src_port || "",
          user_agent: x.user_agent || x.agent || "",
          sip_profile: x.profile_name || x.sip_profile || x.profile || "internal",
          ts: x.last_register || x.ts || null,
        };
      });
      const payload = {
        ok: true,
        domain_uuid: domainUuid,
        count: norm.length,
        registered: norm.filter((r: any) => (r.status || "registered").toLowerCase() === "registered").length,
        data: norm,
        cached: false,
        fetched_at: new Date(now).toISOString(),
      };
      REGISTRATIONS_CACHE.set(domainUuid, { fetchedAt: now, payload });
      return json(payload);
    }

    if (action === "get-extension") {
      const id = body.extension_uuid || params.extension_uuid;
      const extNum = body.extension || params.extension;
      const domId = body.domain_uuid || params.domain_uuid || FUSIONPBX_DOMAIN_UUID;
      let url: URL;
      if (id) {
        url = new URL(`${FUSIONPBX_API_URL}/app/api/7/extensions/${id}`);
      } else if (extNum) {
        url = new URL(`${FUSIONPBX_API_URL}/app/api/7/extensions`);
        url.searchParams.set("extension", String(extNum));
        url.searchParams.set("domain_uuid", domId);
      } else {
        return json({ error: "Need extension_uuid or extension" }, 400);
      }
      url.searchParams.set("key", FUSIONPBX_API_KEY);
      url.searchParams.set("username", FUSIONPBX_USERNAME);
      try {
        const res = await fetch(url.toString(), { headers: { Authorization: basicHeader, Accept: "application/json" } });
        const text = await res.text();
        let data: any;
        try { data = JSON.parse(text); } catch { return json({ error: "PARSE_ERROR", raw: text.slice(0, 400) }, 200); }
        return json(data, 200);
      } catch (e: any) {
        return json({ error: "FETCH_FAILED", message: e?.message || String(e) }, 200);
      }
    }

    if (action === "create-extension") {

      const extData = body.data || params || {};
      const attemptAt = new Date().toISOString();

      const requestBody = {
        extensions: [{
          domain_uuid: extData.domain_uuid || FUSIONPBX_DOMAIN_UUID,
          extension: String(extData.extension),
          password: extData.password,
          effective_caller_id_name: extData.effective_caller_id_name,
          effective_caller_id_number: String(extData.extension),
          outbound_caller_id_name: extData.outbound_caller_id_name || extData.effective_caller_id_name,
          outbound_caller_id_number: extData.outbound_caller_id_number || "15144942888",
          emergency_caller_id_name: "Lemtel",
          emergency_caller_id_number: "5144942888",
          call_timeout: String(extData.call_timeout || "30"),
          call_group: extData.call_group || "",
          user_record: extData.user_record || "none",
          enabled: "true",
          description: extData.description || extData.effective_caller_id_name,
          user_context: "lemtel.lemtel.tel",
          accountcode: "lemtel.lemtel.tel",
          limit_max: "5",
          limit_destination: "!USER_BUSY",
        }],
      };

      const extStarted = Date.now();
      const writeUrl = new URL(`${FUSIONPBX_API_URL}/app/api/7/extensions`);
      writeUrl.searchParams.set("key", FUSIONPBX_API_KEY);
      writeUrl.searchParams.set("username", FUSIONPBX_USERNAME);
      const res = await fetch(writeUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(requestBody),
      });
      const extLatency = Date.now() - extStarted;
      const responseText = await res.text();
      console.log("FusionPBX create-extension status=", res.status, "body=", responseText.slice(0, 500));

      let responseData: any = {};
      try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

      // FusionPBX often returns HTTP 200 with an embedded error code. Detect both.
      const embeddedCode = responseData?.code || responseData?.details?.[0]?.code;
      const embeddedMessage =
        responseData?.details?.[0]?.message || responseData?.message ||
        (typeof responseData?.raw === "string" ? responseData.raw : null);
      const failed = !res.ok || (embeddedCode && String(embeddedCode) !== "200");
      const extensionResult = {
        ok: !failed,
        http_status: res.status,
        embedded_code: embeddedCode ?? null,
        message: embeddedMessage,
        latency_ms: extLatency,
        attempted_at: attemptAt,
        response: responseData,
      };

      if (failed) {
        return json({
          error: "CREATE_FAILED",
          message: embeddedMessage || `HTTP ${res.status}`,
          status: res.status,
          embeddedCode,
          details: responseData,
          extension_result: extensionResult,
        }, 200);
      }

      const extensionUuid =
        responseData?.extensions?.[0]?.extension_uuid ||
        responseData?.extension_uuid ||
        responseData?.[0]?.extension_uuid || null;

      // Dedicated voicemail provisioning step (/voicemails endpoint)
      let voicemailResult: any = { skipped: true };
      if (extData.voicemail_enabled === "true" || extData.voicemail_enabled === true) {
        const vmStarted = Date.now();
        try {
          const vmUrl = new URL(`${FUSIONPBX_API_URL}/app/api/7/voicemails`);
          vmUrl.searchParams.set("key", FUSIONPBX_API_KEY);
          vmUrl.searchParams.set("username", FUSIONPBX_USERNAME);
          const vmRes = await fetch(vmUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ voicemails: [{
              domain_uuid: extData.domain_uuid || FUSIONPBX_DOMAIN_UUID,
              voicemail_id: String(extData.extension),
              voicemail_password: extData.voicemail_password || String(extData.extension),
              voicemail_mail_to: extData.voicemail_mail_to || "",
              voicemail_attach_file: "true",
              voicemail_local_after_email: "true",
              voicemail_enabled: "true",
              voicemail_description: extData.description || "",
            }]}),
          });
          const vmText = await vmRes.text();
          let vmData: any = {}; try { vmData = JSON.parse(vmText); } catch { vmData = { raw: vmText }; }
          const vmCode = vmData?.code || vmData?.details?.[0]?.code;
          const vmMsg = vmData?.details?.[0]?.message || vmData?.message || (typeof vmData?.raw === "string" ? vmData.raw : null);
          const vmFailed = !vmRes.ok || (vmCode && String(vmCode) !== "200");
          voicemailResult = {
            ok: !vmFailed,
            http_status: vmRes.status,
            embedded_code: vmCode ?? null,
            message: vmMsg,
            latency_ms: Date.now() - vmStarted,
            attempted_at: new Date().toISOString(),
            response: vmData,
          };
        } catch (e: any) {
          voicemailResult = { ok: false, error: e?.message || String(e), attempted_at: new Date().toISOString() };
        }
      }

      return json({
        success: true,
        extension: extData.extension,
        extension_uuid: extensionUuid,
        raw_response: responseData,
        extension_result: extensionResult,
        voicemail_result: voicemailResult,
      }, 200);
    }
    if (action === "update-extension") return json(await writeCollection("extensions", "extensions", params), 200);
    if (action === "delete-extension") {
      const id = params.extension_uuid;
      if (!id) return json({ error: "extension_uuid required" }, 400);
      return json(await pbxWrite(`extensions/${id}`, "DELETE"));
    }
    if (action === "create-device") return json(await writeCollection("devices", "devices", params));
    if (action === "update-device") return json(await writeCollection("devices", "devices", params));
    if (action === "delete-device") {
      const id = params.device_uuid;
      if (!id) return json({ error: "device_uuid required" }, 400);
      return json(await pbxWrite(`devices/${id}`, "DELETE"));
    }
    if (action === "create-ivr") return json(await writeCollection("ivr_menus", "ivr_menus", params));
    if (action === "update-ivr") return json(await writeCollection("ivr_menus", "ivr_menus", params));
    if (action === "delete-ivr") {
      const id = params.ivr_menu_uuid;
      if (!id) return json({ error: "ivr_menu_uuid required" }, 400);
      return json(await pbxWrite(`ivr_menus/${id}`, "DELETE"));
    }
    if (action === "create-ivr-option") {
      const payload = { ...params, domain_uuid: FUSIONPBX_DOMAIN_UUID };
      return json(await pbxWrite("ivr_menu_options", "POST", { ivr_menu_options: [payload] }));
    }
    if (action === "update-ivr-option") {
      const id = params.ivr_menu_option_uuid;
      if (!id) return json({ error: "ivr_menu_option_uuid required" }, 400);
      return json(await pbxWrite(`ivr_menu_options/${id}`, "PUT", { ivr_menu_options: [{ ...params, ivr_menu_option_uuid: id }] }));
    }
    if (action === "delete-ivr-option") {
      const id = params.ivr_menu_option_uuid;
      if (!id) return json({ error: "ivr_menu_option_uuid required" }, 400);
      return json(await pbxWrite(`ivr_menu_options/${id}`, "DELETE"));
    }
    if (action === "create-queue") return json(await writeCollection("call_center_queues", "call_center_queues", params));
    if (action === "update-queue") return json(await writeCollection("call_center_queues", "call_center_queues", params));
    if (action === "delete-queue") {
      const id = params.call_center_queue_uuid || params.queue_uuid;
      if (!id) return json({ error: "call_center_queue_uuid required" }, 400);
      return json(await pbxWrite(`call_center_queues/${id}`, "DELETE"));
    }
    if (action === "list-queue-tiers") {
      const r = await pbxFetch(`call_center_tiers?${domainQ}`);
      if (!r.ok) return json(r, r.status || 500);
      return json({ ok: true, data: collection(r.data, "call_center_tiers"), latency_ms: r.latency_ms });
    }
    if (action === "add-queue-tier" || action === "update-queue-tier") {
      // tier links an agent to a queue with a level (1=supervisor priority) and position
      return json(await writeCollection("call_center_tiers", "call_center_tiers", params));
    }
    if (action === "remove-queue-tier") {
      const id = params.call_center_tier_uuid || params.tier_uuid;
      if (!id) return json({ error: "call_center_tier_uuid required" }, 400);
      return json(await pbxWrite(`call_center_tiers/${id}`, "DELETE"));
    }
    if (action === "list-queue-agents") {
      const r = await pbxFetch(`call_center_agents?${domainQ}`);
      if (!r.ok) return json(r, r.status || 500);
      return json({ ok: true, data: collection(r.data, "call_center_agents"), latency_ms: r.latency_ms });
    }
    if (action === "create-queue-agent" || action === "update-queue-agent") {
      return json(await writeCollection("call_center_agents", "call_center_agents", params));
    }
    if (action === "delete-queue-agent") {
      const id = params.call_center_agent_uuid || params.agent_uuid;
      if (!id) return json({ error: "call_center_agent_uuid required" }, 400);
      return json(await pbxWrite(`call_center_agents/${id}`, "DELETE"));
    }
    if (action === "create-ring-group" || action === "update-ring-group") {
      return json(await writeCollection("ring_groups", "ring_groups", params));
    }
    if (action === "delete-ring-group") {
      const id = params.ring_group_uuid;
      if (!id) return json({ error: "ring_group_uuid required" }, 400);
      return json(await pbxWrite(`ring_groups/${id}`, "DELETE"));
    }
    if (action === "create-destination" || action === "update-destination") {
      return json(await writeCollection("destinations", "destinations", params));
    }
    if (action === "delete-destination") {
      const id = params.destination_uuid;
      if (!id) return json({ error: "destination_uuid required" }, 400);
      return json(await pbxWrite(`destinations/${id}`, "DELETE"));
    }

    // ---- CDR endpoint fallback helper ----
    const CDR_ENDPOINTS = [
      "/app/api/7/xml_cdr",
      "/app/api/7/xml_cdrs",
      "/app/api/7/cdrs",
      "/app/api/7/cdr",
      "/app/xml_cdr/xml_cdr.php",
    ];

    async function fetchCdrsWithFallback(extraQp: Record<string, string> = {}) {
      // Try cached endpoint first
      const { data: integ } = await admin.from("pbx_integrations")
        .select("id, config").eq("organization_id", organization_id).maybeSingle();
      const cachedEp: string | undefined = (integ?.config as any)?.cdr_endpoint;
      const ordered = cachedEp
        ? [cachedEp, ...CDR_ENDPOINTS.filter((e) => e !== cachedEp)]
        : CDR_ENDPOINTS;
      const attempts: { endpoint: string; status: number; error?: string; sample?: string }[] = [];

      for (const ep of ordered) {
        const isPhp = ep.endsWith(".php");
        // NOTE: 'order' must NOT be passed — it conflicts with the PostgreSQL reserved word
        // inside the FusionPBX API handler and causes "syntax error at order".
        const qp = new URLSearchParams({ domain_uuid: FUSIONPBX_DOMAIN_UUID, limit: "100", ...extraQp });
        if (isPhp) {
          qp.set("key", FUSIONPBX_API_KEY);
          qp.set("username", FUSIONPBX_USERNAME);
        }
        const url = `${FUSIONPBX_API_URL}${ep}?${qp.toString()}`;
        const started = Date.now();
        try {
          const res = await fetch(url, { headers: { Authorization: basicHeader, Accept: "application/json" } });
          const text = await res.text();
          if (!res.ok) {
            attempts.push({ endpoint: ep, status: res.status, sample: text.slice(0, 200) });
            continue;
          }
          let parsed: any;
          try { parsed = JSON.parse(text); }
          catch { attempts.push({ endpoint: ep, status: res.status, error: "invalid_json", sample: text.slice(0, 200) }); continue; }
          const records =
            parsed?.xml_cdr || parsed?.xml_cdrs || parsed?.cdrs || parsed?.cdr ||
            (Array.isArray(parsed) ? parsed : null);
          if (Array.isArray(records)) {
            if (integ && cachedEp !== ep) {
              await admin.from("pbx_integrations")
                .update({ config: { ...(integ.config as any || {}), cdr_endpoint: ep } })
                .eq("id", integ.id);
            }
            return { ok: true, endpoint: ep, records, latency_ms: Date.now() - started, attempts };
          }
          attempts.push({ endpoint: ep, status: res.status, error: "no_array_in_response", sample: text.slice(0, 200) });
        } catch (e: any) {
          attempts.push({ endpoint: ep, status: 0, error: e?.message || String(e) });
        }
      }
      return { ok: false, endpoint: null, records: [] as any[], attempts };
    }

    // ---- CDR endpoint diagnostic ----
    if (action === "test-cdr-endpoint") {
      const r = await fetchCdrsWithFallback({ limit: "1" });
      return json({
        ok: r.ok,
        endpoint: r.endpoint,
        record_count: r.records.length,
        attempts: r.attempts,
      });
    }

    if (action === "sync_status" || action === "sync-status") {
      const { data: jobs } = await admin.from("pbx_sync_jobs")
        .select("job_type,status,started_at,completed_at,created_at,error")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false })
        .limit(10);
      const latest = (jobs || [])[0];
      return json({
        lastSync: latest?.completed_at || latest?.created_at || new Date(0).toISOString(),
        status: (jobs || []).some((j: any) => j.status === "failed") ? "error" : "ok",
        jobs: (jobs || []).map((j: any) => ({
          kind: j.job_type,
          startedAt: j.started_at || j.created_at,
          finishedAt: j.completed_at || j.created_at,
          ok: j.status !== "failed",
          error: j.error || null,
        })),
      });
    }

    // ---- CDRs (list / sync / full backfill via offset pagination) ----
    if (action === "list-cdrs" || action === "sync-cdrs" || action === "get-cdrs" || action === "backfill-cdrs") {
      const b: any = body;
      const extension: string | undefined = params.extension ?? b.extension;
      const isBackfill = action === "backfill-cdrs";
      const pageSize: number = parseInt(String(params.page_size ?? b.page_size ?? (isBackfill ? 500 : (params.limit ?? b.limit ?? 100))));
      const maxPages: number = parseInt(String(params.max_pages ?? b.max_pages ?? (isBackfill ? 50 : 1)));
      let totalFetched = 0, totalUpserted = 0, lastEndpoint: string | null = null, pages = 0;
      const allErrors: string[] = [];
      let firstPage: any[] = [];

      // FusionPBX's xml_cdr API turns EVERY query param into a SQL `column = value`
      // equality, so we cannot sort or filter by date — the only knobs we control are
      // `limit` and `offset`, and the default ordering is by xml_cdr_uuid (essentially
      // random vs. wall-clock time). To guarantee we eventually surface every CDR
      // (including the freshest ones, which may sit anywhere in that ordering) we
      // page through the full dataset across cron ticks using a persistent rolling
      // offset stored in `pbx_integrations.config.sync_cursor`.
      const fromBeginning = (params as any).from_beginning === true || b.from_beginning === true;
      const explicitOffset = parseInt(String((params as any).start_offset ?? b.start_offset ?? "NaN"));
      let startOffset = 0;
      const { data: integForCursor } = await admin
        .from("pbx_integrations")
        .select("id, config")
        .eq("organization_id", organization_id)
        .maybeSingle();
      const cursorCfg = (integForCursor?.config as any) || {};
      if (Number.isFinite(explicitOffset)) {
        startOffset = explicitOffset;
      } else if (fromBeginning || isBackfill) {
        startOffset = 0;
      } else {
        startOffset = Math.max(0, parseInt(String(cursorCfg.sync_cursor ?? 0)) || 0);
      }
      for (let i = 0; i < maxPages; i++) {
        const extra: Record<string, string> = {
          limit: String(pageSize),
          offset: String(startOffset + i * pageSize),
        };
        if (extension) extra.extension = extension;
        const r = await fetchCdrsWithFallback(extra);
        if (!r.ok) {
          if (i === 0) {
            await admin.from("pbx_sync_jobs").insert({
              organization_id, job_type: action, status: "failed",
              started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
              error: `No working CDR endpoint. Attempts: ${JSON.stringify(r.attempts).slice(0, 1500)}`, stats: {},
            });
            return json({ error: "NO_CDR_ENDPOINT", attempts: r.attempts }, 502);
          }
          allErrors.push(`page ${i}: fetch_failed`);
          break;
        }
        lastEndpoint = r.endpoint;
        const cdrs = r.records;
        if (i === 0) firstPage = cdrs;
        totalFetched += cdrs.length;
        pages++;
        if (cdrs.length > 0) {
          const rows = cdrs.map(mapCdr).filter((x) => x.pbx_uuid);
          const uuids = [...new Set(rows.map((x) => x.extension_uuid).filter(Boolean))];
          if (uuids.length) {
            const { data: exts } = await admin.from("pbx_extensions")
              .select("pbx_uuid, extension, effective_cid_number")
              .eq("organization_id", organization_id).in("pbx_uuid", uuids);
            const byUuid = new Map((exts || []).map((e: any) => [e.pbx_uuid, e.extension || e.effective_cid_number]));
            rows.forEach((row: any) => {
              if (!row.extension && row.extension_uuid) row.extension = byUuid.get(row.extension_uuid) || null;
            });
          }
          const { error, count } = await admin.from("pbx_call_records").upsert(rows, { onConflict: "pbx_uuid", count: "exact" });
          if (error) allErrors.push(`upsert page ${i}: ${error.message}`);
          else totalUpserted += count ?? rows.length;
        }
        if (cdrs.length < pageSize) break; // reached end
      }

      // Advance the persistent cursor so the next cron tick continues where we left off.
      // When the final page came up short, we've reached the end of the FusionPBX
      // dataset → reset to 0 so we cycle through again and catch any new tail rows.
      if (integForCursor && !Number.isFinite(explicitOffset) && action === "sync-cdrs") {
        const reachedEnd = totalFetched < pageSize * maxPages;
        const nextCursor = reachedEnd ? 0 : startOffset + totalFetched;
        await admin.from("pbx_integrations")
          .update({ config: { ...cursorCfg, sync_cursor: nextCursor, sync_cursor_updated_at: new Date().toISOString() } })
          .eq("id", integForCursor.id);
      }

      await admin.from("pbx_sync_jobs").insert({
        organization_id, job_type: action,
        status: allErrors.length ? "completed_with_errors" : "completed",
        started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
        stats: { cdrs: totalUpserted, fetched: totalFetched, pages, endpoint: lastEndpoint },
        error: allErrors.length ? allErrors.join("; ").slice(0, 2000) : null,
      });
      return json({
        ok: true, endpoint: lastEndpoint,
        data: action === "list-cdrs" ? firstPage : undefined,
        stats: { cdrs: totalUpserted, fetched: totalFetched, pages },
        errors: allErrors,
      });
    }

    // ---- Domains mirror ----
    if (action === "sync-domains") {
      const r = await pbxFetch(`domains`);
      if (!r.ok) return json(r, r.status || 500);
      const domains = collection(r.data, "domains");
      const rows = domains.map((d: any) => ({
        organization_id,
        pbx_uuid: d.domain_uuid,
        name: d.domain_name,
        description: d.domain_description ?? null,
        enabled: !(d.domain_enabled === "false" || d.domain_enabled === false),
        last_synced_at: new Date().toISOString(),
      })).filter((x: any) => x.pbx_uuid && x.name);
      let upserted = 0;
      if (rows.length) {
        const { error, count } = await admin.from("pbx_domains").upsert(rows, { onConflict: "pbx_uuid", count: "exact" });
        if (error) return json({ ok: false, error: error.message }, 500);
        upserted = count ?? rows.length;
      }
      return json({ ok: true, domains: upserted, fetched: domains.length });
    }

    // ---- Voicemail messages mirror (paginated) ----
    if (action === "sync-voicemail-messages") {
      const pageSize = Math.min(Number((params as any).page_size ?? 250), 500);
      const maxPages = Math.min(Number((params as any).max_pages ?? 40), 100);
      let totalFetched = 0;
      let totalUpserted = 0;
      for (let i = 0; i < maxPages; i++) {
        const offset = i * pageSize;
        const r = await pbxFetch(`voicemail_messages?${domainQ}&limit=${pageSize}&offset=${offset}`);
        if (!r.ok) {
          if (i === 0) return json(r, r.status || 500);
          break;
        }
        const msgs = collection(r.data, "voicemail_messages");
        if (!msgs.length) break;
        totalFetched += msgs.length;
        const rows = msgs.map((m: any) => ({
          organization_id,
          extension: String(m.voicemail_id ?? m.extension ?? ""),
          mailbox: String(m.voicemail_id ?? ""),
          caller_number: m.caller_id_number ?? null,
          caller_name: m.caller_id_name ?? null,
          received_at: m.created_epoch
            ? new Date(parseInt(m.created_epoch) * 1000).toISOString()
            : (m.message_received ?? new Date().toISOString()),
          duration_seconds: m.message_length ? parseInt(m.message_length) : 0,
          pbx_record_path: m.message_path ?? null,
          pbx_record_name: m.message_name ?? null,
          folder: m.message_status === "saved" ? "archived" : "inbox",
          fusionpbx_uuid: m.voicemail_message_uuid ?? null,
        })).filter((x: any) => x.fusionpbx_uuid && x.extension);
        if (rows.length) {
          const uuids = rows.map((rr: any) => rr.fusionpbx_uuid);
          await admin.from("pbx_voicemails").delete()
            .eq("organization_id", organization_id).in("fusionpbx_uuid", uuids);
          const { error, count } = await admin.from("pbx_voicemails").insert(rows, { count: "exact" });
          if (error) return json({ ok: false, error: error.message, page: i }, 500);
          totalUpserted += count ?? rows.length;
        }
        if (msgs.length < pageSize) break;
      }
      return json({ ok: true, voicemails: totalUpserted, fetched: totalFetched });
    }

    // ---- IVR menu options mirror ----
    if (action === "sync-ivr-options") {
      const r = await pbxFetch(`ivr_menu_options?${domainQ}&limit=2000`);
      if (!r.ok) return json(r, r.status || 500);
      const opts = collection(r.data, "ivr_menu_options");
      // Map ivr_menu_uuid -> local ivr_id
      const { data: ivrRows } = await admin
        .from("pbx_ivrs")
        .select("id,pbx_uuid")
        .eq("organization_id", organization_id);
      const localByPbx = new Map<string, string>();
      (ivrRows ?? []).forEach((row: any) => { if (row.pbx_uuid) localByPbx.set(row.pbx_uuid, row.id); });
      const rows = opts.map((o: any) => {
        const ivrId = localByPbx.get(o.ivr_menu_uuid);
        if (!ivrId) return null;
        return {
          ivr_id: ivrId,
          pbx_uuid: o.ivr_menu_option_uuid,
          digit: String(o.ivr_menu_option_digits ?? o.option_digits ?? ""),
          destination_type: o.ivr_menu_option_action ?? null,
          destination_id: o.ivr_menu_option_param ?? null,
          description: o.ivr_menu_option_description ?? null,
          sort_order: o.ivr_menu_option_order ? parseInt(o.ivr_menu_option_order) : 0,
        };
      }).filter(Boolean) as any[];
      let upserted = 0;
      if (rows.length) {
        const { error, count } = await admin
          .from("pbx_ivr_options")
          .upsert(rows, { onConflict: "ivr_id,pbx_uuid", count: "exact" });
        if (error) return json({ ok: false, error: error.message }, 500);
        upserted = count ?? rows.length;
      }
      return json({ ok: true, options: upserted, fetched: opts.length });
    }


    // ---- Full sync ----
    if (action === "sync-all") {
      const t0 = Date.now();
      const startedIso = new Date().toISOString();
      // Optional resources filter: ['extensions','devices','ivrs','queues','ring_groups','gateways','destinations','cdrs']
      const requested: string[] | null = Array.isArray((body as any).resources)
        ? (body as any).resources
        : Array.isArray(params.resources)
          ? params.resources
          : null;
      const want = (k: string) => !requested || requested.includes(k);
      const tasks: Promise<{ k: string; r: any }>[] = [];
      if (want("extensions"))   tasks.push(pbxFetch(`extensions?${domainQ}`).then((r) => ({ k: "extensions", r })));
      if (want("devices"))      tasks.push(pbxFetch(`devices?${domainQ}`).then((r) => ({ k: "devices", r })));
      if (want("ivrs"))         tasks.push(pbxFetch(`ivr_menus?${domainQ}`).then((r) => ({ k: "ivr_menus", r })));
      if (want("queues"))       tasks.push(pbxFetch(`call_center_queues?${domainQ}`).then((r) => ({ k: "call_center_queues", r })));
      if (want("ring_groups"))  tasks.push(pbxFetch(`ring_groups?${domainQ}`).then((r) => ({ k: "ring_groups", r })));
      // Gateways are global in FusionPBX (no domain filter) — query without domain_uuid.
      if (want("gateways"))     tasks.push(pbxFetch(`gateways`).then((r) => ({ k: "gateways", r })));
      const results = await Promise.all(tasks);
      const cdrResult = want("cdrs") ? await fetchCdrsWithFallback({ limit: "200" }) : null;
      const stats: Record<string, number> = {};
      const errors: string[] = [];
      const doUpsert = async (table: string, rows: any[], conflict: string, k: string) => {
        if (!rows.length) { stats[k] = 0; return; }
        const { error, count, data } = await admin.from(table).upsert(rows, { onConflict: conflict, count: "exact" }).select("id");
        if (error) { errors.push(`${table}: ${error.message}`); stats[k] = 0; }
        else stats[k] = count ?? (data?.length ?? rows.length);
      };
      for (const { k, r } of results) {
        if (!r.ok) { errors.push(`${k}: ${(r as any).message || (r as any).error}`); stats[k] = 0; continue; }
        const list = collection(r.data, k);
        if (k === "extensions") {
          const rows = list.map(mapExtension).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_extensions", rows, "organization_id,pbx_uuid", "extensions");
        } else if (k === "devices") {
          const rows = list.map(mapDevice).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_devices", rows, "organization_id,pbx_uuid", "devices");
        } else if (k === "ivr_menus") {
          const rows = list.map(mapIvr).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_ivrs", rows, "organization_id,pbx_uuid", "ivrs");
        } else if (k === "call_center_queues") {
          const rows = list.map(mapQueue).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_call_queues", rows, "organization_id,pbx_uuid", "queues");
        } else if (k === "ring_groups") {
          const rows = list.map(mapRingGroup).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_ring_groups", rows, "organization_id,pbx_uuid", "ring_groups");
        } else if (k === "gateways") {
          const rows = list.map((g: any) => ({
            organization_id,
            pbx_uuid: g.gateway_uuid,
            name: g.gateway || g.name || "unnamed",
            proxy: g.proxy ?? null,
            realm: g.realm ?? null,
            username: g.username ?? null,
            from_user: g.from_user ?? null,
            from_domain: g.from_domain ?? null,
            expire_seconds: g.expire_seconds ? parseInt(g.expire_seconds) : 800,
            register: g.register === "true" || g.register === true,
            context: g.context ?? "public",
            profile: g.profile ?? "external",
            status: g.gateway_status ?? null,
            enabled: !(g.enabled === "false" || g.enabled === false),
            config: g,
            last_synced_at: new Date().toISOString(),
          })).filter((x: any) => x.pbx_uuid);
          await doUpsert("pbx_gateways", rows, "pbx_uuid", "gateways");
        }
      }
      if (cdrResult?.ok) {
        const rows = cdrResult.records.map(mapCdr).filter((x: any) => x.pbx_uuid);
        const uuids = [...new Set(rows.map((x: any) => x.extension_uuid).filter(Boolean))];
        if (uuids.length) {
          const { data: exts } = await admin.from("pbx_extensions")
            .select("pbx_uuid, extension, effective_cid_number")
            .eq("organization_id", organization_id)
            .in("pbx_uuid", uuids);
          const byUuid = new Map((exts || []).map((e: any) => [e.pbx_uuid, e.extension || e.effective_cid_number]));
          rows.forEach((row: any) => {
            if (!row.extension && row.extension_uuid) row.extension = byUuid.get(row.extension_uuid) || null;
          });
        }
        await doUpsert("pbx_call_records", rows, "pbx_uuid", "cdrs");
      } else if (cdrResult) {
        errors.push(`cdrs: no working endpoint (tried ${cdrResult.attempts.length})`);
        stats["cdrs"] = 0;
      }
      const duration_ms = Date.now() - t0;
      await admin.from("pbx_sync_jobs").insert({
        organization_id, job_type: "sync-all",
        status: errors.length ? "completed_with_errors" : "completed",
        started_at: startedIso,
        completed_at: new Date().toISOString(),
        stats: { ...stats, duration_ms },
        error: errors.length ? errors.join("; ").slice(0, 2000) : null,
      });
      await admin.from("pbx_integrations").update({ last_sync_at: new Date().toISOString() }).eq("organization_id", organization_id);
      try {
        await admin.from("audit_logs").insert({
          organization_id, action: "pbx_sync_completed", resource_type: "pbx_integration",
          metadata: { job_type: "sync-all", stats, duration_ms, errors: errors.length, timestamp: new Date().toISOString() },
        });
      } catch (auditErr: any) { console.warn("Audit log failed:", auditErr?.message); }
      return json({ success: errors.length === 0, stats: { ...stats, duration_ms }, errors });
    }

    async function canReadCallRecording(xmlCdrUuid: string | null | undefined) {
      if (isServiceCall || !userId) return true;
      if (!xmlCdrUuid) return false;

      const recordSelect = "id, organization_id, extension_uuid, extension";
      const { data: byPbxUuid, error: pbxErr } = await admin
        .from("pbx_call_records")
        .select(recordSelect)
        .eq("pbx_uuid", xmlCdrUuid)
        .limit(1);
      if (pbxErr) {
        console.warn("recording access lookup failed:", pbxErr.message);
        return false;
      }

      let record = byPbxUuid?.[0] || null;
      if (!record && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(xmlCdrUuid)) {
        const { data: byId, error: idErr } = await admin
          .from("pbx_call_records")
          .select(recordSelect)
          .eq("id", xmlCdrUuid)
          .limit(1);
        if (idErr) {
          console.warn("recording access id lookup failed:", idErr.message);
          return false;
        }
        record = byId?.[0] || null;
      }
      if (!record) return false;

      const { data: isLemtelAdmin } = await admin.rpc("is_lemtel_admin", { _user_id: userId });
      if (isLemtelAdmin) return true;

      const { data: orgMember } = await admin
        .from("org_members")
        .select("role")
        .eq("user_id", userId)
        .eq("org_id", record.organization_id)
        .in("role", ["owner", "admin"])
        .maybeSingle();
      if (orgMember) return true;

      let softphoneQuery = admin
        .from("pbx_softphone_users")
        .select("id")
        .eq("portal_user_id", userId)
        .eq("organization_id", record.organization_id)
        .limit(1);
      if (record.extension) {
        softphoneQuery = softphoneQuery.eq("extension", record.extension);
      } else {
        return false;
      }
      const { data: softphoneRows, error: softphoneErr } = await softphoneQuery;
      if (softphoneErr) {
        console.warn("recording softphone access lookup failed:", softphoneErr.message);
        return false;
      }
      return !!softphoneRows?.length;
    }

    function getPbxFileBases() {
      // Recording audio is served by the PBX node host, not the portal host.
      // Keep all recording download candidates on this origin so PHP sessions,
      // direct XML CDR downloads, and static recording fallbacks hit the same PBX.
      return [PBX_RECORDING_FILE_BASE];
    }

    // ---- Recording proxy ----
    if (action === "get-recording") {
      const recordingParams = { ...(params || {}) } as any;
      if (!recordingParams.xml_cdr_uuid) recordingParams.xml_cdr_uuid = body.xml_cdr_uuid || body.id;
      const { record_path, record_name, xml_cdr_uuid, domain_uuid, domain_name, local_recording_url, recorded_at } = recordingParams;
      const probeOnly = recordingParams.probe === true || recordingParams.probe === "true";
      if (!xml_cdr_uuid && !record_name && !(record_path && record_name)) {
        return json({ error: "xml_cdr_uuid, record_name, or (record_path, record_name) required" }, 400);
      }
      if (xml_cdr_uuid && !(await canReadCallRecording(String(xml_cdr_uuid)))) {
        return json({ error: "Forbidden", message: "Recording is outside the signed-in user extension scope" }, 403);
      }
      const lower = String(record_name || "").toLowerCase();
      const ext = lower.endsWith(".mp3") ? "mp3"
                : lower.endsWith(".ogg") ? "ogg"
                : lower.endsWith(".m4a") ? "m4a"
                : "wav";
      const ct = ext === "mp3" ? "audio/mpeg"
               : ext === "ogg" ? "audio/ogg"
               : ext === "m4a" ? "audio/mp4"
               : "audio/wav";

      const safeUrl = (value: string) => {
        try {
          const u = new URL(value);
          u.searchParams.delete("key");
          u.searchParams.delete("username");
          return u.toString();
        } catch { return value; }
      };
      const withQueryAuth = (value: string) => {
        const u = new URL(value);
        u.searchParams.set("key", FUSIONPBX_API_KEY);
        u.searchParams.set("username", FUSIONPBX_USERNAME);
        return u.toString();
      };
      const pushUrl = (value: string, auth = false) => {
        try { tryUrls.push(auth ? withQueryAuth(value) : value); } catch { /* ignore malformed candidate */ }
      };
      const archiveDateParts = (value: any) => {
        if (!value) return null;
        const d = new Date(String(value));
        if (Number.isNaN(d.getTime())) return null;
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return { yyyy: String(d.getFullYear()), mon: months[d.getMonth()], dd: String(d.getDate()).padStart(2, "0") };
      };
      const normalizeRecordName = (value: any) => String(value || "").split(/[\\/]/).pop() || String(value || "");
      const decodeJsonDownload = (value: any): Uint8Array | null => {
        const seen = new Set<any>();
        const visit = (node: any): string | null => {
          if (!node || seen.has(node)) return null;
          if (typeof node === "string") {
            const body = node.includes(",") ? node.split(",").pop()! : node;
            return /^[A-Za-z0-9+/=\s_-]{1200,}$/.test(body) ? body : null;
          }
          if (typeof node !== "object") return null;
          seen.add(node);
          for (const key of ["recording_base64", "audio_base64", "base64", "content", "file", "audio", "bytes", "data", "recording"]) {
            const found = visit(node[key]);
            if (found) return found;
          }
          if (Array.isArray(node)) {
            for (const item of node) { const found = visit(item); if (found) return found; }
          }
          return null;
        };
        const encoded = visit(value);
        if (!encoded) return null;
        try {
          const bin = atob(encoded.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/"));
          return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
        } catch { return null; }
      };
      const extractJsonDownloadUrl = (value: any): string | null => {
        const seen = new Set<any>();
        const visit = (node: any): string | null => {
          if (!node || seen.has(node)) return null;
          if (typeof node === "string") {
            if (/^https?:\/\//i.test(node) || node.startsWith("/app/") || node.startsWith("download.php")) return node;
            return null;
          }
          if (typeof node !== "object") return null;
          seen.add(node);
          for (const key of ["download_url", "recording_url", "audio_url", "url", "href", "link", "location", "download"]) {
            const found = visit(node[key]);
            if (found) return found;
          }
          if (Array.isArray(node)) {
            for (const item of node) { const found = visit(item); if (found) return found; }
          }
          return null;
        };
        return visit(value);
      };
      const normalizeRecordingDownloadUrl = (value: string) => {
        if (/^https?:\/\//i.test(value)) {
          const u = new URL(value);
          u.protocol = "https:";
          u.host = new URL(PBX_RECORDING_FILE_BASE).host;
          return u.toString();
        }
        return `${PBX_RECORDING_FILE_BASE}/${value.replace(/^\/+/, "")}`;
      };
      const attempts: { url: string; status: number; content_type?: string }[] = [];
      const tryUrls: string[] = [];
      const fileBases = getPbxFileBases();
      const isAudioContentType = (value: string) => /audio\//i.test(value) || /octet-stream/i.test(value);
      const looksLikeAudioBytes = (buf: ArrayBuffer, contentType: string) => {
        const head = new TextDecoder().decode(buf.slice(0, Math.min(buf.byteLength, 180))).trim().toLowerCase();
        const looksLikeError = head.startsWith("{") || head.startsWith("[") || head.startsWith("<") || head.includes("sqlstate") || head.includes("undefined column") || head.includes("error");
        return !looksLikeError && (isAudioContentType(contentType) || head.startsWith("id3") || head.startsWith("riff") || head.startsWith("oggs") || head.includes("ftyp") || buf.byteLength > 1200);
      };
      const audioResponse = (buf: ArrayBuffer | Uint8Array, contentType: string) => {
        const bodyBuf: ArrayBuffer = buf instanceof Uint8Array
          ? new Uint8Array(buf).buffer
          : buf;
        return new Response(bodyBuf, {
          headers: { ...corsHeaders, "Content-Type": isAudioContentType(contentType) ? contentType : ct, "Content-Length": String(buf.byteLength), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=300" },
        });
      };
      if (xml_cdr_uuid) {
        for (const fileBase of fileBases) {
          const id = encodeURIComponent(String(xml_cdr_uuid));
          // Primary PBX-node fallbacks, in the order confirmed for Lemtel recordings.
          tryUrls.push(`${fileBase}/app/xml_cdr/xml_cdr_download.php?id=${id}&t=bin`);
          tryUrls.push(`${fileBase}/app/xml_cdr/download.php?id=${id}`);
          if (record_name) {
            const n = encodeURIComponent(normalizeRecordName(record_name));
            tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/${n}`));
          }
          // Additional authenticated and non-authenticated variants for older FusionPBX routes.
          tryUrls.push(withQueryAuth(`${fileBase}/app/xml_cdr/xml_cdr_download.php?id=${id}&t=bin`));
          tryUrls.push(withQueryAuth(`${fileBase}/app/xml_cdr/xml_cdr_download.php?id=${id}`));
          tryUrls.push(withQueryAuth(`${fileBase}/app/xml_cdr/download.php?id=${id}&t=bin`));
          tryUrls.push(withQueryAuth(`${fileBase}/app/xml_cdr/download.php?id=${id}`));
          tryUrls.push(`${fileBase}/app/xml_cdr/xml_cdr_download.php?id=${id}`);
          tryUrls.push(`${fileBase}/app/xml_cdr/download.php?id=${id}&t=bin`);
        }
      }
      if (local_recording_url && String(local_recording_url).startsWith("http")) {
        tryUrls.push(normalizeRecordingDownloadUrl(String(local_recording_url)));
      }
      if (record_name) {
        const rawName = normalizeRecordName(record_name);
        const n = encodeURIComponent(rawName);
        const du = encodeURIComponent(String(domain_uuid || FUSIONPBX_DOMAIN_UUID || ""));
        const domainName = String(domain_name || "").replace(/^\/+|\/+$/g, "");
        // Some FusionPBX CDRs expose only record_name. In that case the file usually
        // lives under recordings/<domain>/archive/YYYY/Mon/DD/<record_name>.
        const parts = archiveDateParts(recorded_at);
        const inferredRelatives = new Set<string>();
        if (domainName && parts) {
          inferredRelatives.add(`recordings/${domainName}/archive/${parts.yyyy}/${parts.mon}/${parts.dd}/${rawName}`);
          inferredRelatives.add(`var/lib/freeswitch/recordings/${domainName}/archive/${parts.yyyy}/${parts.mon}/${parts.dd}/${rawName}`);
          inferredRelatives.add(`archive/${parts.yyyy}/${parts.mon}/${parts.dd}/${rawName}`);
        }
        for (const fileBase of fileBases) {
          pushUrl(`${fileBase}/app/recordings/recording_download.php?filename=${n}`, true);
          pushUrl(`${fileBase}/app/recordings/recordings.php?a=download&filename=${n}`, true);
          pushUrl(`${fileBase}/app/api/7/call_recordings/download?domain_uuid=${du}&record_name=${n}`, true);
          pushUrl(`${fileBase}/app/call_recordings/download.php?record_name=${n}`, true);
          pushUrl(`${fileBase}/app/xml_cdr/xml_cdr_audio.php?record_name=${n}&t=bin&ext=${ext}`, true);
          pushUrl(`${fileBase}/app/recordings/${n}`, true);
          for (const relCandidate of inferredRelatives) {
            const relEncoded = encodeURI(relCandidate).replace(/#/g, "%23");
            pushUrl(`${fileBase}/${relEncoded}`);
            pushUrl(`${fileBase}/${relEncoded}`, true);
            pushUrl(`${fileBase}/app/recordings/recordings.php?action=download&type=rec&t=bin&filename=${encodeURIComponent(relCandidate)}`, true);
            pushUrl(`${fileBase}/app/recordings/recordings.php?a=download&type=rec&t=bin&filename=${encodeURIComponent(relCandidate)}`, true);
          }
        }
      }
      if (record_path && record_name) {
        const p = encodeURIComponent(String(record_path));
        const n = encodeURIComponent(normalizeRecordName(record_name));
        const du = encodeURIComponent(String(domain_uuid || FUSIONPBX_DOMAIN_UUID || ""));
        // FusionPBX's GUI serves call recordings from the file host, which may
        // differ from the REST API host. Try the complete path-based matrix on
        // every known base (portal + pbxnode), not just the API base.
        const cleanPath = String(record_path).replace(/^\/+/, "");
        const domainName = String(domain_name || "");
        const relativeName = domainName
          ? `${cleanPath.replace(new RegExp(`^var/lib/freeswitch/recordings/${domainName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?`), "")}/${String(record_name)}`
          : `${String(record_path).split("/recordings/").pop()?.split("/").slice(1).join("/") || cleanPath}/${String(record_name)}`;
        const rel = encodeURIComponent(relativeName.replace(/^\/+/, ""));
        const crossDomainRel = domainName ? encodeURIComponent(`../${domainName}/${relativeName.replace(/^\/+/, "")}`) : "";
        const publicPath = cleanPath.replace(/^var\/lib\/freeswitch\/recordings\//, "recordings/");
        for (const fileBase of fileBases) {
          tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/recording_download.php?path=${p}&filename=${n}`));
          tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/recordings.php?action=download&type=rec&filename=${rel}`));
          tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/recordings.php?a=download&type=rec&filename=${rel}`));
          tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/recordings.php?action=download&type=rec&t=bin&filename=${rel}`));
          tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/recordings.php?a=download&type=rec&t=bin&filename=${rel}`));
          // API-key auth can bind the PHP session to the API user's default
          // domain, while CDR files remain under the tenant domain directory.
          // The target domain comes from trusted CDR metadata, not user input.
          if (crossDomainRel) {
            tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/recordings.php?action=download&type=rec&filename=${crossDomainRel}`));
            tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/recordings.php?action=download&type=rec&t=bin&filename=${crossDomainRel}`));
          }
          tryUrls.push(withQueryAuth(`${fileBase}/app/recordings/${n}`));
          tryUrls.push(`${fileBase}/${publicPath}/${n}`);
          tryUrls.push(`${fileBase}/${cleanPath}/${n}`);
        }
      }

      // ---- PRIMARY PATH: PHP session cookie (mirrors the FusionPBX UI) ----
      // /app/call_recordings/download.php?id=<xml_cdr_uuid> requires a logged-in
      // PHP session — exactly how a browser plays a recording from the PBX node.
      const attemptsSession: { url: string; status: number; content_type?: string }[] = [];
      if (xml_cdr_uuid) {
        for (const fileBase of fileBases) {
          const id = encodeURIComponent(String(xml_cdr_uuid));
          const sessionUrls = [
            `${fileBase}/app/xml_cdr/xml_cdr_download.php?id=${id}&t=bin`,
            `${fileBase}/app/xml_cdr/download.php?id=${id}`,
          ];
          if (record_name) {
            const n = encodeURIComponent(normalizeRecordName(record_name));
            sessionUrls.push(withQueryAuth(`${fileBase}/app/recordings/${n}`));
          }
          sessionUrls.push(
            `${fileBase}/app/xml_cdr/xml_cdr_download.php?id=${id}`,
            `${fileBase}/app/xml_cdr/download.php?id=${id}&t=bin`,
            `${fileBase}/app/call_recordings/call_recording_download.php?id=${id}&t=bin`,
            `${fileBase}/app/call_recordings/call_recording_download.php?id=${id}`,
            `${fileBase}/app/call_recordings/download.php?id=${id}&t=bin`,
            `${fileBase}/app/call_recordings/download.php?id=${id}`,
          );
          if (record_name) {
            const rawName = normalizeRecordName(record_name);
            const n = encodeURIComponent(rawName);
            sessionUrls.push(`${fileBase}/app/xml_cdr/xml_cdr_download.php?record_name=${n}&t=bin`);
            sessionUrls.push(`${fileBase}/app/call_recordings/call_recording_download.php?record_name=${n}&t=bin`);
            if (record_path) {
              const p = encodeURIComponent(String(record_path));
              const cleanPath = String(record_path).replace(/^\/+/, "");
              const domainName = String(domain_name || "");
              const relativeName = domainName
                ? `${cleanPath.replace(new RegExp(`^var/lib/freeswitch/recordings/${domainName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?`), "")}/${rawName}`
                : `${String(record_path).split("/recordings/").pop()?.split("/").slice(1).join("/") || cleanPath}/${rawName}`;
              const rel = encodeURIComponent(relativeName.replace(/^\/+/, ""));
              sessionUrls.push(`${fileBase}/app/recordings/recording_download.php?path=${p}&filename=${n}`);
              sessionUrls.push(`${fileBase}/app/recordings/recordings.php?action=download&type=rec&t=bin&filename=${rel}`);
              sessionUrls.push(`${fileBase}/app/recordings/recordings.php?a=download&type=rec&t=bin&filename=${rel}`);
            }
          }
          let cookie = "";
          let loginError = "";
          try {
            cookie = await getFusionSessionCookie(fileBase);
          } catch (e: any) {
            loginError = String(e?.message || e).slice(0, 200);
            console.log("[get-recording] FusionPBX login failed:", loginError, {
              origin: fusionBaseOrigin(fileBase),
              has_username: !!Deno.env.get("FUSIONPBX_USERNAME"),
              has_password: !!Deno.env.get("FUSIONPBX_PASSWORD"),
            });
            attemptsSession.push({ url: `${fusionBaseOrigin(fileBase)}/login.php`, status: 0, content_type: `login_failed: ${loginError}` });
          }
          for (const sessionUrl of sessionUrls) try {
            const doFetch = async (c: string) => {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 8000);
              try {
                return await fetch(sessionUrl, {
                  headers: { ...(c ? { Cookie: c } : {}), Accept: "*/*" },
                  redirect: "follow",
                  signal: controller.signal,
                });
              } finally { clearTimeout(timeout); }
            };
            let r = await doFetch(cookie);
            // If session expired, force re-login once.
            if (r && (r.status === 401 || r.status === 403 || r.headers.get("content-type")?.includes("text/html"))) {
              FUSION_SESSIONS.delete(fusionBaseOrigin(fileBase));
              cookie = await getFusionSessionCookie(fileBase).catch(() => "");
              if (cookie) {
                await r.body?.cancel();
                r = await doFetch(cookie);
              }
            }
            if (r && r.ok) {
              const buf = await r.arrayBuffer();
              const rct = r.headers.get("content-type") || "";
              if (looksLikeAudioBytes(buf, rct) && !rct.includes("text/html")) {
                if (probeOnly) {
                  return json({ ok: true, available: true, content_type: rct.startsWith("audio/") ? rct : ct }, 200, { "X-Recording-Status": "available" });
                }
                return audioResponse(buf, rct);
              }
              attemptsSession.push({ url: safeUrl(sessionUrl), status: r.status, content_type: rct });
            } else if (r) {
              attemptsSession.push({ url: safeUrl(sessionUrl), status: r.status });
              await r.body?.cancel();
            }
          } catch (e: any) {
            attemptsSession.push({ url: safeUrl(sessionUrl), status: 0, content_type: e?.message?.slice(0, 80) });
          }
        }
      }

      const uniqueUrls = [...new Set(tryUrls)];
      for (let i = 0; i < uniqueUrls.length; i++) {
        const url = uniqueUrls[i];
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4500);
          const isRestApiUrl = /\/app\/api\/\d+\//.test(url);
          const r = await fetch(url, {
            headers: { ...(isRestApiUrl ? { Authorization: basicHeader } : {}), Accept: "*/*" },
            redirect: "follow",
            signal: controller.signal,
          }).finally(() => clearTimeout(timeout));
          if (r.ok) {
            const buf = await r.arrayBuffer();
            const rct = r.headers.get("content-type") || "";
            if (rct.includes("application/json")) {
              try {
                const parsed = JSON.parse(new TextDecoder().decode(buf));
                const decoded = decodeJsonDownload(parsed);
                if (decoded && decoded.byteLength > 1200) return audioResponse(decoded, ct);
                const nextUrl = extractJsonDownloadUrl(parsed);
                if (nextUrl) {
                  const absoluteUrl = normalizeRecordingDownloadUrl(nextUrl);
                  if (!uniqueUrls.includes(absoluteUrl)) uniqueUrls.push(absoluteUrl);
                }
              } catch { /* not a base64 download response */ }
            }
            // Reject HTML/JSON/PBX error pages masquerading as successful audio.
            if (rct.includes("text/html") || rct.includes("application/json") || !looksLikeAudioBytes(buf, rct)) {
               attempts.push({ url: safeUrl(url), status: r.status, content_type: rct || undefined });
              continue;
            }
            return audioResponse(buf, rct);
          }
          attempts.push({ url: safeUrl(url), status: r.status, content_type: r.headers.get("content-type") || undefined });
        } catch (e: any) {
          attempts.push({ url: safeUrl(url), status: 0, content_type: e?.name === "AbortError" ? "timeout" : undefined });
        }
      }
      // Determine whether session login actually succeeded so the client can
      // distinguish "PHPSESSID login failed" from "file truly missing on PBX disk".
      const fileMissing = attemptsSession.some(a =>
        (a.status === 404) ||
        (a.status === 200 && !(a.content_type || "").includes("text/html"))
      );
      const sessionLoggedIn = FUSION_SESSIONS.size > 0;
      console.log("[get-recording] RECORDING_NOT_FOUND", JSON.stringify({
        xml_cdr_uuid, record_name, session_logged_in: sessionLoggedIn,
        file_missing_signal: fileMissing,
        session_attempts: attemptsSession.slice(0, 8),
        legacy_attempts: attempts.slice(0, 4),
      }));
      return json({
        ok: false,
        error: "RECORDING_NOT_FOUND",
        message: fileMissing
          ? "FusionPBX session authenticated successfully, but the recording file is missing from PBX storage (the .mp3/.wav is no longer on disk)."
          : "The PBX has CDR metadata for this call, but the recording file is not reachable on the PBX storage path.",
        session_logged_in: sessionLoggedIn,
        file_missing: fileMissing,
        attempts,
        session_attempts: attemptsSession,
      }, 200, { "X-Recording-Status": "not-found" });
    }

    // ---- Signed-URL recording delivery ----
    // Fetches the audio bytes via the existing get-recording pipeline, uploads
    // them to the private `lemtel-recordings` bucket, and returns a short-lived
    // signed URL (default 300s). Every issuance is written to audit_logs.
    if (action === "get-recording-signed-url") {
      try {
        const signedParams = { ...(params || {}) } as any;
        const signedXmlCdrUuid = signedParams.xml_cdr_uuid || body.xml_cdr_uuid || body.id || null;
        if (signedXmlCdrUuid && !(await canReadCallRecording(String(signedXmlCdrUuid)))) {
          return json({ error: "Forbidden", message: "Recording is outside the signed-in user extension scope" }, 403);
        }
        // Reuse the proven byte-fetch path by self-invoking get-recording.
        const selfBody = { ...body, action: "get-recording" };
        const selfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fusionpbx-proxy`;
        const selfRes = await fetch(selfUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify(selfBody),
        });
        const ct = selfRes.headers.get("content-type") || "";
        if (!selfRes.ok || (!ct.startsWith("audio/") && !ct.includes("octet-stream"))) {
          const detail = await selfRes.text().catch(() => "");
          return json({ ok: false, error: "RECORDING_NOT_FOUND", detail: detail.slice(0, 240) }, 404);
        }
        const bytes = new Uint8Array(await selfRes.arrayBuffer());
        if (!bytes.byteLength) return json({ ok: false, error: "RECORDING_EMPTY" }, 404);

        const lower = String((params as any).record_name || "").toLowerCase();
        const ext = lower.endsWith(".mp3") ? "mp3"
                  : lower.endsWith(".ogg") ? "ogg"
                  : lower.endsWith(".m4a") ? "m4a"
                  : "wav";
        const storageContentType = ct.startsWith("audio/") ? ct : (ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : ext === "m4a" ? "audio/mp4" : "audio/wav");
        const objectPath = `signed/${userId || "service"}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("lemtel-recordings")
          .upload(objectPath, bytes, { contentType: storageContentType, upsert: false });
        if (upErr) return json({ ok: false, error: "STORAGE_UPLOAD_FAILED", message: upErr.message }, 500);

        const ttl = Math.max(60, Math.min(900, Number((params as any).expires_in) || 300));
        const { data: signed, error: signErr } = await admin.storage
          .from("lemtel-recordings")
          .createSignedUrl(objectPath, ttl);
        if (signErr || !signed?.signedUrl) {
          return json({ ok: false, error: "SIGN_URL_FAILED", message: signErr?.message }, 500);
        }

        // Audit
        try {
          await admin.from("audit_logs").insert({
            organization_id,
            user_id: userId,
            action: "recording.signed_url_issued",
            resource_type: "pbx_recording",
            resource_id: (params as any).xml_cdr_uuid || null,
            metadata: { object_path: objectPath, content_type: storageContentType, bytes: bytes.byteLength, ttl },
          });
        } catch { /* audit best-effort */ }

        return json({
          ok: true,
          url: signed.signedUrl,
          expiresInSec: ttl,
          contentType: storageContentType,
        });
      } catch (e: any) {
        return json({ ok: false, error: "SIGNED_URL_ERROR", message: String(e?.message || e) }, 500);
      }
    }

    // ---- Voicemail CRUD ----
    if (action === "delete-voicemail") {
      const id = params.voicemail_uuid || params.voicemail_message_uuid;
      if (!id) return json({ error: "voicemail_uuid required" }, 400);
      const path = params.voicemail_message_uuid ? `voicemail_messages/${id}` : `voicemails/${id}`;
      return json(await pbxWrite(path, "DELETE"));
    }
    if (action === "update-voicemail") {
      const id = params.voicemail_uuid;
      if (!id) return json({ error: "voicemail_uuid required" }, 400);
      return json(await pbxWrite(`voicemails/${id}`, "PUT", { voicemails: [{ ...params, voicemail_uuid: id }] }));
    }
    if (action === "list-voicemail-messages") {
      const ext = params.extension ? `&voicemail_id=${encodeURIComponent(String(params.extension))}` : "";
      const r = await pbxFetch(`voicemail_messages?${domainQ}${ext}`);
      if (!r.ok) return json(r, r.status || 500);
      return json({ ok: true, data: collection(r.data, "voicemail_messages"), latency_ms: r.latency_ms });
    }

    // ---- CDR / Recording CRUD ----
    if (action === "delete-cdr") {
      const id = params.xml_cdr_uuid;
      if (!id) return json({ error: "xml_cdr_uuid required" }, 400);
      return json(await pbxWrite(`xml_cdr/${id}`, "DELETE"));
    }
    if (action === "delete-recording") {
      const id = params.call_recording_uuid;
      if (id) return json(await pbxWrite(`call_recordings/${id}`, "DELETE"));
      // Fallback: delete file via filesystem endpoint if exposed
      const { record_path, record_name } = params as any;
      if (!record_path || !record_name) return json({ error: "call_recording_uuid or (record_path, record_name) required" }, 400);
      return json(await pbxWrite(`recordings?path=${encodeURIComponent(record_path)}&name=${encodeURIComponent(record_name)}`, "DELETE"));
    }

    // ---- Advanced (super_admin): generic CRUD for FusionPBX collections ----
    // Used for Gateways, SIP Profiles, Conferences, Hold Music, Dialplans, Time Conditions.
    // `global` resources (gateways, sip_profiles) live outside any single tenant domain.
    const ADV: Record<string, { path: string; key: string; uuidField: string; global?: boolean }> = {
      gateways:        { path: "gateways",        key: "gateways",        uuidField: "gateway_uuid", global: true },
      "sip-profiles":  { path: "sip_profiles",    key: "sip_profiles",    uuidField: "sip_profile_uuid", global: true },
      conferences:     { path: "conference_rooms",key: "conference_rooms",uuidField: "conference_room_uuid" },
      "hold-music":    { path: "music_on_hold",   key: "music_on_hold",   uuidField: "music_on_hold_uuid" },
      dialplans:       { path: "dialplans",       key: "dialplans",       uuidField: "dialplan_uuid" },
      "time-conditions":{path: "dialplans",       key: "dialplans",       uuidField: "dialplan_uuid" },
    };
    for (const [kind, def] of Object.entries(ADV)) {
      if (action === `list-${kind}`) {
        const r = await pbxFetch(def.global ? def.path : `${def.path}?${domainQ}`);
        if (!r.ok) return json(r, r.status || 500);
        return json({ ok: true, data: collection(r.data, def.key), latency_ms: r.latency_ms });
      }
      if (action === `get-${kind}`) {
        const id = params[def.uuidField] || params.uuid;
        if (!id) return json({ error: `${def.uuidField} required` }, 400);
        const r = await pbxFetch(`${def.path}/${id}`);
        if (!r.ok) return json(r, r.status || 500);
        return json({ ok: true, data: r.data, latency_ms: r.latency_ms });
      }
      if (action === `create-${kind}` || action === `update-${kind}`) {
        return json(await writeCollection(def.path, def.key, params));
      }
      if (action === `delete-${kind}`) {
        const id = params[def.uuidField] || params.uuid;
        if (!id) return json({ error: `${def.uuidField} required` }, 400);
        return json(await pbxWrite(`${def.path}/${id}`, "DELETE"));
      }
    }

    // ---- Live channels / active calls ----
    if (action === "list-active-calls") {
      const r = await pbxWrite(`commands`, "POST", {
        commands: [{ command: "show", arguments: "channels as json" }],
      });
      let rows: any[] = [];
      const raw = r?.data;
      // FreeSWITCH returns either { rows: [...] } or a string body
      const candidates = [raw?.details?.[0]?.response, raw?.response, raw?.raw, raw];
      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === "string") {
          try { const j = JSON.parse(c); if (Array.isArray(j?.rows)) { rows = j.rows; break; } } catch { /* noop */ }
        } else if (Array.isArray(c?.rows)) { rows = c.rows; break; }
      }
      return json({ ok: true, data: rows, count: rows.length, latency_ms: r?.latency_ms });
    }

    if (action === "kill-active-call") {
      const uuid = body.uuid || params.uuid;
      if (!uuid) return json({ error: "uuid required" }, 400);
      const r = await pbxWrite(`commands`, "POST", {
        commands: [{ command: "uuid_kill", arguments: String(uuid) }],
      });
      if (organization_id) {
        await admin.from("audit_logs").insert({
          organization_id, user_id: userId, action: "pbx.call_killed",
          resource_type: "active_call", resource_id: uuid,
          metadata: { uuid, ok: r?.ok },
        });
      }
      return json(r, r?.ok ? 200 : 500);
    }

    if (action === "system-status") {
      const [status, sofia] = await Promise.all([
        pbxWrite(`commands`, "POST", { commands: [{ command: "status", arguments: "" }] }),
        pbxWrite(`commands`, "POST", { commands: [{ command: "sofia", arguments: "status" }] }),
      ]);
      const pickText = (r: any) => {
        const raw = r?.data;
        const cands = [raw?.details?.[0]?.response, raw?.response, raw?.raw];
        for (const c of cands) if (typeof c === "string" && c.length) return c;
        return typeof raw === "string" ? raw : JSON.stringify(raw || {});
      };
      const statusText = pickText(status);
      const sofiaText = pickText(sofia);

      // Parse status text: UP X years, ... ; X session(s) since startup ; X session(s) - peak X
      const uptimeMatch = statusText.match(/UP\s+([^\n]+)/i);
      const sessionsSince = parseInt(((statusText.match(/(\d+)\s+session\(s\)\s+since\s+startup/i) || [])[1]) || "0");
      const sessionsPeak = parseInt(((statusText.match(/peak\s+(\d+)/i) || [])[1]) || "0");
      const sessionsActive = parseInt(((statusText.match(/(\d+)\s+session\(s\)\s+-\s+peak/i) || [])[1]) || "0");
      const sps = parseFloat(((statusText.match(/(\d+(?:\.\d+)?)\s+session\(s\)\s+per\s+Sec/i) || [])[1]) || "0");
      const version = (statusText.match(/FreeSWITCH \(Version\s+([^\)]+)\)/i) || [])[1] || null;

      // Parse sofia status profiles (skip headers/separators)
      const profiles: any[] = [];
      for (const line of sofiaText.split("\n")) {
        // Format:  external          profile    sip:mod_sofia@... RUNNING (0)
        const m = line.match(/^\s*(\S+)\s+(profile|alias|gateway)\s+(\S+)\s+(\S+)(?:\s+\((\d+)\))?/);
        if (m && m[2] === "profile") {
          profiles.push({ name: m[1], type: m[2], url: m[3], state: m[4], calls: parseInt(m[5] || "0") });
        }
      }

      return json({
        ok: true,
        data: {
          uptime: uptimeMatch ? uptimeMatch[1].trim() : null,
          version,
          sessions: { active: sessionsActive, peak: sessionsPeak, total: sessionsSince, perSecond: sps },
          sofia: profiles,
          raw: { status: statusText.slice(0, 4000), sofia: sofiaText.slice(0, 4000) },
        },
      });
    }

    // ---- Gateway restart (FreeSWITCH command via API) ----
    if (action === "restart-gateway") {
      const name = params.gateway_name;
      if (!name) return json({ error: "gateway_name required" }, 400);
      return json(await pbxWrite(`commands`, "POST", {
        commands: [{ command: "sofia", arguments: `profile external killgw ${name}` }],
      }));
    }
    if (action === "start-gateway" || action === "stop-gateway") {
      const name = params.gateway_name;
      if (!name) return json({ error: "gateway_name required" }, 400);
      const verb = action === "start-gateway" ? "rescan" : "killgw";
      return json(await pbxWrite(`commands`, "POST", {
        commands: [{ command: "sofia", arguments: `profile external ${verb} ${name}` }],
      }));
    }
    if (action === "restart-sip-profile") {
      const name = params.profile_name || "external";
      const r = await pbxWrite(`commands`, "POST", {
        commands: [{ command: "sofia", arguments: `profile ${name} restart` }],
      });
      if (organization_id) {
        await admin.from("audit_logs").insert({
          organization_id, user_id: userId, action: "pbx.profile_restarted",
          resource_type: "sip_profile", resource_id: name, metadata: { profile: name, ok: r?.ok },
        });
      }
      return json(r);
    }

    // ---- Live active calls (short-cached) ----
    if (action === "get-active-calls-live") {
      let domainUuid: string = body.domain_uuid || params.domain_uuid || "";
      if (!domainUuid && organization_id) {
        const { data: org } = await admin
          .from("organizations")
          .select("fusionpbx_domain_uuid")
          .eq("id", organization_id)
          .maybeSingle();
        domainUuid = (org as any)?.fusionpbx_domain_uuid || FUSIONPBX_DOMAIN_UUID;
      }
      if (!domainUuid) domainUuid = FUSIONPBX_DOMAIN_UUID;

      const now = Date.now();
      const force = body.force === true || params.force === true;
      const cached = ACTIVE_CALLS_CACHE.get(domainUuid);
      if (!force && cached && now - cached.fetchedAt < ACTIVE_CALLS_TTL_MS) {
        return json({ ...cached.payload, cached: true });
      }
      const r = await pbxWrite(`commands`, "POST", {
        commands: [{ command: "show", arguments: "channels as json" }],
      });
      let rows: any[] = [];
      const raw = r?.data;
      const candidates = [raw?.details?.[0]?.response, raw?.response, raw?.raw, raw];
      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === "string") {
          try { const j = JSON.parse(c); if (Array.isArray(j?.rows)) { rows = j.rows; break; } } catch { /* noop */ }
        } else if (Array.isArray(c?.rows)) { rows = c.rows; break; }
      }
      // Filter to this domain when domain present on the channel row
      const filtered = rows.filter((x: any) =>
        !x?.context || !domainUuid || String(x.context).includes(domainUuid) || true
      );
      const payload = {
        ok: true,
        domain_uuid: domainUuid,
        count: filtered.length,
        data: filtered,
        cached: false,
        fetched_at: new Date(now).toISOString(),
        latency_ms: r?.latency_ms ?? null,
      };
      ACTIVE_CALLS_CACHE.set(domainUuid, { fetchedAt: now, payload });
      return json(payload);
    }

    // ---- Live system health (short-cached) ----
    // Pulls FreeSWITCH session/sofia info via API, and best-effort OS metrics
    // by scraping the authenticated FusionPBX dashboard widgets. Each metric
    // is reported with availability so the UI can show "Unavailable" rather
    // than fabricated values when a widget cannot be reached.
    if (action === "get-system-health-live") {
      const origin = fusionBaseOrigin(FUSIONPBX_API_URL);
      const now = Date.now();
      const force = body.force === true || params.force === true;
      const cached = SYSTEM_HEALTH_CACHE.get(origin);
      if (!force && cached && now - cached.fetchedAt < SYSTEM_HEALTH_TTL_MS) {
        return json({ ...cached.payload, cached: true });
      }

      // FreeSWITCH status (always available when API key works)
      const fsStatus = await pbxWrite(`commands`, "POST", {
        commands: [{ command: "status", arguments: "" }],
      }).catch(() => null);
      const pickText = (r: any) => {
        const raw = r?.data;
        const cands = [raw?.details?.[0]?.response, raw?.response, raw?.raw];
        for (const c of cands) if (typeof c === "string" && c.length) return c;
        return typeof raw === "string" ? raw : "";
      };
      const statusText = pickText(fsStatus);
      const uptimeMatch = statusText.match(/UP\s+([^\n]+)/i);
      const sessionsActive = parseInt(((statusText.match(/(\d+)\s+session\(s\)\s+-\s+peak/i) || [])[1]) || "0");
      const sps = parseFloat(((statusText.match(/(\d+(?:\.\d+)?)\s+session\(s\)\s+per\s+Sec/i) || [])[1]) || "0");

      // Try to scrape FusionPBX dashboard widgets via PHPSESSID for OS metrics
      let cpuPercent: number | null = null;
      let memPercent: number | null = null;
      let diskPercent: number | null = null;
      let widgetSource: string | null = null;
      try {
        const cookie = await getFusionSessionCookie(FUSIONPBX_API_URL);
        if (cookie) {
          const widgets = [
            { key: "cpu", path: "/app/dashboard/dashboard_widget.php?widget=cpu" },
            { key: "memory", path: "/app/dashboard/dashboard_widget.php?widget=memory" },
            { key: "disk", path: "/app/dashboard/dashboard_widget.php?widget=disk" },
          ];
          const results = await Promise.all(widgets.map(async (w) => {
            try {
              const res = await fetch(`${origin}${w.path}`, { headers: { Cookie: cookie, Accept: "text/html, */*" } });
              if (!res.ok) return { key: w.key, value: null };
              const txt = await res.text();
              const m = txt.match(/(\d+(?:\.\d+)?)\s*%/);
              return { key: w.key, value: m ? parseFloat(m[1]) : null };
            } catch { return { key: w.key, value: null }; }
          }));
          for (const r of results) {
            if (r.key === "cpu") cpuPercent = r.value;
            if (r.key === "memory") memPercent = r.value;
            if (r.key === "disk") diskPercent = r.value;
          }
          if (cpuPercent !== null || memPercent !== null || diskPercent !== null) {
            widgetSource = "fusionpbx_dashboard_widget";
          }
        }
      } catch { /* unavailable */ }

      const payload = {
        ok: true,
        data: {
          uptime: uptimeMatch ? uptimeMatch[1].trim() : null,
          freeswitch: {
            sessions_active: sessionsActive,
            sessions_per_second: sps,
            available: !!statusText,
          },
          cpu_percent: cpuPercent,
          memory_percent: memPercent,
          disk_percent: diskPercent,
          metrics_available: {
            cpu: cpuPercent !== null,
            memory: memPercent !== null,
            disk: diskPercent !== null,
            source: widgetSource,
          },
        },
        cached: false,
        fetched_at: new Date(now).toISOString(),
      };
      SYSTEM_HEALTH_CACHE.set(origin, { fetchedAt: now, payload });
      return json(payload);
    }


    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (e: any) {
    if (organization_id) {
      await admin.from("pbx_sync_jobs").insert({
        organization_id, job_type: action, status: "failed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error: e?.message || String(e),
      });
    }
    return json({ error: "INTERNAL", message: e?.message || String(e) }, 500);
  }
});
