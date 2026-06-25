## A. Fix build (immédiat)
- `src/hooks/usePullToRefresh.tsx` : ajouter prop optionnelle `color?: string` à `PullIndicator` (utilisée par `PlanipretMobile`, ligne 264).
- `src/services/__tests__/avaProactive.test.ts` : confirmer signature `(name: string, opts?: any) => invoke(name, opts)` (typage tuple correct).

## B. Fix users list — `/planipret/admin/users`
- Vérifier composant existant (`src/pages/planipret/admin/PAUsers.tsx` ou équivalent) et corriger la requête vers `planipret_profiles` avec les colonnes listées + tri par `full_name`.
- Admin guard layout : filtrer par `.eq("id", user.id)` (pas `user_id`), créer profil admin via insert si manquant (`role='admin'`, `ns_domain='planipret.ca'`).
- États : skeleton (loading), message d'erreur explicite, empty state « Aucun courtier trouvé » + bouton Ajouter.
- Si RLS bloque : ajouter migration policy « Admins can read all profiles » (`auth.uid() IN (select id from planipret_profiles where role='admin')`).

## C. Refonte Admin Dashboard (AVA org uniquement)
Design tokens dark navy déjà fournis (à exposer dans `index.css` sous `--pp-admin-*` pour ne pas casser le reste).

### Structure
- `src/layouts/PlanipretAdminLayout.tsx` : sidebar 260px + topbar 64px + main scroll.
- Nav items + badges dynamiques (intégrations manquantes, score audit).
- Topbar : titre page, badge LIVE (Realtime), date FR, bell notifications.

### Pages
1. **Overview** (`/planipret/admin/overview`) — 4 KPI cards, 3 live cards (appels actifs, app mobile, sessions AVA), BarChart 7 jours (recharts), Donut répartition, table activité Realtime, table courtiers en ligne, statut intégrations, stats IA, sync Maestro.
2. **Courtiers** (`/planipret/admin/users`) — stats + filtres pills + table complète avec toggles optimistes (`mobile_app_enabled`, `voice_agent_enabled`), bulk actions, modales Add/Edit/Delete via `pp-admin-user`.
3. **Appels** (`/planipret/admin/calls`) — filtres + tabs + table + side panel détail (audio/transcript/coaching/Maestro).
4. **Messages** (`/planipret/admin/messages`) — tabs SMS / Team / M365.
5. **Voicemails** — table + panel audio+transcript.
6. **Rapports** — date range, charts (activité, distributions, leaderboard podium, tendances IA), export PDF/CSV.
7. **Intégrations** — garder existant + ajouter health bar en haut.

### Realtime
- `src/hooks/useAdminRealtime.ts` : 4 canaux (`admin-calls`, `admin-messages`, `admin-profiles`, `admin-ava`) avec teardown propre. Indicateur live dans topbar (connecté/reconnexion).

### Responsive
- `<768px` redirige vers `/mplanipret` avec message.

## D. Contraintes
- Pas de modif Edge Functions ni schémas tables (seule migration possible : policy RLS admin si nécessaire à la section B).
- Pas de Lemtel, pas de mobile, pas de landing.
- Charts via `recharts` (déjà installé).
- Tous les composants admin sous `src/pages/planipret/admin/` ; nouveaux composants partagés sous `src/components/planipret/admin/`.

## E. Tests
- Vitest : `useAdminRealtime` (subscribe/teardown), `PAUsers` (rendu loading/empty/erreur), filtres pills.
- Smoke : `bunx vitest run` global doit rester vert.

## Ordre
1. A (fix build).
2. B (users list + admin guard).
3. C.1 Overview + C.2 Users.
4. C.3-7 (calls, messages, voicemails, reports).
5. D Realtime + responsive + tests.

OK pour exécuter dans cet ordre, ou je commence seulement par A+B (fix immédiat) avant la grosse refonte ?