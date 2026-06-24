# Intégration Maestro/Kanguru — Plan multiphases

**Portée :** Organisation AVA Main Dashboard uniquement. Aucune modification de Lemtel Communications, des tables `planipret_*` existantes (uniquement ajouts de colonnes), des Edge Functions NS-API, ElevenLabs, M365, auth/routing ou du dark mode actuel.

**Livraison :** 8 phases autonomes, chacune testable en preview avant la suivante. Backend d'abord (P1-P3), puis surface UI (P4-P7), puis admin/QA (P8).

---

## Phase 1 — Fondations DB & secrets

Préparer le terrain avant toute Edge Function.

**Migration SQL** (un seul lot) :

- Colonnes ajoutées à `planipret_phone_calls` :
  `maestro_synced bool default false`, `maestro_call_id text`, `maestro_client_id text`, `transcript_segments jsonb`, `transcript_language text default 'fr-CA'`, `ai_coaching jsonb`, `ai_key_points jsonb`, `ai_client_insights jsonb`, `lead_score int`, `lead_temperature text`, `lead_score_reason text`, `pipeline_state jsonb default '{}'` (suit CDR/Transcript/IA/Maestro).
- Colonnes ajoutées à `planipret_profiles` :
  `maestro_broker_token text`, `maestro_broker_id text`, `maestro_token_expires_at timestamptz`.
- Index : `idx_pp_calls_maestro_client (maestro_client_id)`, `idx_pp_calls_pipeline (user_id, created_at desc) where recording_url is not null or transcript is not null or ai_summary is not null`.

**Secrets requis** (via `add_secret`) :
`MAESTRO_API_URL`, `MAESTRO_API_KEY` (clé service), `MAESTRO_WEBHOOK_SECRET`, `OPENAI_API_KEY` (fallback Whisper). `LOVABLE_API_KEY` déjà présent pour Claude via Gateway.

**Helpers partagés** : `supabase/functions/_shared/maestro.ts` (fetch wrapper avec retry, refresh token broker, Idempotency-Key, error mapping). `supabase/functions/_shared/cors.ts` réutilisé.

## Phase 2 — Edge Functions cœur (CDR + lookup + recording)

Les 4 fonctions appelées en temps réel pendant/après l'appel. Aucune dépendance IA.

1. **`maestro-client-lookup`** (GET, < 2s p95) — recherche par `phone` E.164, met à jour `planipret_phone_calls.maestro_client_id` si match.
2. **`maestro-client-create`** (POST) — création prospect minimal.
3. **`maestro-cdr`** (POST) — appelé par `ns-webhook-receiver` à la fin de l'appel : lookup → POST `/api/v1/calls/cdr` avec `Idempotency-Key: {call_id}` → marque `maestro_synced=true`, gère 409.
4. **`maestro-recording`** (GET) — récupère URL signée, met en cache, refresh si `expires_at` dépassé.

**Hook NS-webhook :** modifier `ns-webhook-receiver` pour invoquer `maestro-cdr` en fire-and-forget après insertion CDR (pas de blocage du webhook NetSapiens).

## Phase 3 — Pipeline IA (transcript + analyse + tasks)

Le pipeline async qui transforme un CDR en coaching exploitable.

5. **`maestro-transcript`** (POST) — pipeline :
   - Vérifie `transcript` existant → skip.
   - Essaie NS-API `/domains/planipret.ca/transcriptions?callId=` en premier.
   - Fallback OpenAI Whisper (`fr-CA`, fallback `en-CA`) en envoyant l'URL signée Maestro.
   - Stocke `transcript`, `transcript_segments`, `transcript_language`.
   - Push `POST /api/v1/calls/{id}/transcript` à Maestro.
   - Fire-and-forget `maestro-ai-analysis`.
6. **`maestro-ai-analysis`** (POST) — appel Claude Sonnet 4.6 via Lovable AI Gateway (model `anthropic/claude-sonnet-4-5` ou équivalent dispo) avec le prompt système courtier hypothécaire et schema JSON strict (tool calling pour garantir parsing). Stocke `ai_summary`, `ai_coaching`, `ai_tasks`, `ai_key_points`, `ai_sentiment`, `ai_client_insights`, `lead_score`, `lead_temperature`. Push `/ai_summary` à Maestro. Auto-crée les tasks `priority='high'` via `maestro-task`. Broadcast Realtime `ai-insights:{user_id}` `{type:'analysis_ready', call_id, lead_score, lead_temperature, coaching_score}`.
7. **`maestro-task`** (POST) — création tâche Maestro liée à un client + call.
8. **`maestro-appointment`** (POST) — création RDV Maestro.

