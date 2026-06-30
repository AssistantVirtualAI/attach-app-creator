// supabase/functions/ns-live-test/index.ts
// Live NS-API v2 integration test — exercises all read endpoints + supports sync.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const NS_API_KEY = Deno.env.get("NS_API_KEY") ?? "";
const NS_API_BASE_URL =
  Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "planipret.ca";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function nsFetch(path: string) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${NS_API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${NS_API_KEY}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return {
      status: res.status,
      success: res.ok,
      latency_ms: Math.round(performance.now() - t0),
      data,
    };
  } catch (e) {
    return {
      status: 0,
      success: false,
      latency_ms: Math.round(performance.now() - t0),
      error: (e as Error).message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth — require an authenticated Supabase user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supa.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    if (!NS_API_KEY) return json({ error: "NS_API_KEY missing in secrets" }, 500);

    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }
    const action = body?.action ?? "test";
    const domain = (body?.domain ?? NS_DEFAULT_DOMAIN).trim();

    // ─── ACTION: sync ──────────────────────────────────────────────
    // Matches NS users to planipret_profiles by email & updates extensions.
    if (action === "sync") {
      const usersRes = await nsFetch(`/domains/${encodeURIComponent(domain)}/users`);
      if (!usersRes.success || !Array.isArray(usersRes.data)) {
        return json({ error: "Cannot fetch users from NS-API", ns: usersRes }, 502);
      }
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const matched: any[] = [];
      const unmatched: any[] = [];
      for (const u of usersRes.data) {
        const email = (u.email ?? "").toLowerCase().trim();
        const ext = String(u.user ?? "").trim();
        if (!ext) continue;
        if (!email) {
          unmatched.push({ extension: ext, name: `${u["name-first-name"] ?? ""} ${u["name-last-name"] ?? ""}`.trim(), reason: "no_email" });
          continue;
        }
        const { data: prof } = await admin
          .from("planipret_profiles")
          .select("id,email")
          .ilike("email", email)
          .maybeSingle();
        if (!prof) {
          unmatched.push({ extension: ext, name: `${u["name-first-name"] ?? ""} ${u["name-last-name"] ?? ""}`.trim(), email, reason: "no_profile" });
          continue;
        }
        const { error: upErr } = await admin
          .from("planipret_profiles")
          .update({
            ns_extension: ext,
            ns_domain: domain,
            ns_sip_username: u["login-username"] ?? ext,
            ns_linked: true,
            ns_linked_at: new Date().toISOString(),
          })
          .eq("id", prof.id);
        if (upErr) {
          unmatched.push({ extension: ext, email, reason: `update_failed: ${upErr.message}` });
        } else {
          matched.push({ extension: ext, email, profile_id: prof.id });
        }
      }
      return json({ ok: true, matched_count: matched.length, unmatched_count: unmatched.length, matched, unmatched });
    }

    // ─── ACTION: link (manual single broker link) ──────────────────
    if (action === "link") {
      const { profile_id, extension, sip_username } = body ?? {};
      if (!profile_id || !extension) return json({ error: "profile_id and extension required" }, 400);
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error: upErr } = await admin
        .from("planipret_profiles")
        .update({
          ns_extension: String(extension),
          ns_domain: domain,
          ns_sip_username: sip_username ?? String(extension),
          ns_linked: true,
          ns_linked_at: new Date().toISOString(),
        })
        .eq("id", profile_id);
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ ok: true });
    }

    // ─── ACTION: test (default — exercise all endpoints) ────────────
    const tStart = performance.now();
    const [version, dom, users, active_calls, cdrs, devices, phone_numbers, registrations, call_queues] =
      await Promise.all([
        nsFetch(`/version`),
        nsFetch(`/domains/${encodeURIComponent(domain)}`),
        nsFetch(`/domains/${encodeURIComponent(domain)}/users`),
        nsFetch(`/domains/${encodeURIComponent(domain)}/calls`),
        nsFetch(`/domains/${encodeURIComponent(domain)}/cdrs?limit=10`),
        nsFetch(`/domains/${encodeURIComponent(domain)}/devices`),
        nsFetch(`/domains/${encodeURIComponent(domain)}/phonenumbers`),
        nsFetch(`/domains/${encodeURIComponent(domain)}/registrations`),
        nsFetch(`/domains/${encodeURIComponent(domain)}/callqueues`),
      ]);

    const results: Record<string, any> = {
      version,
      domain: { ...dom, data: Array.isArray(dom.data) ? dom.data[0] : dom.data },
      users: {
        ...users,
        count: Array.isArray(users.data) ? users.data.length : 0,
        data: Array.isArray(users.data)
          ? users.data.map((u: any) => ({
              extension: u.user,
              name: `${u["name-first-name"] ?? ""} ${u["name-last-name"] ?? ""}`.trim() || u["display-name"] || u.user,
              email: u.email ?? "",
              scope: u["user-scope"] ?? "",
              status: u["account-status"] ?? "",
              active_calls: u["active-calls-total-current"] ?? 0,
              presence: u["user-presence-status"] ?? "",
              voicemail: u["voicemail-enabled"] ?? "",
              timezone: u["time-zone"] ?? "",
              login: u["login-username"] ?? "",
              raw: u,
            }))
          : [],
      },
      active_calls: { ...active_calls, count: Array.isArray(active_calls.data) ? active_calls.data.length : 0 },
      cdrs: { ...cdrs, count: Array.isArray(cdrs.data) ? cdrs.data.length : 0 },
      devices: { ...devices, count: Array.isArray(devices.data) ? devices.data.length : 0 },
      phone_numbers: { ...phone_numbers, count: Array.isArray(phone_numbers.data) ? phone_numbers.data.length : 0 },
      registrations: { ...registrations, count: Array.isArray(registrations.data) ? registrations.data.length : 0 },
      call_queues: { ...call_queues, count: Array.isArray(call_queues.data) ? call_queues.data.length : 0 },
    };

    const total_latency_ms = Math.round(performance.now() - tStart);
    const passed = Object.values(results).filter((r: any) => r.success).length;
    const failed = Object.values(results).filter((r: any) => !r.success).length;

    return json({
      summary: {
        total_tests: Object.keys(results).length,
        passed,
        failed,
        domain,
        base_url: NS_API_BASE_URL,
        total_latency_ms,
        tested_at: new Date().toISOString(),
      },
      results,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
