// ns-get-recording — official NS-API v2 recording fetch (Bearer NS_API_KEY).
// Accepts { call_db_id?, ns_callid?, ns_extension? } — resolves missing fields from DB.
// Important: recordings are keyed by NS call-id values (orig/term/parent call-id),
// not always by CDR id. We hydrate those IDs from the CDR row before probing.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NS_API_KEY = Deno.env.get("NS_API_KEY");
const NS_API_BASE_URL = (Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2").replace(/\/$/, "");
const NS_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? Deno.env.get("NS_API_DOMAIN") ?? "planipret.ca";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (payload: any, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function pickAudioUrl(j: any): string | null {
  if (!j) return null;
  const first = Array.isArray(j) ? j[0] : j;
  const cand = first?.["file-access-url"] ?? first?.file_access_url ?? first?.url ?? first?.["recording-url"] ?? first?.recording_url
    ?? first?.["media-url"] ?? first?.["file"] ?? first?.["download-url"] ?? first?.recording ?? null;
  return typeof cand === "string" ? cand : null;
}

const val = (raw: any, keys: string[], fb: any = null) => {
  for (const k of keys) {
    const v = raw?.[k];
    if (v !== undefined && v !== null && `${v}` !== "") return v;
  }
  return fb;
};

function normalizePhone(v: unknown): string {
  return String(v ?? "").replace(/^sip:/i, "").split("@")[0].replace(/\D/g, "");
}

function pushId(out: string[], raw: unknown) {
  const value = String(raw ?? "").trim();
  if (!value || value === "null" || value === "undefined") return;
  if (value.includes("sip:") || value.split(":").length > 3) return;
  if (!out.includes(value)) out.push(value);
}

function addIds(out: string[], ...sources: any[]) {
  const keys = [
    "call-orig-call-id", "orig-callid", "orig-call-id", "orig_callid",
    "call-term-call-id", "term-callid", "term-call-id", "term_callid",
    "call-through-call-id", "by-callid", "by_callid",
    "call-parent-call-id", "call-id", "call_id", "callid",
    "call-parent-cdr-id", "cdr_id", "cdr-id", "id", "uuid",
  ];
  for (const source of sources) {
    if (!source) continue;
    for (const k of keys) pushId(out, source[k]);
  }
}

function normalizeNsPath(path: unknown): string | null {
  const s = String(path ?? "").trim();
  if (!s) return null;
  if (s.startsWith("http")) {
    try {
      const u = new URL(s);
      const idx = u.pathname.indexOf("/ns-api/v2");
      return `${idx >= 0 ? u.pathname.slice(idx + "/ns-api/v2".length) : u.pathname}${u.search}`;
    } catch { return s; }
  }
  return s.replace(/^\/?ns-api\/v2/i, "");
}

function addIdsFromPath(out: string[], path: unknown) {
  const p = normalizeNsPath(path);
  if (!p) return;
  try {
    const u = new URL(`https://ns.local${p.startsWith("/") ? p : `/${p}`}`);
    ["orig_callid", "term_callid", "callid", "call-id"].forEach((k) => pushId(out, u.searchParams.get(k)));
  } catch { /* ignore */ }
}

async function nsJson(path: string) {
  const r = await fetch(`${NS_API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${NS_API_KEY}`, Accept: "application/json" },
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, ct: r.headers.get("Content-Type") ?? "", data, text };
}

function asArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const k of ["data", "cdrs", "items", "results", "recordings"]) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [data];
}

function cdrScore(c: any, row: any, knownIds: string[]) {
  let score = 0;
  const cIds: string[] = [];
  addIds(cIds, c);
  if (knownIds.some((id) => cIds.includes(id))) score += 100;
  const ext = String(row?.extension ?? "").trim();
  if (ext && ["call-orig-user", "call-term-user", "call-through-user", "orig-user", "term-user", "user"].some((k) => String(c?.[k] ?? "") === ext)) score += 20;
  const dur = Number(row?.duration_seconds ?? 0);
  const cDur = Number(val(c, ["call-talking-duration-seconds", "call-total-duration-seconds", "duration", "billsec"], 0));
  if (dur && cDur && Math.abs(dur - cDur) <= 3) score += 20;
  const started = row?.started_at ? new Date(row.started_at).getTime() : 0;
  const cStartRaw = val(c, ["call-start-datetime", "call-batch-start-datetime", "start-time", "time-start", "started_at"], null);
  const cStart = cStartRaw ? new Date(cStartRaw).getTime() : 0;
  if (started && cStart && Math.abs(started - cStart) <= 120_000) score += 20;
  const from = normalizePhone(row?.from_number);
  const to = normalizePhone(row?.to_number);
  const cFrom = normalizePhone(val(c, ["call-orig-from-uri", "orig-from-uri", "from", "from_number", "caller_id_number"], ""));
  const cTo = normalizePhone(val(c, ["call-term-to-uri", "call-orig-to-uri", "to", "to_number", "destination"], ""));
  if (from && cFrom && (from.endsWith(cFrom) || cFrom.endsWith(from))) score += 10;
  if (to && cTo && (to.endsWith(cTo) || cTo.endsWith(to))) score += 10;
  return score;
}