**Chaînage auto déclenché par `ns-webhook-receiver`** :
CDR → `maestro-cdr` → `maestro-client-lookup` (déjà fait inline) → `maestro-transcript` (différé 10s pour laisser NS-API publier le recording) → `maestro-ai-analysis` → tasks high-prio. `pipeline_state` mis à jour à chaque étape.

## Phase 4 — Edge Functions complémentaires (history + counts + webhooks entrants)

9. **`maestro-client-history`** (GET) — merge `/communications` + `/ai_history`, trié DESC.
10. **`maestro-counts`** (GET) — `/brokers/{id}/counts` pour badges Home.
11. **`maestro-webhook-receiver`** (POST, `verify_jwt=false`) — vérif HMAC `X-Maestro-Signature` avec `MAESTRO_WEBHOOK_SECRET`, route par `event` :
   - `client.created` / `appointment.updated|cancelled|reminder` / `task.assigned|completed`.
   - Insère dans `planipret_audit_log`, broadcast Realtime `maestro-events:{broker_id}`, optionnel push web via `usePlanipretPush`.
   - Toujours `return 200` immédiatement, traitement en `EdgeRuntime.waitUntil`.

## Phase 5 — Onglet Enregistrements (refonte complète)

Le hub Recording → Transcript → IA → Coaching dans `MCalls.tsx` (4ᵉ tab existant).

**Architecture** : extraire `RecordingsTab` en composant dédié `src/components/planipret/mobile/recordings/`.

- **Carte enrichie** :
  - Pipeline progress bar haut de carte : `[CDR][Transcript][IA][Maestro]`, pilote depuis `pipeline_state`.
  - Status pills tappables `[🎙️][📝][🤖]` qui scrollent vers la section.
  - Badge lead score (🔥/🌡️/❄️) selon `lead_temperature`.
- **Accordion 4 sections** (composants séparés) :
  - `RecordingSection` — player custom (waveform CSS animé, ±15s, vitesse 0.75/1/1.5/2×, download). Bouton "Charger" → `maestro-recording`.
  - `TranscriptSection` — segments par speaker (bulles courtier bleu gauche / client gris droite), toggle FR/EN, copier, rechercher (highlight regex). Bouton "Obtenir" → `maestro-transcript` avec progress steps.
  - `AISection` — 4 sous-blocs (Résumé, Coaching avec score circle gradient, Insights client avec chips objections/buying signals + barre lead, Actions suggérées avec boutons "Créer dans Maestro" / "Tout créer"). Bouton "Analyser avec l'IA" si transcript présent, sinon "Transcription + IA" combo.
  - `MaestroSyncSection` — état sync, lien client, modal lookup/create.
- **Subscription Realtime** : `ai-insights:{user_id}` met à jour la carte en place + toast `🤖 Analyse prête — {score}/10`, `🔥 Lead chaud!` si ≥8.
- Tokens `--pp-*` uniquement, animations 200ms.

## Phase 6 — Inbound overlay + Contacts Maestro + Home recos

Intégrer la donnée Maestro dans les surfaces existantes (zéro nouvelle page).

- **`InboundCallOverlay`** (déjà géré par `MCalls` ActiveTab) :
  - Au INSERT `planipret_phone_calls` inbound → `maestro-client-lookup(from_number)` en parallèle avec l'animation ring.
  - Si trouvé : nom large, company, mortgage_stage badge, "📋 {X} appels précédents", température.
  - Sinon : "👤 Nouveau contact" + bouton `+ Créer dans Maestro` → `maestro-client-create`.
- **`MContacts` — onglet Maestro CRM** : remplace la query locale `planipret_contacts` par `maestro-client-history` à l'ouverture du détail. Carte détail enrichie : timeline (📞💬📧📋), dernière analyse IA, quick actions (Appeler/SMS/Email/Tâche/RDV/Voir Maestro).
- **`MHome` — AI Recommendations** : remplace mock par `maestro-counts` (badges) + `pp-ava-proactive` enrichi avec lead scores récents, tâches en retard, RDV du jour. 3 recos dynamiques au format spec.

## Phase 7 — Admin Integrations (page web `/planipret/admin/integrations`)

Étendre la section Maestro existante.

