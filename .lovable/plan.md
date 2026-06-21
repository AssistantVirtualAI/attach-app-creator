
# Plan d'intégration — PlaniPrêt AI Portal (AVA uniquement)

## Règle d'or appliquée à TOUTES les phases
- **Cloisonnement strict**: tout schéma, table, edge function, route, composant, RLS et donnée créés pour PlaniPrêt sera **scopé à l'organisation AVA** (`organization_id = AVA_ORG_ID`).
- **Aucune** modification, lecture ou écriture dans les tables/policies/fonctions Lemtel (`pbx_*`, `lemtel_*`, `is_lemtel_*`).
- Préfixe dédié `planipret_*` pour les nouvelles tables, et préfixe `pp-` pour les edge functions (ex: `pp-ns-auth`), afin d'éviter toute collision avec le PBX Lemtel existant.
- Toute RLS PlaniPrêt utilise `has_role(auth.uid(), AVA_ORG_ID, ...)` ou `is_super_admin(auth.uid())` — jamais `is_lemtel_*`.
- Les routes vivent sous `/planipret/*` (admin) et `/mplanipret/*` (mobile broker), totalement séparées des routes `/console/*` et `/customer/*` Lemtel.
- Un guard `PlanipretGuard` empêchera tout accès si l'organisation active n'est pas AVA.

## Vue d'ensemble fonctionnelle
Le document définit un portail mobile + dashboard pour les courtiers Planiprêt, branché sur :
- **NS-API v2 (NetSapiens)** — téléphonie (appels, CDR, SMS, voicemail)
- **Maestro CRM** — calendrier, tâches, contacts
- **Microsoft 365 (Graph)** — email, calendrier, contacts
- **ElevenLabs** — agent vocal IA "AVA"
- **Claude (Anthropic)** — analyse des appels

---

## Les 10 phases

### Phase 1 — Fondations DB + Auth (Prompt 01)
- Tables `planipret_profiles`, `planipret_phone_calls`, `planipret_phone_messages`, `planipret_voicemails`, `planipret_ai_insights`, `planipret_contacts`, `planipret_settings`.
- Colonnes broker: `extension`, `ns_domain`, `mobile_app_enabled`, `voice_agent_enabled`, `role` (admin/broker), `organization_id` figé à AVA.
- RLS : broker voit ses propres données ; admin AVA voit tous les brokers AVA ; super_admin voit tout.
- Rôles `planipret_admin` / `planipret_broker` ajoutés à l'enum existant.

### Phase 2 — Edge Functions NS-API #1 (Prompt 02)
`pp-ns-auth`, `pp-ns-calls`, `pp-ns-cdr` — proxy sécurisé avec JWT NetSapiens stocké côté serveur, refresh auto. Credentials NS-API jamais exposés au client.

### Phase 3 — Edge Functions NS-API #2 (Prompt 03)
`pp-ns-sms`, `pp-ns-voicemail`, `pp-ns-webhooks` — réception webhooks NetSapiens, sync vers les tables `planipret_*`.

### Phase 4 — Edge Functions IA + CRM + M365 (Prompt 04)
`pp-ai-analyze-call` (Claude), `pp-maestro-proxy` (CRM), `pp-m365-oauth` + `pp-m365-graph` (mail/cal/contacts). OAuth tokens chiffrés.

### Phase 5 — App mobile : Home + Navigation + Dialer (Prompt 05)
Route `/mplanipret`, shell mobile avec tab bar (Home, Calls, Messages, Voicemail, More), FAB Dialer, mode preview desktop 390x844.

### Phase 6 — App mobile : Calls + détail + IA (Prompt 06)
Onglets Récents/Actifs/Manqués, CallDetailSheet, transcription + résumé IA, actions hold/transfer/disconnect.

### Phase 7 — App mobile : Messages + Voicemail + More (Prompt 07)
Threads SMS, lecteur voicemail inline, transcriptions, réglages broker.

### Phase 8 — Agent vocal ElevenLabs (Prompt 08)
Bouton 🤖 conditionné à `voice_agent_enabled`, session conversational AI, tools (`make_call`, `send_sms`, `create_task`, `book_appointment`, `search_contact`…), system prompt AVA bilingue FR/EN.

### Phase 9 — Dashboard admin Planiprêt (Prompt 09)
Route `/planipret` (admin AVA only), tableau des brokers, toggles `mobile_app_enabled` / `voice_agent_enabled`, CRUD broker, vue analytics globale.

### Phase 10 — Realtime + Notifications + Polish + Déploiement (Prompt 10)
Channels Supabase Realtime (`call-events`, `messages`, `ai-insights`), notifications in-app, dark mode, checklist finale, capacitor build.

---

## Détails techniques transverses

- **Secrets à demander avant les phases concernées** : `NS_API_BASE_URL`, `NS_API_USER`, `NS_API_PASSWORD`, `MAESTRO_API_URL`, `MAESTRO_API_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_TENANT_ID`.
- **Constante** `PLANIPRET_AVA_ORG_ID` exposée via une fonction SQL `get_planipret_org_id()` (SECURITY DEFINER) et un helper TS, pour garantir le scoping AVA partout.
- **Guard front** `PlanipretGuard` : si `currentOrg.id !== AVA_ORG_ID` → redirige vers `/platform` et bloque l'affichage.
- **Sidebar** : entrées PlaniPrêt visibles seulement quand l'org active est AVA et le rôle ≥ `planipret_broker`.
- **Aucune** edge function ni table Lemtel ne sera modifiée, lue ou référencée.

---

## Mode opératoire
Tu valides ce plan, puis on lance **Phase 1** seule. Je te montre la migration DB, tu l'approuves, on enchaîne avec le frontend de la phase. Phase suivante seulement après ton OK.

Dis-moi simplement **"go phase 1"** pour démarrer, ou demande des ajustements (renommer le préfixe, fusionner des phases, secrets différents, etc.).
