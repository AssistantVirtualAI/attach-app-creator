# Plan multi-phases — AVA / Lemtel Desktop App

Objectif : faire de l'app desktop existante un workspace télécom complet pour les utilisateurs et un centre d'administration AI pour les admins, branché sur le portail web, Supabase, FusionPBX et les services AI déjà en place.

Principes transverses appliqués à toutes les phases :
- Réutiliser le portail web (composants, hooks, RolePortalGuard, i18n FR/EN, design tokens).
- Aucune credential PBX exposée côté client — tout passe par Edge Functions sécurisées.
- RLS org-scoped sur chaque nouvelle table, GRANTs inclus dans la migration.
- Chaque action admin AI → confirmation explicite + `audit_logs` + `source = desktop_app|ai_admin_chat`.
- Status badges uniformes (Connected / Registered / Sync pending / Sync failed / Not configured).

---

## Phase 1 — Fondations desktop & rôles (socle)

But : poser la navigation, l'auth et le routing par rôle pour tout le reste.

- Shell desktop : sidebar avec les 13 entrées (Dashboard, Softphone, Calls, Voicemail, Recordings, SMS, Org Chat, Telecom Settings, AI Assistant, Admin Telecom Center, Admin AI Chat, Reports, Settings).
- Hook `useDesktopRole` (normal / org_admin / reseller_admin / super_admin) basé sur `user_roles` + `org_members`.
- Masquage menu + guard de route pour les pages admin-only.
- Status bar globale (SIP registration, sync FusionPBX, presence) en réutilisant `useSyncStatus` et `SoftphoneWidget`.
- Empty/loading/error states standardisés + i18n FR/EN.

Done = un user normal et un admin voient des menus différents, aucune route admin n'est accessible en URL directe pour un user normal.

---

## Phase 2 — Telecom Settings utilisateur (Feature 1)

- Page Telecom Settings : extension, statut SIP (sans password), availability (Available/Busy/DND/Away/Vacation).
- Working hours Lun→Dim avec start/end, jour actif, timezone, pause optionnelle.
- After-hours : voicemail / forward extension / forward externe (selon permission) / suivre default org.
- Persistance via Edge Function `user-telecom-settings` → table `user_working_hours` + sync FusionPBX (time conditions / call forwarding).
- Badge sync (saved / pending / synced / failed) par section.

Tables : `user_working_hours` (RLS user-scoped + org_admin read).

---

## Phase 3 — Voicemail + AI greeting (Feature 2)

- Page Voicemail enrichie : liste VM, lecteur, mark read (déjà existant), section "Greeting".
- Éditeur greeting : texte manuel + bouton "Générer avec AVA" (Lovable AI Gateway, `google/gemini-3-flash-preview`).
- Tons : Professional / Friendly / Bilingual / Short / Detailed / After-hours / Vacation.
- TTS via ElevenLabs si `ELEVENLABS_API_KEY` présent, sinon badge "TTS provider not configured".
- Preview audio, save → upload `voicemail-greetings` bucket, update FusionPBX greeting via Edge Function.
- Revert vers greeting précédent (garder N-1 dans table).

Table : `voicemail_greetings` (déjà partiellement présente — vérifier colonnes vs spec).

---

## Phase 4 — Organization Chat (Feature 3)

- Pages : liste channels + thread view temps réel (Supabase Realtime).
- Channels par défaut à la création d'une org : General. Optionnels : Support, Sales, Operations, Admin announcements.
- Messages : sender, avatar, timestamp, texte, pièces jointes (`chat-attachments` bucket), read receipts si feasible.
- Admin : create/rename/archive/delete channels selon permissions.
- Notifs unread (badge sidebar), recherche full-text, empty states.
- Tables `org_chat_channels` et `org_chat_messages` existent déjà — auditer RLS, ajouter membership table si besoin pour admin-only channels.
- Realtime : `ALTER PUBLICATION supabase_realtime ADD TABLE ...` si pas déjà fait.

Isolation : RLS stricte sur `organization_id ∈ current_user_org_ids()`.

---

## Phase 5 — Admin Telecom Center (Feature 4)

