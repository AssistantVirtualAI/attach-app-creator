// pp-admin-ns-sync — Admin-level bulk sync of NS-API CDRs and recordings
// across every Planiprêt extension into planipret_phone_calls.
// Triggered from /planipret/admin/calls and /planipret/admin/recordings.

import {
  AVA_ORG_ID,
  corsHeaders,
  getEnv,
  jsonResponse,
  nsFetch,
} from "../_shared/planipret-ns.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function pickDirection(raw: any): "inbound" | "outbound" | "missed" {
  const dir = (raw?.direction ?? raw?.call_direction ?? "").toString().toLowerCase();
  if (dir.includes("in")) {
    if (raw?.answered === false || raw?.disposition === "no-answer") return "missed";
    return "inbound";
  }
  return "outbound";
}
const toIso = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (!userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { data: isMember } = await admin.rpc("is_planipret_member", { _user_id: userData.user.id });
    if (isMember !== true) return jsonResponse({ error: "Forbidden" }, 403);

    let body: any = {};
    try { body = await req.json(); } catch {}
    const end = body.end ?? new Date().toISOString();
    const start = body.start ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const limit = Math.min(Number(body.limit ?? 500), 2000);

    const env = getEnv();
    const domain = body.domain ?? env.NS_DEFAULT_DOMAIN;
    if (!domain) return jsonResponse({ error: "NS domain not configured" }, 412);

    // Fetch all profiles to map extension -> user_id (when known)
    const { data: profiles } = await admin
      .from("planipret_profiles")
      .select("user_id, extension")
      .eq("organization_id", AVA_ORG_ID);
    const extToUser = new Map<string, string>();
    (profiles ?? []).forEach((p: any) => p.extension && extToUser.set(String(p.extension), p.user_id));

    // Fetch all users from NS-API (so we sync CDRs for every extension, not just linked ones)
    const usersRes = await nsFetch(`/domains/${encodeURIComponent(domain)}/users?limit=2000`);
    if (!usersRes.ok) {
      const t = await usersRes.text();
      return jsonResponse({ error: "NS users fetch failed", body: t.slice(0, 300) }, 502);
    }
    const usersJson = await usersRes.json();
    const users: any[] = Array.isArray(usersJson) ? usersJson : usersJson?.users ?? usersJson?.data ?? [];
    const extensions = Array.from(new Set(users.map((u) => String(u.user ?? u.extension ?? "")).filter(Boolean)));

    let totalFetched = 0, totalUpserted = 0, totalRecordings = 0, errors: string[] = [];

    // Sync CDRs in parallel batches of 10
    const chunks: string[][] = [];
    for (let i = 0; i < extensions.length; i += 10) chunks.push(extensions.slice(i, i + 10));

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (ext) => {
        try {
          const path = `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(ext)}/cdrs?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}&limit=${limit}`;
          const res = await nsFetch(path);
          if (!res.ok) return;
          const raw = await res.json();
          const items: any[] = Array.isArray(raw) ? raw : raw?.cdrs ?? raw?.data ?? [];
          totalFetched += items.length;
          if (!items.length) return;

          const rows = items.map((it) => ({
            user_id: extToUser.get(ext) ?? null,
            organization_id: AVA_ORG_ID,
            ns_call_id: it.id ?? it.call_id ?? it.uuid ?? null,
            ns_domain: domain,
            extension: ext,
            direction: pickDirection(it),
            status: it.disposition ?? it.status ?? null,
            from_number: it.from_number ?? it.caller_id_number ?? null,
            from_name: it.from_name ?? it.caller_id_name ?? null,
            to_number: it.to_number ?? it.destination ?? null,
            to_name: it.to_name ?? null,
            started_at: toIso(it.start_time ?? it.started_at),
            answered_at: toIso(it.answer_time ?? it.answered_at),
            ended_at: toIso(it.end_time ?? it.ended_at),
            duration_seconds: Number(it.duration ?? it.billsec ?? 0) || 0,
            recording_url: it.recording_url ?? it.recording ?? null,
            metadata: it,
          })).filter((r) => r.user_id || r.ns_call_id); // require either link or unique id

          const withId = rows.filter((r) => r.ns_call_id);
          const withoutId = rows.filter((r) => !r.ns_call_id && r.user_id);
          if (withId.length) {
            const { error, count } = await admin
              .from("planipret_phone_calls")
              .upsert(withId, { onConflict: "ns_call_id", count: "exact" });
            if (error) errors.push(`${ext}: ${error.message}`);
            else totalUpserted += count ?? withId.length;
          }
          if (withoutId.length) {
            const { error } = await admin.from("planipret_phone_calls").insert(withoutId);
            if (error) errors.push(`${ext}: ${error.message}`);
          }
          totalRecordings += rows.filter((r) => r.recording_url).length;
        } catch (e) {
          errors.push(`${ext}: ${(e as Error).message}`);
        }
      }));
    }

    return jsonResponse({
      ok: true,
      domain,
      extensions: extensions.length,
      fetched: totalFetched,
      upserted: totalUpserted,
      recordings: totalRecordings,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
