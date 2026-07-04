// pp-admin-recording-resolve — On-demand recording URL resolver for a single
// planipret_phone_calls row. Admin-only. Calls NS-API v2
// /domains/{domain}/recordings/{callId}, extracts the file-access-url, stores
// it on the row, and returns it.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const NS_API_KEY = Deno.env.get("NS_API_KEY") ?? "";
const NS_API_BASE_URL = (Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2").replace(/\/$/, "");
const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "planipret.ca";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const val = (raw: any, keys: string[], fb: any = null) => {
  for (const k of keys) {
    const v = raw?.[k];
    if (v !== undefined && v !== null && `${v}` !== "") return v;
  }
  return fb;
};

function lookupCallId(c: any): string | null {
  const id = String(val(c, [
    "call-parent-cdr-id", "call-orig-call-id", "call-parent-call-id",
    "orig-callid", "orig-call-id", "orig_callid",
    "call-id", "call_id", "callid", "call-term-call-id",
    "cdr_id", "cdr-id", "id",
  ], "")).trim();
  return id || null;
}

async function nsFetch(path: string) {
  const r = await fetch(`${NS_API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${NS_API_KEY}`, Accept: "application/json" },
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    if (!NS_API_KEY) return json({ error: "NS_API_KEY missing" }, 500);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("is_planipret_admin", { _user_id: userData.user.id });
    const { data: isMember } = await admin.rpc("is_planipret_member", { _user_id: userData.user.id });
    if (isAdmin !== true && isMember !== true) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const callRowId = body.call_row_id ?? body.id;
    const force = body.force === true;
    if (!callRowId) return json({ error: "call_row_id required" }, 400);

    const { data: row, error: rowErr } = await admin
      .from("planipret_phone_calls")
      .select("id, ns_domain, extension, recording_url, metadata")
      .eq("id", callRowId)
      .maybeSingle();
    if (rowErr || !row) return json({ error: "call not found" }, 404);

    if (!force && row.recording_url && String(row.recording_url).startsWith("http")) {
      return json({ ok: true, recording_url: row.recording_url, cached: true });
    }

    const domain = row.ns_domain || NS_DEFAULT_DOMAIN;
    const meta: any = row.metadata ?? {};
    const nsRaw = meta.ns_recording ?? meta;
    const callId = lookupCallId(nsRaw) || lookupCallId(meta);
    if (!callId) return json({ error: "no NS call id available on this row" }, 422);

    const path = `/domains/${encodeURIComponent(domain)}/recordings/${encodeURIComponent(callId)}`;
    const r = await nsFetch(path);
    if (!r.ok) {
      const notFound = r.status === 404;
      return json({
        ok: false,
        fallback: true,
        error: notFound ? "RECORDING_NOT_FOUND" : `NS-API ${r.status}`,
        hint: notFound
          ? "Aucun enregistrement disponible pour cet appel côté NetSapiens (peut ne pas avoir été enregistré, ou déjà expiré)."
          : "Le service d'enregistrement NetSapiens a retourné une erreur.",
        ns_status: r.status,
        ns_detail: r.data,
        ns_path: path,
      }, 200);
    }

    const first = Array.isArray(r.data) ? r.data[0] : r.data;
    const url = val(first, ["file-access-url", "file_access_url", "recording_url", "recording-url", "url"], null);
    if (!url) return json({
      ok: false,
      fallback: true,
      error: "NO_ACCESS_URL",
      hint: "NetSapiens a répondu mais sans URL d'accès au fichier audio.",
      ns_path: path,
      sample: first,
    }, 200);

    await admin.from("planipret_phone_calls").update({
      recording_url: url,
      metadata: { ...meta, recording_access_url_resolved: true, recording_api_path: path },
    }).eq("id", row.id);

    return json({ ok: true, recording_url: url, cached: false });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
