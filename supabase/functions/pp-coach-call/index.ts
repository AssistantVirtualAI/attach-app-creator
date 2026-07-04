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
Tu analyses des transcriptions d'appels téléphoniques (français canadien) entre un COURTIER et un CLIENT.

Ta mission :
1. Corriger la transcription (fautes, ponctuation, formatage) SANS changer le sens.
2. Remplacer les libellés de locuteurs génériques (ex: "Speaker 1", "Speaker 2", "sip:1040", "Agent", "Caller", "Inconnu") par les vrais noms fournis dans le contexte (COURTIER = nom du courtier, CLIENT = nom du client). Utilise le format "Nom Prénom:" au début de chaque tour de parole.
3. Produire un résumé factuel (2-4 phrases) qui mentionne explicitement le courtier et le client par leur nom.
4. Évaluer la performance du courtier avec coaching constructif (points forts, améliorations).
5. Fournir des prochaines actions concrètes ("next_steps") à effectuer par le courtier après cet appel.
6. Donner un score global sur 100 (rigueur, écoute, closing, conformité).

Réponds STRICTEMENT en JSON valide, sans markdown, avec ce schéma:
{
  "corrected_transcript": "string (avec vrais noms comme libellés de locuteurs)",
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
  const bodyTranscript = typeof body.transcript === "string" ? body.transcript : null;
  if (!call_id) return json({ error: "call_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: row, error } = await admin
    .from("planipret_phone_calls")
    .select("id, transcript, transcript_segments, from_number, to_number, duration_seconds, direction, extension")
    .eq("id", call_id)
    .maybeSingle();
  if (error || !row) return json({ error: "call not found", details: error?.message }, 404);
  // Fallback: si la DB n'a pas encore le transcript, utiliser celui fourni dans le body
  const effectiveTranscript = (row.transcript && row.transcript.trim().length >= 20)
    ? row.transcript
    : (bodyTranscript && bodyTranscript.trim().length >= 20 ? bodyTranscript : null);
  if (!effectiveTranscript) {
    return json({ success: false, error: "TRANSCRIPT_MISSING", message: "Aucune transcription à analyser. Lancez d'abord la transcription NS-API." }, 200);
  }
  (row as any).transcript = effectiveTranscript;

  // Enrich: broker (by extension) + client (by phone number)
  let brokerName = "Courtier";
  let clientName = "Client";
  try {
    const ext = String(row.extension ?? "").trim();
    if (ext) {
      const { data: prof } = await admin
        .from("planipret_profiles")
        .select("full_name, email, extension, ns_extension")
        .or(`extension.eq.${ext},ns_extension.eq.${ext}`)
        .maybeSingle();
      if (prof?.full_name) brokerName = prof.full_name;
      else if (prof?.email) brokerName = prof.email;
    }
    const clientPhone = String(row.direction === "outbound" ? row.to_number : row.from_number ?? "").replace(/[^\d+]/g, "");
    if (clientPhone && clientPhone.length >= 7) {
      const last10 = clientPhone.slice(-10);
      const { data: contact } = await admin
        .from("planipret_contacts")
        .select("first_name, last_name, full_name, phone, mobile")
        .or(`phone.ilike.%${last10}%,mobile.ilike.%${last10}%`)
        .maybeSingle();
      if (contact) {
        const fn = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
        clientName = contact.full_name || fn || clientName;
      }
    }
  } catch (_) { /* enrichment is best-effort */ }

  const context = `COURTIER: ${brokerName} (ext ${row.extension ?? "?"})
CLIENT: ${clientName} (${row.direction === "outbound" ? row.to_number : row.from_number ?? "?"})
Direction: ${row.direction ?? "?"} · Durée: ${row.duration_seconds ?? "?"}s`;
  const userPrompt = `${context}\n\n--- TRANSCRIPTION BRUTE ---\n${row.transcript}\n--- FIN ---\n\nAnalyse cet appel et renvoie le JSON demandé. IMPORTANT: dans corrected_transcript, remplace TOUS les libellés génériques (Speaker 1, sip:xxxx, Agent, Caller...) par "${brokerName}" et "${clientName}".`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
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
  if (score != null) update.lead_score = Math.max(1, Math.min(10, Math.round(score / 10)));

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
