// pp-coach-call — Phase 8: Claude/Lovable-AI coaching layer.
// Takes an existing transcript from planipret_phone_calls and produces:
//   - corrected_transcript (grammar/typo cleanup, preserve speakers)
//   - summary (2-4 sentences, FR)
//   - coaching { strengths[], improvements[], next_steps[] }
//   - score (0-100)
// Persists ai_summary, ai_coaching, lead_score, transcript (if corrected).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const json = (p: any, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `Tu es un coach expert pour courtiers hypothécaires chez Planiprêt.
Tu analyses des transcriptions d'appels téléphoniques (français canadien) entre un courtier et un client.
Ta mission :
1. Corriger la transcription (fautes, ponctuation, formatage speaker) SANS changer le sens.
2. Produire un résumé factuel (2-4 phrases).
3. Évaluer la performance du courtier avec un coaching constructif.
4. Donner un score global sur 100 (rigueur, écoute, closing, conformité).

Réponds STRICTEMENT en JSON valide, sans markdown, avec ce schéma:
{
  "corrected_transcript": "string",
  "summary": "string",
  "coaching": {
    "strengths": ["string", ...],
    "improvements": ["string", ...],
    "next_steps": ["string", ...]
  },
  "score": number
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const call_id = body.call_id;
  if (!call_id) return json({ error: "call_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: row, error } = await admin
    .from("planipret_phone_calls")
    .select("id, transcript, transcript_segments, from_number, to_number, duration_seconds, direction, extension")
    .eq("id", call_id)
    .maybeSingle();
  if (error || !row) return json({ error: "call not found", details: error?.message }, 404);
  if (!row.transcript || row.transcript.trim().length < 20) {
    return json({ success: false, error: "TRANSCRIPT_MISSING", message: "Aucune transcription à analyser. Lancez d'abord la transcription NS-API." }, 200);
  }

  const context = `Appel ${row.direction ?? "?"} · Ext ${row.extension ?? "?"} · ${row.duration_seconds ?? "?"}s · De ${row.from_number ?? "?"} vers ${row.to_number ?? "?"}`;
  const userPrompt = `${context}\n\n--- TRANSCRIPTION BRUTE ---\n${row.transcript}\n--- FIN ---\n\nAnalyse cet appel et renvoie le JSON demandé.`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    if (aiResp.status === 429) return json({ error: "AI rate-limited, réessayez plus tard" }, 429);
    if (aiResp.status === 402) return json({ error: "Crédits IA épuisés — ajoutez du crédit au workspace" }, 402);
    return json({ error: "AI gateway failure", details: errText, status: aiResp.status }, 502);
  }

  const aiJson = await aiResp.json();
  const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return json({ error: "AI returned invalid JSON", raw }, 502); }

  const corrected = typeof parsed.corrected_transcript === "string" ? parsed.corrected_transcript : null;
  const summary = typeof parsed.summary === "string" ? parsed.summary : null;
  const coaching = parsed.coaching && typeof parsed.coaching === "object" ? parsed.coaching : null;
  const score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null;

  const update: any = { updated_at: new Date().toISOString() };
  if (corrected && corrected.length > 20) update.transcript = corrected;
  if (summary) { update.ai_summary = summary; update.ai_summary_short = summary.slice(0, 200); }
  if (coaching) update.ai_coaching = coaching;
  if (score != null) update.lead_score = score;

  const { error: upErr } = await admin.from("planipret_phone_calls").update(update).eq("id", call_id);
  if (upErr) return json({ error: "DB update failed", details: upErr.message }, 500);

  return json({
    success: true,
    call_id,
    corrected_transcript: corrected,
    summary,
    coaching,
    score,
  });
});
