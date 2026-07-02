# Enregistrements + Transcriptions NS-API + Coaching Claude IA

Objectif: réparer la lecture audio, câbler correctement la transcription NS-API, ajouter une couche IA Claude (correction + résumé + coaching), et refondre l'écran de détail d'appel avec 4 onglets riches.

## État actuel (déjà en place)

- `supabase/functions/ns-recordings` : proxy audio avec Bearer NS-API (déjà bon backend).
- `supabase/functions/ns-transcription` : version minimale (un seul endpoint, texte brut).
- `supabase/functions/ai-analyze-call` : existe mais schéma limité, cible `pbx_call_records`, pas de coaching détaillé.
- `supabase/functions/ns-live-test` : existe, servira pour la diagnostic.
- MCalls (mobile) : 4 onglets déjà présents (audio/transcript/coaching/maestro), mais lit `<audio src={recording_url}>` (URL non authentifiée) et affiche le transcript en texte brut.
- Colonnes déjà présentes sur `planipret_phone_calls` : `transcript_segments`, `coaching_score`, `analyzed_at`, `ai_summary`, `lead_score`, `lead_temperature`, `lead_score_reason`.
- Colonnes à ajouter : `ai_analysis_json`, `ai_summary_short`, `next_actions`.

## Phase 1 — Diagnostic NS-API (Step 1)

Étendre `supabase/functions/ns-live-test/index.ts` avec une section `recordings_transcriptions_probe` :

- `GET /domains/{domain}/cdrs?limit=5` → dump `Object.keys(cdrs[0])` + un CDR complet.
- Tester en parallèle : `/domains/{d}/recordings`, `/domains/{d}/cdrs?type=recording`, `/recordings?domain={d}`, `/domains/{d}/transcriptions`, `/domains/{d}/cdrs?transcription=true`.
- Retourner statuts HTTP + premier objet pour chaque endpoint.

UI : nouvelle carte "Sondage enregistrements & transcriptions" dans `PlanipretIntegrations.tsx` (bouton Lancer, affichage brut expandable). Permet d'identifier les noms de champs exacts sur le serveur planipret.ca avant de coder les fallbacks.

## Phase 2 — Lecture audio corrigée

- Nouveau composant `src/components/planipret/mobile/call/CallRecordingPlayer.tsx` :
  - Utilise l'API existante `recordingsApi.fetchAudio(callId)` (retourne Blob) → `URL.createObjectURL(blob)`.
  - Nettoie l'URL blob à l'unmount.
  - États : loading (skeleton), error (bouton Réessayer), ready.
  - UI : waveform décorative (50 barres), scrubber, temps, contrôles ⏮15s / play-pause / ⏭15s / vitesse (1×/1.25×/1.5×/2×), bouton download.
  - Utilise les tokens `--pp-*` du thème mobile.
- Remplacer les `<audio src={call.recording_url}>` dans `MCalls.tsx` (ligne 681) et `RecordingsList.tsx` (ligne 318) par `<CallRecordingPlayer callId={call.ns_call_id ?? call.id} duration={call.duration ?? 0} />`.
- Supprimer la persistance de `recording_url` non authentifié dans `fetchRecording` (garder seulement un flag `has_recording`).

## Phase 3 — Transcription NS-API en segments

Refondre `supabase/functions/ns-transcription/index.ts` :

- 4 tentatives en cascade (comme dans le prompt) :
  1. Champ `transcript*` sur `/cdrs/{id}`.
  2. `/cdrs/{id}/transcription`.
  3. `/users/{ext}/recordings/{id}/transcription`.
  4. `/transcriptions?cdr_id={id}`.
- Parse en `segments: [{ speaker, text, start?, end? }]` :
  - String → split par `\n`, détection `Speaker: text`.
  - Array → mapping des champs `speaker_label`/`start_time`/etc.
  - Object → `segments`/`words`.
- Persiste `transcript_segments` + `transcript` (texte concaténé) sur `planipret_phone_calls`.
- Réponse JSON : `{ success, segments, raw_source, word_count }` ou `{ success: false, hint: "Activer PORTAL_VOICE_TRANSCRIPTION_SENTIMENT" }`.

