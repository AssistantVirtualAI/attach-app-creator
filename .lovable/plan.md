# Plan — Migration du portail /planipret/admin vers l'org Planiprêt

Objectif : remplacer entièrement layout + sidebar + auth du portail admin Planiprêt, refondre les 9 pages au design system Navy spécifié, et brancher SSO externe via avastatistic.ca. On conserve les Edge Functions, RLS et tables existantes (`planipret_*`).

## 1. Auth & routing

- Supprimer `src/pages/planipret/PlanipretLogin.tsx` et la route `/planipret/login` dans `src/App.tsx`.
- Remplacer la route racine du portail :
  - `/planipret` → `Navigate` vers `/planipret/admin/overview`.
  - `/planipret/admin` → `Navigate` vers `/planipret/admin/overview`.
- Nouveau guard `PlanipretAuthGuard` (remplace l'usage de `AppSeparationGuard` côté login) :
  - `supabase.auth.getSession()` au mount + listener `onAuthStateChange`.
  - Pas de session → `window.location.href = "https://avastatistic.ca/login?redirect=planipret"`.
  - Session OK mais pas membre org Planiprêt → même redirection (le SSO renverra ici après assignation).
  - Conserve `AppSeparationGuard app="planipret"` derrière pour la garde org.
- Les sous-routes restent : `overview, users, calls, messages, voicemails, reports, integrations, compliance, audit-checklist` (rename de `audit-log` → `audit-checklist`, ajout `integrations` et `compliance` au layout admin ; on retire `leads`, `templates`, `audit-log` du nav mais on garde les fichiers pour ne rien casser).

## 2. Nouveau `PlanipretAdminLayout`

Refonte complète de `src/pages/planipret/admin/PlanipretAdminLayout.tsx` :

- Shell flex : sidebar 240px (`#040B16`, border-right `#0A1E35`) + colonne (topbar 64px + `<Outlet/>` sur `#060D1A`).
- Header sidebar : bloc logo 32×32 gradient `135deg #1A4A8A → #2E9BDC` (emoji 🏠), titre "PLANIPRÊT" Inter 700 14px `#E8EDF5`, sous-titre "AI Portal · Admin" 10px `#2E9BDC`. Séparateur gradient `90deg #2E9BDC → transparent` opacity .35.
- Nav (lucide-react : `LayoutDashboard, Users, Phone, MessageSquare, Voicemail, BarChart3, Plug, ShieldCheck, ListChecks`) avec NavLink actif `bg #0D2A4A`, border `rgba(46,155,220,.2)`, text `#E8EDF5` ; inactif text `#4A7FA5`.
- Badges live :
  - Courtiers → `count(planipret_profiles)` où `mobile_app_enabled` ou rôle broker.
  - Appels → `count(planipret_phone_calls where direction='inbound' and status='missed' today)` (rouge).
  - Intégrations → point orange si secret manquant (via `pp-admin-user` action `secrets_status`).
  - Audit → score `pp-audit-runner` cache (amber pill).
  - Hook `useAdminSidebarBadges` (réactualisation 60s + realtime sur `planipret_phone_calls`).
- Footer sidebar : query `select full_name, email, role from planipret_profiles where role='admin' limit 1`, avatar initials, bouton logout (`supabase.auth.signOut()` → redirection SSO).
- Topbar : titre dynamique (map route→label), pill "En direct" (`#0D3D2A` / `#1A5A3F` / `#00D4AA` + dot pulsant), date FR `Intl.DateTimeFormat('fr-CA')`, `<NotificationsBell/>` existant.

## 3. Design system

Créer `src/pages/planipret/admin/_navy.css` (ou étendre `src/index.css` sous un namespace `.pp-navy`) avec variables `--bg-base, --bg-surface, --bg-elevated, --bg-deep, --bg-border, --bg-border-2, --brand, --success, --agent, --warning, --danger, --text-1..4`. Polices : Inter (déjà présent) + DM Sans (ajout Google Fonts dans `index.html`).

Primitives partagées dans `src/pages/planipret/admin/_components/` :
- `NavyCard` (avec prop `accent` pour la barre 2px gradient top).
- `NavyPill` (variantes blue/teal/red/purple/amber/grey).
- `NavyAvatar` (initials + gradient déterministe).
- `NavyTable` (header 9px uppercase tracking .1em color `#2A4A6A`, row bg `#0A1628`, border-bottom `#0A1E35`).
- `NavyToggle` (38×20 pill, variantes brand/agent).
- `NavyScrollArea` (scrollbar 4px `#0E2A45`).
- `NavyStatusDot` (on_call/available/active/offline).

## 4. Pages — refonte au design Navy

Toutes les pages réécrites pour utiliser uniquement les primitives Navy ; queries Supabase et appels Edge Function inchangés sauf indication. Aucune logique métier supprimée.

### 4.1 `PAOverview` (refonte complète)
- 4 KPI cards (accent top par carte) + 3 cartes live status (gradients spécifiés) + row charts (BarChart 3fr + PieChart 2fr) + row tables (Activité en direct ← realtime `planipret_audit_log`, Courtiers en ligne ← `planipret_profiles`) + row integrations health + AI stats 2×3.
- Realtime channels : `planipret_phone_calls`, `planipret_audit_log`, `planipret_ava_conversations` (subscribe dans `useEffect`, cleanup au unmount).

### 4.2 `PAUsers`
- 4 stat cards, search + filter pills, table avec toggles `mobile_app_enabled` et `voice_agent_enabled` (update direct table + invalidation cache), pills Maestro/M365, count appels du mois (sous-requête agrégée), actions edit/delete.
- Modal Add/Edit (overlay blur 8px) → `supabase.functions.invoke('pp-admin-user', { body: { action: 'create_user'|'update_user'|'delete_user', ... }})`.

### 4.3 `PACalls`
- Filter bar (courtier, dates, direction, statut, Export CSV via util existant).
- Table 11 colonnes avec pills direction colorées, dots recording/transcript, score coaching.
- Side panel droit 420px : header + sections résumé/coaching/insights/actions ou bouton "Analyser avec l'IA" → `supabase.functions.invoke('ai-analyze-call', { body: { callId }})`.

### 4.4 `PAMessages`
- Table `planipret_phone_messages` (courtier joint, contact, direction pill, contenu tronqué, date, statut livraison).

### 4.5 `PAVoicemails`
- Liste cartes `planipret_voicemails` + player audio inline (URL via `supabase.functions.invoke('ns-voicemail', { body: { id }})`).

### 4.6 `PAReports`
- Sélecteur période + bouton PDF (réutilise util existant).
- BarChart filtrable.
- Podium 🥇🥈🥉 + tableau ranking (Appels, Score coaching, Leads chauds, Sessions AVA — agrégats SQL).
- LineChart tendances coaching par courtier.
- Card stats Maestro (`planipret_maestro_sync_log`).

### 4.7 Nouveau `PAIntegrations` (`/planipret/admin/integrations`)
- 8 panneaux selon spec : NS-API, ElevenLabs (config 1 clic + progress realtime), Maestro CRM, Microsoft 365, Claude IA, Webhooks (`ns-webhook-setup`), App Mobile, Voix ElevenLabs.
- Statuts via probes Edge Functions et un wrapper `pp-admin-user` action `secrets_status` (à ajouter si absent) pour vérifier existence de `ELEVENLABS_DEFAULT_AGENT_ID`, `MAESTRO_API_URL`, `MAESTRO_API_KEY`, `ANTHROPIC_API_KEY` (jamais retourner les valeurs).

### 4.8 `PACompliance`
- Badge score + 4 sections : audit log (`planipret_audit_log`), consentements (`planipret_consent_settings`), rétention (`planipret_retention_policy` → `pp-data-retention`), export RGPD (`pp-gdpr-export`).

### 4.9 `PAAuditChecklist`
- Bouton "Lancer l'audit" → `pp-audit-runner` par batch de 5, 200ms delay (orchestration côté client).
- Sections DB (13 tables), Intégrations, Edge Functions (HEAD probes).
- Badges priorité 🔴🟠🟡🟢, quick-fix deep links (`/planipret/admin/integrations#elevenlabs` etc., scroll auto via `useEffect` + `scrollIntoView`).
- Checklist manuelle persistée dans `planipret_settings.manual_checklist_state` (jsonb).
- Section "Prochaines étapes" générée depuis échecs triés par priorité.

## 5. Données / backend

Aucune migration de schéma requise — toutes les tables existent. Ajouts éventuels :
- Si `pp-admin-user` ne gère pas `secrets_status` : étendre la function (lecture booléenne `Deno.env.get(...) !== undefined`, jamais la valeur).
- Vérifier que `planipret_settings` a une colonne `manual_checklist_state jsonb`; sinon `ALTER TABLE ... ADD COLUMN manual_checklist_state jsonb default '{}'` + GRANT déjà en place.

## 6. Détails techniques

- `src/App.tsx` : retirer import et route `PlanipretLogin`, ajouter routes `integrations`, `compliance` et alias `/planipret` → overview.
- Layout : remplacer l'`AppSeparationGuard` racine par `<PlanipretAuthGuard><AppSeparationGuard app="planipret"><PlanipretAdminLayout/></AppSeparationGuard></PlanipretAuthGuard>`.
- Toutes les couleurs via tokens CSS — interdiction d'utiliser `text-white`, `bg-black`, hex inline en composants. Les variables Navy vivent sous `.pp-navy` scopé sur `PlanipretAdminLayout` pour ne pas polluer Lemtel / AVA.
- Realtime : pattern `useEffect`+`removeChannel` (cf. règles cloud-realtime).
- Pas de modification de `src/integrations/supabase/client.ts`.

## 7. Ordre d'exécution

1. Supprimer `PlanipretLogin` + route.
2. Ajouter tokens Navy + primitives.
3. Réécrire `PlanipretAdminLayout` (sidebar/topbar/guard).
4. Mettre à jour routes + ajouter `PAIntegrations`.
5. Refondre `PAOverview` (avec realtime).
6. Refondre `PAUsers`, `PACalls` (+ side panel).
7. Refondre `PAReports` (podium + LineChart).
8. Construire `PAIntegrations` (8 panneaux + 1-clic ElevenLabs).
9. Refondre `PACompliance` + `PAAuditChecklist` (batch runner + deep links).
10. Refondre `PAMessages` + `PAVoicemails` (player audio).
11. Étendre `pp-admin-user` (`secrets_status`) si nécessaire + migration `manual_checklist_state` si manquante.
12. Pass final design : audit visuel page par page contre la palette.

## Hors scope

- Pas de changement à `/mplanipret` (mobile), `/lemtel/*`, `/platform/*`, AVA Statistic landing.
- Pas de modification des Edge Functions existantes sauf ajout ciblé `secrets_status`.
- Pas de migration de données.