- **Section "Configuration OAuth courtiers"** : liste des `planipret_profiles` (extension + nom), statut token (`maestro_broker_token` non null + non expiré), bouton `🔗 Connecter Maestro` par broker → modal :
  - Onglet "Clé API directe" : input + validation via call test `GET /api/v1/brokers/me`.
  - Onglet "OAuth" (si MAESTRO supporte) : redirect `/auth/maestro/callback` Edge Function.
- **Bouton "Test pipeline complet"** : sélectionne un call récent du broker → enchaîne CDR → transcript → IA → task de test, affiche timeline succès/échec étape par étape (modal avec spinners).
- **Section "Webhooks entrants"** :
  - Liste des events attendus avec ✅/❌ basé sur `planipret_audit_log` (présence d'au moins 1 event reçu dans les 30j).
  - URL receiver `{SUPABASE_URL}/functions/v1/maestro-webhook-receiver` avec bouton copier.
  - Affichage du `MAESTRO_WEBHOOK_SECRET` masqué + bouton régénérer.
- **Logs récents Maestro** : table dernières 50 lignes `planipret_audit_log WHERE action LIKE 'maestro_%'`.

## Phase 8 — QA, observabilité, sécurité

Verrouiller avant production.

1. **RLS** : aucune nouvelle table → uniquement vérifier que les nouvelles colonnes ne fuitent pas via les policies existantes (`SELECT` user-scoped sur `planipret_phone_calls`).
2. **Rate limiting** : `maestro-ai-analysis` protégé par un advisory lock (`pg_advisory_lock(hashtextextended('maestro-ai:'||call_id))`) — éviter double analyse concurrente.
3. **Idempotence** : `maestro-cdr` honore `Idempotency-Key: {call_id}`, `maestro-transcript` skip si déjà présent, `maestro-ai-analysis` skip si `ai_summary` présent (option `force=true`).
4. **Coût IA** : log `tokens_in/out` par appel dans `planipret_audit_log`. Cap quotidien par broker (config `planipret_settings`).
5. **Realtime** : ajouter `planipret_phone_calls` à `supabase_realtime` si pas déjà fait (pour update UI).
6. **Tests E2E** :
   - Pipeline complet (call mock → CDR → transcript → IA → task) via `supabase--curl_edge_functions`.
   - Webhook receiver avec signature valide/invalide.
   - Rejet sans token broker.
7. **Doc opérateur** : `docs/maestro-integration.md` (variables, retry, troubleshooting).

---

## Détails techniques

**Structure fichiers** :
- `supabase/functions/_shared/maestro.ts` (client HTTP, refresh, signature HMAC)
- `supabase/functions/_shared/ai-analysis.ts` (prompt + schema Claude)
- `supabase/functions/maestro-{cdr,recording,transcript,ai-analysis,task,appointment,client-lookup,client-create,client-history,counts,webhook-receiver}/index.ts`
- `src/components/planipret/mobile/recordings/{RecordingsList,RecordingCard,PipelineProgress,RecordingSection,TranscriptSection,AISection,MaestroSyncSection,LinkClientModal}.tsx`
- `src/components/planipret/admin/maestro/{BrokerTokensTable,PipelineTestModal,WebhookStatusPanel,MaestroLogsTable}.tsx`
- Migration unique Phase 1.

**Modèles IA** :
- Transcription : NS-API d'abord → OpenAI Whisper `whisper-1` fallback.
- Analyse : Lovable AI Gateway `google/gemini-2.5-pro` ou `anthropic/claude-sonnet-4-5` (à confirmer dispo), tool calling JSON Schema strict pour garantir parsing.

**Stratégie de déploiement** :
- P1 (migration) doit être validée avant tout.
- P2 + P3 + P4 livrables séparément, déployables sans casser l'UI (les nouvelles colonnes restent nulles).
- P5 utilisable dès que P2-P3 actifs, dégrade gracieusement si fonctions absentes.
- P6 + P7 surface uniquement, aucun risque de régression backend.
- P8 obligatoire avant annonce go-live aux courtiers.

**Garanties "DO NOT CHANGE" respectées** :
✅ Aucune table existante modifiée (ALTER ADD COLUMN seulement)
✅ NS-API / ns-webhook-receiver : hook fire-and-forget non bloquant
✅ Auth/routing intacts
✅ ElevenLabs / M365 / Lemtel : zéro modification
✅ Dark mode + tokens `--pp-*` Phase 7 du refonte mobile préservés
✅ Audit logging étendu, jamais remplacé