Frontend `MCalls.tsx` onglet Transcript :
- Auto-fetch à l'ouverture de l'onglet si `transcript_segments` vide.
- Rendu en bulles chat : courtier à droite (gradient bleu), client à gauche (bg-elevated), rayon 18/18/4/18 (inverse pour l'autre côté), timestamp sous chaque bulle.
- Empty states : "chargement" (skeleton bubbles), "désactivé côté NS" (encadré ambre avec hint), "aucun contenu".
- Footer : compteur de mots + durée d'appel.

## Phase 4 — Coaching Claude IA

Refondre `supabase/functions/ai-analyze-call/index.ts` pour supporter la branche Planiprêt :

- Détection : si `body.segments` fourni OU si `call_id` correspond à une ligne `planipret_phone_calls`, exécuter le prompt coaching.
- Utiliser Lovable AI Gateway (`LOVABLE_API_KEY`, modèle `google/gemini-2.5-pro` par défaut) pour éviter une clé Anthropic dédiée — même schéma de sortie.
- Prompt système + prompt user en français (québécois pro) comme dans la spec, produisant `{ corrected_transcript, summary, lead_analysis, coaching, compliance }`.
- Sauvegarde vers `planipret_phone_calls` :
  - `transcript_segments = corrected_transcript`
  - `ai_summary = summary.detailed`, `ai_summary_short = summary.short`
  - `ai_analysis_json = analysis` (jsonb)
  - `coaching_score = coaching.overall_score`
  - `lead_score`, `lead_temperature = lead_analysis.temperature`
  - `next_actions = summary.next_steps` (jsonb)
  - `analyzed_at = now()`
- Conserver la branche `pbx_call_records` existante pour ne rien casser côté Lemtel.

## Phase 5 — Migration SQL

Ajouter les colonnes manquantes sur `planipret_phone_calls` :

```sql
ALTER TABLE public.planipret_phone_calls
  ADD COLUMN IF NOT EXISTS ai_analysis_json jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary_short text,
  ADD COLUMN IF NOT EXISTS next_actions jsonb;
```

Pas de nouvelle table, pas de nouvelle politique RLS (les policies existantes couvrent les nouvelles colonnes).

## Phase 6 — Refonte UI onglet Coaching

Dans `MCalls.tsx`, remplacer l'onglet Coaching par la lecture de `call.ai_analysis_json` :

- Section A — Score global : cercle SVG 80px (couleur selon seuil ≥8/≥6/<6), libellé Excellent/Bien/À améliorer, mini-barres de sous-scores (écoute, questions, empathie, connaissance, conclusion).
- Section B — Points forts (✅, vert #00D4AA).
- Section C — À améliorer (⚠️, ambre #F5A623).
- Section D — Formulations suggérées : cartes avec contexte + phrase + bouton Copier.
- Section E — Message d'AVA (bordure gauche violet #9B7FE8, italique).
- Section F — Analyse du lead : température + score bar + signaux d'achat + objections + recommandation.
- Section G — Résumé : court/détaillé + pills d'info clé (budget/propriété/délai) + liste prochaines étapes.
- Empty state (pas encore analysé) : icône robot + CTA `Analyser avec Claude IA` → appelle `ai-analyze-call` avec `segments` et bascule sur l'onglet.
- Bouton sticky bas de l'onglet Transcript : `Analyser avec Claude IA` avec états `Correction… / Analyse… / Coaching…`, puis switch auto vers Coaching.

## Phase 7 — Onglet Maestro consolidé

- État "synchronisé" : afficher le client Maestro lié (via `maestro_client_id`), tâches créées (depuis `next_actions` + `planipret_maestro_sync_log`), timeline des events.
- État "non synchronisé" + `ai_summary` présent : bouton `Pousser vers Maestro` → invoque `maestro-pipeline-orchestrator` avec `call_id`.
- État "Maestro non configuré" : lien vers `/planipret/integrations`.

## Phase 8 — Empty states & erreurs (Step 7 de la spec)

Uniformiser sur les 4 onglets :
- Enregistrement absent : encadré teal info.
- Transcription désactivée : encadré ambre + hint NetSapiens.
- Erreur Claude : bannière rouge + Réessayer.
- Maestro absent : lien deep-link vers Intégrations.

## Notes techniques

- Passer par Lovable AI Gateway (`LOVABLE_API_KEY`) au lieu d'une clé Anthropic dédiée pour éviter un secret utilisateur supplémentaire ; si l'utilisateur exige Claude Sonnet, on ajoutera `ANTHROPIC_API_KEY` via add_secret à l'implémentation.
- Toutes les Edge Functions utilisent `corsHeaders` de `npm:@supabase/supabase-js@2/cors` (pas de `deno.land/x/sift`).
- `recordingsApi.fetchAudio` existe déjà — le nouveau composant s'appuie dessus, pas besoin d'un nouveau proxy `ns-get-recording`.
- Les i18n mp_DICT (fr/en) s'étendront pour toutes les nouvelles chaînes de coaching.

## Ordre d'implémentation

1. Migration SQL (Phase 5) — trivial, dé-bloque tout.
2. Étendre `ns-live-test` (Phase 1) + carte UI dans Intégrations.
3. `CallRecordingPlayer` + swap des `<audio>` (Phase 2).
4. Refonte `ns-transcription` en segments (Phase 3) + onglet Transcript en bulles.
5. Refonte `ai-analyze-call` avec prompt coaching complet (Phase 4).
6. Onglet Coaching riche (Phase 6).
7. Onglet Maestro consolidé (Phase 7).
8. Empty states unifiés (Phase 8).
9. Test bout à bout avec un appel réel planipret.ca.
