## Phase A — Vérifier/provisionner ton compte admin

Constat actuel sur `planipret_profiles` :
- 1 seule ligne : `mhassoun@assistantvirtualai.com` (role=admin)
- Ton compte connecté `jlemme@lemtel.com` (uid `8afdf7d5-36ad-4bf7-8317-bb730de59ffc`) **n'a aucun profil** → la RLS `is_planipret_admin()` te bloque, d'où la liste vide.

Action (insert via outil dédié, pas de migration) :

```sql
INSERT INTO planipret_profiles (user_id, email, full_name, role, is_active)
VALUES ('8afdf7d5-36ad-4bf7-8317-bb730de59ffc', 'jlemme@lemtel.com', 'Juliano Lemme', 'admin', true)
ON CONFLICT (user_id) DO UPDATE SET role='admin', is_active=true;
```

Vérification : re-SELECT pour confirmer role=admin sur les 2 comptes.

## Phase B — Refonte Admin Dashboard (navy / glass)

Design system : navy `#0B1437` bg, surface `#111A3D`, accent `#0023e6`, succès `#10B981`, danger `#EF4444`. Inter, 4px grid, glass-morphism + subtle borders `rgba(255,255,255,0.06)`.

### B1. Layout (`src/components/planipret/admin/PlanipretAdminLayout.tsx`)
- Sidebar gauche (Overview, Courtiers, Appels, Messages, Voicemails, Rapports, Intégrations, Conformité, Audit).
- Topbar : recherche globale, badge "● Live" Realtime, avatar.
- Redirect mobile → `/mplanipret`.

### B2. Overview (`src/pages/planipret/admin/PAOverview.tsx`)
- 4 KPI cards : Courtiers actifs, Appels 24h, Messages 24h, Voicemails non lus.
- 3 status cards : Twilio, ElevenLabs, Maestro (ping via fonctions existantes, lecture seule).
- Charts `recharts` :
  - Area chart appels/messages 7j
  - Pie chart distribution direction (inbound/outbound/missed)
  - Bar chart top 5 courtiers

### B3. Users redesign (`src/pages/planipret/admin/PAUsers.tsx`)
- Table navy avec avatar, status pill, toggles optimistes **App** et **AVA** (update `planipret_profiles.app_enabled` / `ava_enabled`).
- Filtres : rôle, actif, recherche.
- Side panel détail (créé/dernière activité/n° assigné).

### B4. Appels (`PACalls.tsx`)
- Liste paginée `planipret_phone_calls`, filtres direction/courtier/date.
- Side panel : transcript, audio player, sentiment, AI insights (`planipret_ai_insights`).

### B5. Messages (`PAMessages.tsx`)
- Threads `planipret_phone_messages` regroupés par contact.
- Aperçu conversation à droite.

### B6. Voicemails (`PAVoicemails.tsx`)
- Cards : audio player, transcription, marquer lu/non lu.

### B7. Rapports (`PAReports.tsx`)
- Podium Top 3 courtiers (appels traités).
- Export CSV (volumes, durées moyennes, taux missed).

### B8. Realtime (`src/hooks/useAdminRealtime.ts`)
- Channels Supabase : `planipret_phone_calls`, `planipret_phone_messages`, `planipret_ava_conversations`.
- Toast discret + auto-refresh KPIs.

## Hors scope (intouchable)
- Edge Functions, schémas tables, auth, mobile `/mplanipret/*`, intégrations existantes, secrets, ElevenLabs config, channels Realtime names.

## Ordre d'exécution
1. Insert admin profile + vérif SELECT.
2. Layout + Overview (charts + Realtime).
3. Users redesign + toggles.
4. Calls / Messages / Voicemails.
5. Reports + export.
6. Smoke test : navigation, Realtime, toggles, RLS OK.