Page admin regroupant la gestion org :
- Users & extensions (assign/unassign, enable/disable, reset SIP password via Edge Function `softphone-credentials` → rotate, jamais d'exposition plaintext).
- Devices, DIDs, routing, IVR, queues, ring groups (réutiliser pages portail `LemtelDIDs`, `LemtelQueues`, `TelephonyRingGroups`, IVR builder).
- Business hours, holiday schedules, vacation IVR.
- Call history + recordings selon permissions.
- Tout via Edge Functions `fusionpbx-proxy` + tables locales, status badges sync.

---

## Phase 6 — AVA AI Telecom Admin Chat (Features 5 + 6)

Cœur AI admin. Architecture :
- UI chat (AI SDK `useChat`) → Edge Function `admin-ai-telecom` (Lovable AI Gateway, tool calling).
- Tools exposés au LLM (un par action) : `create_holiday`, `set_vacation_mode`, `create_ivr`, `update_business_hours`, `create_user`, `assign_extension`, `reset_sip_password`, `set_after_hours_action`, `route_did`, `add_queue_agent`, `get_call_stats`, `generate_report`, etc.
- Chaque tool call → **propose** un changement (renvoie `proposed_changes_json`) ; n'exécute rien.
- UI affiche carte de confirmation détaillée → bouton Confirm → second appel Edge Function `execute-telecom-action` qui exécute, met à jour FusionPBX et écrit `audit_logs` + `telecom_admin_ai_actions`.
- Si TTS dispo, génération audio IVR/holiday greeting via ElevenLabs.
- Validation pré-exécution : destination existe, conflits horaires, permissions du caller.

Tables : `telecom_admin_ai_actions`, `business_hour_schedules`, `holiday_schedules`.

Safety : aucun outil n'a de side-effect tant que `confirmation_status != 'confirmed'`.

---

## Phase 7 — Reports & analytics admin (Feature 7)

- Page Reports avec onglets : Org summary, User performance, Missed calls, Queue perf, DID usage, After-hours, Voicemail, AI insights.
- Filtres : date range, user, extension, queue, DID.
- Source données : `pbx_call_records`, `pbx_call_transcripts`, `pbx_voicemails`, `cc_queue_stats`, `agent_daily_reports`.
- Export CSV/PDF (réutiliser `org_exports`).
- Résumé exécutif AI (Edge Function `report-summary`) en langage clair FR/EN.
- Branchable depuis Admin AI Chat ("Generate monthly report").

---

## Phase 8 — Sécurité, audit, polish final

- Audit complet : chaque action admin desktop/AI écrit dans `audit_logs` avec source.
- Revue RLS sur toutes les nouvelles tables + linter Supabase.
- Vérif : aucune secret PBX / FusionPBX admin / SIP plaintext côté client.
- Password resets → email reset flow uniquement.
- i18n sweep FR/EN sur toutes les nouvelles pages.
- QA visuelle desktop (tailles fenêtre), empty/loading/error states partout.
- Smoke test end-to-end : user normal (settings + VM + chat) puis admin (AI chat → create holiday → confirm → vérif FusionPBX + audit log).

---

## Détails techniques clés

- **Stack** : React + Vite (existant), Electron déjà packagé, Supabase Edge Functions Deno, AI SDK via Lovable AI Gateway (`google/gemini-3-flash-preview`).
- **Nouvelles Edge Functions** : `user-telecom-settings`, `voicemail-greeting-generate`, `voicemail-greeting-tts`, `admin-ai-telecom` (chat + tools), `execute-telecom-action`, `report-summary`.
- **Nouvelles tables** : `user_working_hours`, `voicemail_greetings` (audit), `business_hour_schedules`, `holiday_schedules`, `telecom_admin_ai_actions`. Réutiliser `org_chat_channels`, `org_chat_messages`, `audit_logs`, `pbx_*`.
- **Realtime** : channels chat + presence + sync status.
- **Confirmation pattern AI** : two-step (propose → confirm) côté UI, jamais auto-execute.

---

## Ordre de livraison recommandé

1. Phase 1 (1 itération) — débloque tout le reste.
2. Phases 2 + 3 en parallèle (user-facing rapide).
3. Phase 4 (Org Chat).
4. Phase 5 (Admin Center, réutilise beaucoup).
5. Phase 6 (AI Admin) — la plus complexe, à attaquer une fois le socle admin solide.
6. Phase 7 (Reports).
7. Phase 8 (sécu + polish final).

Veux-tu que je démarre la Phase 1 maintenant ?
