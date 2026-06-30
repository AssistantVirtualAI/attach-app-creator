// pp-admin-ns-sync — Admin-level NS-API sync for Planiprêt users, CDRs,
// recordings and messages. Returns quickly; heavy backfill runs in background.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AVA_ORG_ID = "17d6507f-a9ca-409d-8e49-371d50332615";
const NS_API_KEY = Deno.env.get("NS_API_KEY") ?? "";
const NS_API_BASE_URL = (Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2").replace(/\/$/, "");
const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "planipret.ca";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function nsFetch(path: string) {
  const res = await fetch(`${NS_API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${NS_API_KEY}`, Accept: "application/json" },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data, text };
}

async function fetchAll(basePath: string, pageSize = 200, maxPages = 30) {
  const all: any[] = [];
  let warning: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const r = await nsFetch(`${basePath}${sep}limit=${pageSize}&offset=${i * pageSize}`);
    if (!r.ok) {
      warning = `HTTP ${r.status}: ${String(r.text ?? "").slice(0, 180)}`;
      break;
    }
    const arr = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.users ?? r.data?.cdrs ?? r.data?.messages ?? r.data?.items ?? []);
    all.push(...arr);
    if (arr.length < pageSize) break;
  }
  return { data: all, warning };
}

function val(raw: any, keys: string[], fallback: any = null) {
  for (const k of keys) {
    const v = raw?.[k];
    if (v !== undefined && v !== null && `${v}` !== "") return v;
  }
  return fallback;
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizePhone(v: unknown): string | null {
  const s = String(v ?? "").replace(/^sip:/i, "").split("@")[0].replace(/[<>\"']/g, "").trim();
  return s || null;
}

function pickDirection(c: any, ext?: string): "inbound" | "outbound" | "missed" {
  const d = String(val(c, ["direction", "call_direction", "call-direction", "type"], "")).toLowerCase();
  const disp = String(val(c, ["release-text", "disposition", "status", "result"], "")).toLowerCase();
  const answered = val(c, ["time-answer", "answer_time", "answer-time", "answered_at", "answered-at"]);
  if (disp.includes("miss") || disp.includes("no answer") || disp.includes("no-answer")) return "missed";
  if (d.includes("out")) return "outbound";
  if (d.includes("in")) return "inbound";
  const orig = String(val(c, ["orig-user", "from-user", "from_user", "user"], ""));
  if (ext && orig === ext) return "outbound";
  if (!answered && disp.includes("cancel")) return "missed";
  return "inbound";
}

function recordingUrl(c: any): string | null {
  return val(c, [
    "recording_url", "recording-url", "recording", "recording_file", "recording-file",
    "recording_download_url", "recording-download-url", "audio_url", "audio-url", "download_url", "url",
  ]);
}

function nsCallId(c: any): string | null {
  return String(val(c, ["id", "call_id", "call-id", "cdr_id", "cdr-id", "uuid", "orig-callid", "orig_callid", "session_id", "session-id"], "")).trim() || null;
}

function userExt(u: any): string {
  return String(val(u, ["user", "extension", "subscriber_login", "user_id", "id"], "")).trim();
}

function userEmail(u: any): string {
  return String(val(u, ["email", "email_address", "email-address"], "")).toLowerCase().trim();
}

function userName(u: any, ext: string) {
  const first = val(u, ["name-first-name", "first_name", "firstName"], "");
  const last = val(u, ["name-last-name", "last_name", "lastName"], "");
  return String(val(u, ["display_name", "display-name", "name"], `${first} ${last}`.trim()) || ext);
}

async function tryPaths(paths: string[]) {
  let last: any = null;
  for (const p of paths) {
    const r = await fetchAll(p, 200, 15);
    if (r.data.length) return { ...r, path: p };
    last = { ...r, path: p };
  }
  return last ?? { data: [], warning: "no_endpoint" };
}

async function upsertProfiles(admin: ReturnType<typeof createClient>, domain: string, users: any[]) {
  const { data: profiles } = await admin
    .from("planipret_profiles")
    .select("user_id,email,extension,ns_extension,full_name,metadata")
    .eq("organization_id", AVA_ORG_ID);

  const byExt = new Map<string, any>();
  const byEmail = new Map<string, any>();
  for (const p of profiles ?? []) {
    const ext = String(p.extension ?? p.ns_extension ?? "").trim();
    if (ext) byExt.set(ext, p);
    if (p.email) byEmail.set(String(p.email).toLowerCase().trim(), p);
  }

  let matched = 0;
  const patches: Array<{ user_id: string; patch: any }> = [];
  for (const u of users) {
    const ext = userExt(u);
    if (!ext) continue;
    const email = userEmail(u);
    const existing = byExt.get(ext) ?? (email ? byEmail.get(email) : null);
    if (!existing?.user_id) continue;
    matched++;
    patches.push({
      user_id: existing.user_id,
      patch: {
        extension: existing.extension ?? ext,
        ns_extension: ext,
        ns_domain: domain,
        ns_sip_username: val(u, ["login-username", "login_username", "sip_username"], ext),
        ns_linked: true,
        ns_linked_at: new Date().toISOString(),
        metadata: { ...(existing.metadata ?? {}), ns_user: u },
      },
    });
  }

  for (let i = 0; i < patches.length; i += 25) {
    const chunk = patches.slice(i, i + 25);
    await Promise.all(chunk.map(({ user_id, patch }) => admin.from("planipret_profiles").update(patch).eq("user_id", user_id)));
  }
  return { matched };
}

async function syncCalls(admin: ReturnType<typeof createClient>, domain: string, users: any[], start: string, end: string) {
  const { data: profiles } = await admin
    .from("planipret_profiles")
    .select("user_id,extension,ns_extension,full_name,email")
    .eq("organization_id", AVA_ORG_ID);
  const extToUser = new Map<string, string>();
  for (const p of profiles ?? []) {
    const ext = String(p.extension ?? p.ns_extension ?? "").trim();
    if (ext && p.user_id) extToUser.set(ext, p.user_id);
  }

  const D = encodeURIComponent(domain);
  const domainCdrs = await fetchAll(`/domains/${D}/cdrs?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`, 200, 50);
  const rawItems: Array<{ item: any; ext?: string }> = [];
  for (const c of domainCdrs.data) rawItems.push({ item: c, ext: String(val(c, ["user", "orig-user", "term-user", "extension"], "")) || undefined });

  if (rawItems.length === 0) {
    const extensions = Array.from(new Set(users.map(userExt).filter(Boolean)));
    for (let i = 0; i < extensions.length; i += 12) {
      const chunk = extensions.slice(i, i + 12);
      const results = await Promise.all(chunk.map(async (ext) => {
        const r = await fetchAll(`/domains/${D}/users/${encodeURIComponent(ext)}/cdrs?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`, 200, 10);
        return { ext, data: r.data, warning: r.warning };
      }));
      for (const r of results) for (const item of r.data) rawItems.push({ item, ext: r.ext });
    }
  }

  const rows: any[] = [];
  for (const { item: c, ext: fallbackExt } of rawItems) {
    const id = nsCallId(c);
    if (!id) continue;
    const ext = String(val(c, ["user", "orig-user", "term-user", "extension", "subscriber"], fallbackExt ?? "")).trim();
    const started = toIso(val(c, ["time-start", "start-time", "start_time", "started_at", "date", "created_at"]));
    rows.push({
      user_id: extToUser.get(ext) ?? null,
      organization_id: AVA_ORG_ID,
      ns_call_id: id,
      ns_domain: domain,
      extension: ext || null,
      direction: pickDirection(c, ext),
      status: String(val(c, ["release-text", "disposition", "status"], "completed")).toLowerCase(),
      from_number: normalizePhone(val(c, ["orig-from-uri", "from", "from_number", "from-user", "caller_id_number"])),
      from_name: val(c, ["orig-from-name", "from_name", "caller_id_name"]),
      to_number: normalizePhone(val(c, ["term-to-uri", "to", "to_number", "to-user", "destination"])),
      to_name: val(c, ["term-to-name", "to_name"]),
      started_at: started,
      answered_at: toIso(val(c, ["time-answer", "answer-time", "answer_time", "answered_at"])),
      ended_at: toIso(val(c, ["time-release", "end-time", "end_time", "ended_at"])),
      duration_seconds: Number(val(c, ["duration", "time-talking", "billsec", "talk_time"], 0)) || 0,
      recording_url: recordingUrl(c),
      metadata: c,
    });
  }

  let upserted = 0;
  let errors: string[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await admin.from("planipret_phone_calls").upsert(chunk, { onConflict: "ns_call_id" });
    if (error) errors.push(error.message);
    else upserted += chunk.length;
  }
  return { fetched: rawItems.length, upserted, recordings: rows.filter((r) => r.recording_url).length, warnings: domainCdrs.warning ? [domainCdrs.warning] : [], errors };
}

async function syncMessages(admin: ReturnType<typeof createClient>, domain: string, start: string, end: string) {
  const D = encodeURIComponent(domain);
  const r = await tryPaths([
    `/domains/${D}/messages?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`,
    `/domains/${D}/sms?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`,
    `/domains/${D}/texts?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`,
  ]);
  if (!r.data.length) return { fetched: 0, upserted: 0, warning: r.warning ?? "messages_endpoint_empty" };

  const { data: profiles } = await admin.from("planipret_profiles").select("user_id,extension,ns_extension").eq("organization_id", AVA_ORG_ID);
  const extToUser = new Map<string, string>();
  for (const p of profiles ?? []) {
    const ext = String(p.extension ?? p.ns_extension ?? "").trim();
    if (ext && p.user_id) extToUser.set(ext, p.user_id);
  }

  const rows = r.data.map((m: any) => {
    const ext = String(val(m, ["user", "extension", "subscriber", "from-user", "to-user"], "")).trim();
    const mid = String(val(m, ["id", "message_id", "message-id", "uuid"], crypto.randomUUID())).trim();
    const dir = String(val(m, ["direction", "type"], "inbound")).toLowerCase().includes("out") ? "outbound" : "inbound";
    const peer = dir === "outbound" ? normalizePhone(val(m, ["to", "to_number", "to-number"])) : normalizePhone(val(m, ["from", "from_number", "from-number"]));
    return {
      user_id: extToUser.get(ext) ?? null,
      organization_id: AVA_ORG_ID,
      ns_message_id: mid,
      thread_id: String(val(m, ["thread_id", "thread-id"], `${ext}:${peer ?? mid}`)),
      direction: dir,
      from_number: normalizePhone(val(m, ["from", "from_number", "from-number"])),
      to_number: normalizePhone(val(m, ["to", "to_number", "to-number"])),
      body: val(m, ["body", "message", "text", "content"], ""),
      media_urls: val(m, ["media_urls", "media-urls", "attachments"], []),
      status: val(m, ["status", "delivery_status"], null),
      sent_at: toIso(val(m, ["sent_at", "sent-at", "time", "created_at"])),
      metadata: { ...m, extension: ext },
    };
  });

  let upserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await admin.from("planipret_phone_messages").upsert(chunk, { onConflict: "ns_message_id" });
    if (!error) upserted += chunk.length;
  }
  return { fetched: rows.length, upserted, warning: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    if (!NS_API_KEY) return json({ error: "NS_API_KEY missing in backend secrets" }, 500);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("is_planipret_admin", { _user_id: userData.user.id });
    const { data: isMember } = await admin.rpc("is_planipret_member", { _user_id: userData.user.id });
    if (isAdmin !== true && isMember !== true) return json({ error: "Forbidden" }, 403);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const domain = String(body.domain ?? NS_DEFAULT_DOMAIN).trim();
    const end = body.end ?? new Date().toISOString();
    const start = body.start ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    if (!domain) return json({ error: "NS domain not configured" }, 412);
    const usersRes = await fetchAll(`/domains/${encodeURIComponent(domain)}/users`, 200, 30);
    if (!usersRes.data.length) return json({ error: "NS users fetch failed", warning: usersRes.warning }, 502);

    const profileSync = await upsertProfiles(admin, domain, usersRes.data);

    const bg = (async () => {
      try {
        const calls = await syncCalls(admin, domain, usersRes.data, start, end);
        const messages = await syncMessages(admin, domain, start, end);
        console.log("[pp-admin-ns-sync] completed", JSON.stringify({ domain, users: usersRes.data.length, calls, messages }));
      } catch (e) {
        console.error("[pp-admin-ns-sync] background error", (e as Error).message);
      }
    })();
    // @ts-ignore EdgeRuntime global exists in deployed edge runtime.
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      (EdgeRuntime as any).waitUntil(bg);
    }

    return json({
      ok: true,
      status: "queued",
      domain,
      users_total: usersRes.data.length,
      extensions: usersRes.data.map(userExt).filter(Boolean).length,
      profiles_matched: profileSync.matched,
      cdr: { status: "queued_in_background", start, end },
      messages: { status: "queued_in_background" },
      warning: usersRes.warning,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});