async function hydrateCdrs(row: any, domain: string, ids: string[], attempts: any[]) {
  if (!row) return [];
  const D = encodeURIComponent(domain);
  const paths: string[] = [];
  for (const id of ids.slice(0, 4)) {
    paths.push(`/domains/${D}/cdrs/${encodeURIComponent(id)}`);
    paths.push(`/domains/${D}/cdrs?id=${encodeURIComponent(id)}`);
  }
  if (row.started_at) {
    const start = new Date(new Date(row.started_at).getTime() - 180_000).toISOString();
    const end = new Date(new Date(row.started_at).getTime() + (Number(row.duration_seconds ?? 0) + 180) * 1000).toISOString();
    const qs = `datetime-start=${encodeURIComponent(start)}&datetime-end=${encodeURIComponent(end)}&limit=200`;
    const legacy = `start-time=${encodeURIComponent(start)}&end-time=${encodeURIComponent(end)}&limit=200`;
    paths.push(`/domains/${D}/cdrs?${qs}`, `/domains/${D}/cdrs?${legacy}`);
    if (row.extension) paths.push(`/domains/${D}/users/${encodeURIComponent(row.extension)}/cdrs?${qs}`);
  }
  const matches: any[] = [];
  for (const p of Array.from(new Set(paths))) {
    try {
      const r = await nsJson(p);
      attempts.push({ url: p, status: r.status, ct: r.ct, kind: "cdr_lookup" });
      if (!r.ok) continue;
      for (const c of asArray(r.data)) {
        const score = cdrScore(c, row, ids);
        if (score >= 30) matches.push({ score, cdr: c, path: p });
      }
    } catch (e) {
      attempts.push({ url: p, error: (e as Error).message, kind: "cdr_lookup" });
    }
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}

function recordingHeaders(upstream: Response, meta: any, extra: Record<string, string | null | undefined> = {}) {
  const ct = upstream.headers.get("Content-Type") ?? "audio/mpeg";
  const h: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": ct.includes("audio") || ct.includes("octet-stream") ? ct : "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  const len = upstream.headers.get("Content-Length");
  if (len) h["Content-Length"] = len;
  const duration = meta?.["file-duration-seconds"] ?? meta?.duration_sec ?? meta?.duration;
  const size = meta?.["file-size-kilobytes"] ?? meta?.file_size_kb;
  const status = meta?.["call-recording-status"] ?? meta?.recording_status;
  if (duration != null) h["X-NS-Duration-Seconds"] = String(duration);
  if (size != null) h["X-NS-File-Size-KB"] = String(size);
  if (status != null) h["X-NS-Recording-Status"] = String(status);
  for (const [k, v] of Object.entries(extra)) if (v != null) h[k] = String(v);
  return h;
}

async function streamFromUrl(audioUrl: string, meta: any, extra: Record<string, string | null | undefined>, attempts: any[]) {
  const fullUrl = audioUrl.startsWith("http")
    ? audioUrl
    : `${NS_API_BASE_URL}${audioUrl.startsWith("/") ? "" : "/"}${audioUrl.replace(/^\/?ns-api\/v2\/?/, "")}`;
  // Signed ucstack/file-access-url URLs must be fetched without NS bearer.
  let a = await fetch(fullUrl);
  attempts.push({ url: audioUrl.startsWith("http") ? "file-access-url-noauth" : fullUrl, status: a.status, ct: a.headers.get("Content-Type") ?? "" });
  if (!a.ok && !audioUrl.startsWith("http")) {
    a = await fetch(fullUrl, { headers: { Authorization: `Bearer ${NS_API_KEY}`, Accept: "audio/*" } });
    attempts.push({ url: "audio-url-bearer", status: a.status, ct: a.headers.get("Content-Type") ?? "" });
  }
  if (!a.ok || !a.body) return null;
  return new Response(a.body, { status: 200, headers: recordingHeaders(a, meta, extra) });
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
  let row: any = null;
  let domain = String(body.domain ?? url.searchParams.get("domain") ?? NS_DOMAIN);
  const attempts: any[] = [];

  if ((!ns_callid || !ns_extension) && call_db_id) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data } = await admin
      .from("planipret_phone_calls")
      .select("id, ns_call_id, ns_callid, ns_orig_callid, ns_term_callid, ns_domain, extension, metadata, recording_url, started_at, duration_seconds, from_number, to_number")
      .eq("id", call_db_id)
      .maybeSingle();
    row = data;
    domain = row?.ns_domain || row?.metadata?.domain || domain;
    ns_callid = ns_callid || row?.ns_callid || row?.ns_orig_callid || row?.ns_term_callid
      || row?.metadata?.["call-orig-call-id"] || row?.metadata?.["call-term-call-id"] || row?.metadata?.["call-parent-cdr-id"] || null;
    ns_extension = ns_extension || row?.extension || row?.metadata?.["call-orig-user"]?.toString() || null;
    // If DB already has a fully-resolved http recording_url, short-circuit.
    if (row?.recording_url && String(row.recording_url).startsWith("http")) {
      const direct = await streamFromUrl(row.recording_url, row.metadata?.ns_recording ?? null, { "X-NS-Source": "cached" }, attempts);
      if (direct) return direct;
    }
  }

  const ids: string[] = [];
  pushId(ids, ns_callid);
  pushId(ids, body.ns_orig_callid ?? url.searchParams.get("ns_orig_callid"));
  pushId(ids, body.ns_term_callid ?? url.searchParams.get("ns_term_callid"));
  addIds(ids, row?.metadata, row, { id: ns_callid });
  addIdsFromPath(ids, row?.metadata?.transcription_path ?? row?.metadata?.["prefilled-transcription-api"]);

  const cdrMatches = await hydrateCdrs(row, domain, ids, attempts);
  for (const m of cdrMatches) addIds(ids, m.cdr);

  if (!ids.length) {
    return json({
      error: "MISSING_CALLID",
      message: "Identifiant NS-API introuvable pour cet appel. Relancez la synchronisation CDR.",
      call_db_id, ns_callid, ns_extension, attempts,
    }, 200);
  }

  const headers = { Authorization: `Bearer ${NS_API_KEY}`, Accept: "audio/*, application/json" };
  const D = encodeURIComponent(domain);
  const E = ns_extension ? encodeURIComponent(ns_extension) : null;

  const paths: Array<{ path: string; lookupId: string }> = [];
  const storedPath = normalizeNsPath(row?.metadata?.recording_api_path);
  if (storedPath) paths.push({ path: storedPath, lookupId: ns_callid ?? ids[0] });
  for (const id of ids) {
    const enc = encodeURIComponent(id);
    paths.push({ path: `/domains/${D}/recordings/${enc}`, lookupId: id });
    if (E) paths.push({ path: `/domains/${D}/users/${E}/recordings/${enc}`, lookupId: id });
    paths.push({ path: `/domains/${D}/recordings?callid=${enc}`, lookupId: id });
  }

  let recordingMeta: any = null;

  for (const { path: p, lookupId } of Array.from(new Map(paths.map((x) => [`${x.path}|${x.lookupId}`, x])).values())) {
    const target = `${NS_API_BASE_URL}${p}`;
    try {
      const r = await fetch(target, { headers });
      const ct = r.headers.get("Content-Type") ?? "";
      attempts.push({ url: p, status: r.status, ct, lookup_id: lookupId });

      if (r.ok && (ct.startsWith("audio") || ct.includes("octet-stream"))) {
        if (!r.body) continue;
        return new Response(r.body, { status: 200, headers: recordingHeaders(r, recordingMeta, { "X-NS-CallID": lookupId, "X-NS-Source-Path": p }) });
      }
      if (r.ok) {
        const parsed = await r.json().catch(() => null);
        const recording = Array.isArray(parsed) ? parsed[0] : parsed;
        if (recording && !recordingMeta) recordingMeta = recording;
        const audioUrl = pickAudioUrl(recording);
        if (audioUrl) {
          const streamed = await streamFromUrl(audioUrl, recording, { "X-NS-CallID": lookupId, "X-NS-Source-Path": p }, attempts);
          if (streamed) return streamed;
        }
      }
    } catch (e) {
      attempts.push({ url: p, error: (e as Error).message });
    }
  }

  if (recordingMeta) {
    return json({
      error: "NO_FILE_ACCESS_URL",
      message: "L'enregistrement existe mais l'URL d'accès n'est pas disponible (traitement en cours ou fichier vide).",
      ns_callid, ns_extension, domain,
      attempted_ids: ids,
      recording_status: recordingMeta["call-recording-status"] ?? null,
      file_size_kb: recordingMeta["file-size-kilobytes"] ?? null,
      duration_sec: recordingMeta["file-duration-seconds"] ?? null,
      recording_meta: recordingMeta,
      attempts,
    }, 200);
  }

  return json({
    error: "RECORDING_NOT_FOUND",
    message: cdrMatches.length
      ? "Aucun fichier audio n'a été retourné par NS-API pour les identifiants d'appel trouvés."
      : "Enregistrement non disponible sur NetSapiens.",
    ns_callid, ns_extension, domain, attempted_ids: ids, cdr_matches: cdrMatches.map((m) => ({ score: m.score, path: m.path })), attempts,
    possible_causes: [
      "L'appel n'a pas été enregistré (règle d'enregistrement inactive pour cette extension/direction)",
      "Le fichier a expiré ou été purgé côté NetSapiens",
      "Le ns_callid stocké ne correspond à aucun enregistrement — vérifier la synchro CDR et les call-id orig/term",
    ],
  }, 200);
});
