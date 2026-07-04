// ns-get-recording — official NS-API v2 recording fetch (Bearer NS_API_KEY).
// Cascade:
//   1. GET /domains/{d}/users/{ext}/recordings/{callid}
//   2. GET /domains/~/users/~/recordings/{callid}
//   3. GET /domains/{d}/recordings/{callid}
// Accepts { call_db_id?, ns_callid?, ns_extension? } — resolves missing fields from DB.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NS_API_KEY = Deno.env.get("NS_API_KEY");
const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
const NS_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? Deno.env.get("NS_API_DOMAIN") ?? "planipret.ca";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (payload: any, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function pickAudioUrl(j: any): string | null {
  if (!j) return null;
  const cand = j.url ?? j["recording-url"] ?? j["file-access-url"] ?? j["media-url"]
    ?? j["file"] ?? j["download-url"] ?? j.recording ?? null;
  return typeof cand === "string" ? cand : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!NS_API_KEY) return json({ error: "NS_API_KEY not configured" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { /* GET/empty */ }
  const url = new URL(req.url);
  const call_db_id = body.call_db_id ?? url.searchParams.get("call_db_id");
  let ns_callid: string | null = body.ns_callid ?? url.searchParams.get("ns_callid");
  let ns_extension: string | null = body.ns_extension ?? url.searchParams.get("ns_extension");

  if ((!ns_callid || !ns_extension) && call_db_id) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row } = await admin
      .from("planipret_phone_calls")
      .select("ns_callid, ns_orig_callid, ns_term_callid, extension, metadata, recording_url")
      .eq("id", call_db_id)
      .maybeSingle();
    ns_callid = ns_callid || row?.ns_callid || row?.ns_orig_callid || row?.ns_term_callid
      || row?.metadata?.["call-parent-cdr-id"] || null;
    ns_extension = ns_extension || row?.extension || row?.metadata?.["call-orig-user"]?.toString() || null;
    // If DB already has a fully-resolved http recording_url, short-circuit.
    if (row?.recording_url && String(row.recording_url).startsWith("http")) {
      const direct = await fetch(row.recording_url, { headers: { Authorization: `Bearer ${NS_API_KEY}` } });
      if (direct.ok) {
        const ct = direct.headers.get("Content-Type") ?? "audio/mpeg";
        const buf = await direct.arrayBuffer();
        if (buf.byteLength > 128) {
          return new Response(buf, {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": ct.includes("audio") ? ct : "audio/mpeg", "Content-Length": String(buf.byteLength), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" },
          });
        }
      }
    }
  }

  if (!ns_callid) {
    return json({
      error: "MISSING_CALLID",
      message: "Identifiant NS-API introuvable pour cet appel. Relancez la synchronisation CDR.",
      call_db_id, ns_callid, ns_extension,
    }, 200);
  }

  const headers = { Authorization: `Bearer ${NS_API_KEY}`, Accept: "audio/*, application/json" };
  const attempts: any[] = [];

  // Generate callid variants: raw, encoded, before-@, encoded before-@
  const rawId = ns_callid;
  const beforeAt = rawId.split("@")[0];
  const variants = Array.from(new Set([rawId, encodeURIComponent(rawId), beforeAt, encodeURIComponent(beforeAt)]));

  const paths: string[] = [];
  for (const v of variants) {
    if (ns_extension) paths.push(`/domains/${encodeURIComponent(NS_DOMAIN)}/users/${encodeURIComponent(ns_extension)}/recordings/${v}`);
    paths.push(`/domains/${encodeURIComponent(NS_DOMAIN)}/recordings/${v}`);
    paths.push(`/domains/~/users/~/recordings/${v}`);
  }

  for (const p of paths) {
    const target = `${NS_API_BASE_URL}${p}`;
    try {
      const r = await fetch(target, { headers });
      const ct = r.headers.get("Content-Type") ?? "";
      attempts.push({ url: p, status: r.status, ct });

      if (r.ok && (ct.startsWith("audio") || ct.includes("octet-stream"))) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength < 128) continue;
        return new Response(buf, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": ct.startsWith("audio") ? ct : "audio/mpeg", "Content-Length": String(buf.byteLength), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" },
        });
      }
      if (r.ok) {
        const parsed = await r.json().catch(() => null);
        const audioUrl = pickAudioUrl(parsed);
        if (audioUrl) {
          const fullUrl = audioUrl.startsWith("http") ? audioUrl : `${NS_API_BASE_URL}${audioUrl.startsWith("/") ? "" : "/"}${audioUrl.replace(/^\/?ns-api\/v2\/?/, "")}`;
          const a = await fetch(fullUrl, { headers });
          attempts.push({ url: "audio-url-follow", status: a.status });
          if (a.ok) {
            const act = a.headers.get("Content-Type") ?? "audio/mpeg";
            const buf = await a.arrayBuffer();
            if (buf.byteLength > 128) {
              return new Response(buf, {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": act.includes("audio") ? act : "audio/mpeg", "Content-Length": String(buf.byteLength), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" },
              });
            }
          }
        }
      }
    } catch (e) {
      attempts.push({ url: p, error: (e as Error).message });
    }
  }

  return json({
    error: "RECORDING_NOT_FOUND",
    message: "Enregistrement non disponible sur NetSapiens.",
    ns_callid, ns_extension, domain: NS_DOMAIN, attempts,
    possible_causes: [
      "L'appel n'a pas été enregistré (règle d'enregistrement inactive pour cette extension/direction)",
      "Le fichier a expiré ou été purgé côté NetSapiens",
      "Le ns_callid stocké ne correspond à aucun enregistrement — vérifier la synchro CDR",
    ],
  }, 200);
});
