// ns-get-transcription — official NS-API v2 transcription fetch (Bearer NS_API_KEY).
// GET /domains/{d}/transcriptions?callid={callid} with variants.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NS_API_KEY = Deno.env.get("NS_API_KEY");
const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
const NS_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? Deno.env.get("NS_API_DOMAIN") ?? "planipret.ca";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (p: any, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function extractTranscript(item: any): any {
  if (!item) return null;
  if (typeof item === "string") return item.length > 5 ? item : null;
  return item["transcription-text"]
    ?? item["transcript"]
    ?? item["text"]
    ?? item["asr-text"]
    ?? item["sentiment-transcript"]
    ?? item.segments
    ?? null;
}

function parseTranscript(raw: any): Array<{ speaker: string; text: string }> {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw.split(/\r?\n/).filter((l) => l.trim()).map((line) => {
      const m = line.match(/^([^:]{1,40}):\s*(.+)$/);
      return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: "Speaker", text: line.trim() };
    });
  }
  if (Array.isArray(raw)) {
    return raw.map((s: any) => ({
      speaker: s.speaker ?? s.speaker_label ?? s.role ?? "Speaker",
      text: s.text ?? s.content ?? s.transcript ?? "",
    })).filter((s) => s.text);
  }
  if (raw.transcript) return parseTranscript(raw.transcript);
  if (raw.segments) return parseTranscript(raw.segments);
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!NS_API_KEY) return json({ error: "NS_API_KEY not configured" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const url = new URL(req.url);
  const call_db_id = body.call_db_id ?? url.searchParams.get("call_db_id");
  let ns_callid: string | null = body.ns_callid ?? url.searchParams.get("ns_callid") ?? url.searchParams.get("call_id");
  let ns_extension: string | null = body.ns_extension ?? url.searchParams.get("ns_extension");

  if ((!ns_callid || !ns_extension) && call_db_id) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row } = await admin
      .from("planipret_phone_calls")
      .select("ns_callid, ns_orig_callid, ns_term_callid, extension, metadata")
      .eq("id", call_db_id)
      .maybeSingle();
    ns_callid = ns_callid || row?.ns_callid || row?.ns_orig_callid || row?.ns_term_callid || row?.metadata?.["call-parent-cdr-id"] || null;
    ns_extension = ns_extension || row?.extension || null;
  }

  const headers = { Authorization: `Bearer ${NS_API_KEY}`, Accept: "application/json" };
  const attempts: any[] = [];
  let transcript: any = null;

  const D = encodeURIComponent(NS_DOMAIN);
  const queries: string[] = [];
  if (ns_callid) {
    const c = encodeURIComponent(ns_callid);
    queries.push(`/domains/${D}/transcriptions?callid=${c}`);
    queries.push(`/domains/${D}/transcriptions?call-id=${c}`);
    queries.push(`/domains/${D}/transcriptions?orig-callid=${c}`);
    if (ns_extension) queries.push(`/domains/${D}/users/${encodeURIComponent(ns_extension)}/transcriptions?callid=${c}`);
  }

  for (const q of queries) {
    const target = `${NS_API_BASE_URL}${q}`;
    try {
      const r = await fetch(target, { headers });
      const rawText = await r.text();
      let data: any = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }
      attempts.push({
        url: q,
        status: r.status,
        body_preview: rawText.slice(0, 200),
        has_data: !!data,
      });
      if (!r.ok || !data) continue;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const found = extractTranscript(item);
        if (found) { transcript = found; break; }
      }
      if (transcript) break;
    } catch (e) {
      attempts.push({ url: q, error: (e as Error).message });
    }
  }

  if (!transcript) {
    return json({
      success: false,
      error: "TRANSCRIPT_NOT_AVAILABLE",
      message: "Transcription non disponible pour cet appel.",
      ns_callid, ns_extension, attempts,
      action_required: "Demandez à Clinton d'activer PORTAL_VOICE_TRANSCRIPTION_SENTIMENT = yes sur planipret.ca",
    }, 200);
  }

  const segments = parseTranscript(transcript);
  return json({ success: true, ns_callid, segments, raw: transcript });
});
