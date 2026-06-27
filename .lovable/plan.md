## Cause du freeze sign-in → Planipret

`src/pages/planipret/admin/PlanipretAdminLayout.tsx` redirige vers un SSO externe (`https://avastatistic.ca/login?redirect=planipret`) dans 3 cas :
- pas de session (ligne 128)
- pas de ligne dans `planipret_profiles` pour l'utilisateur (ligne 87)
- logout (ligne 138)

Comme `PostLoginRedirect` envoie tout admin Planipret vers `/planipret/admin/overview`, et que la plupart des comptes n'ont pas de `planipret_profiles`, on bounce vers la page de login externe → boucle login ↔ dashboard. C'est le freeze observé dans le replay (`Chargement…` qui ne disparaît jamais).

## Objectif

1. **AVA = portail original.** L'org AVA réutilise le `AppLayout` + sidebar AVA existant (`src/components/layout/AppLayout.tsx`) avec les pages historiques (Dashboard, Conversations, Agents, Leads, etc.). Aucun changement de pages AVA.
2. **Planipret = même portail AVA**, mais pages admin Planipret (PAOverview, PAUsers, PACalls, PAMessages, PAVoicemails, PAReports, PALeads, PATemplates, PAAuditLog, PAAuditChecklist, PACompliance, PlanipretIntegrations, PlanipretPrivacy) montées **dans** ce portail, accessibles via le switcher d'org. Aucun forward externe.
3. **Lemtel = inchangé** (déjà dans le portail principal).
4. **Accès par org via `org_members`** (table existante) + `get_accessible_org_ids` RPC déjà en place. Toi (super_admin) = 3 orgs. Admins Planipret = Planipret seulement. Admins Lemtel = Lemtel seulement.

## Plan

### Étape 1 — Débloquer le sign-in (priorité)
- Réécrire `PlanipretAdminLayout.tsx` :
  - retirer `SSO_URL` et tous les `window.location.href = SSO_URL`
  - si pas de session → `navigate('/auth', { replace: true })`
  - si session sans `planipret_profiles` → continuer (le contrôle d'accès passe par `org_members` + `has_role`, pas par cette table)
  - logout → `supabase.auth.signOut()` puis `navigate('/auth')`
- Dans `src/lib/postLoginRoute.ts`, faire pointer Planipret admins/members vers `/dashboard` (avec org Planipret pré-sélectionnée) au lieu de `/planipret/admin/overview`. Persister l'org actif via `localStorage.setItem('active_org_id', PLANIPRET_ORG_ID)` lu par `OrganizationContext`.

### Étape 2 — Monter les pages Planipret dans le portail AVA
- Ajouter dans `src/App.tsx`, à l'intérieur du bloc protégé `AppLayout`, les nouvelles routes :
  ```
  /dashboard/planipret/overview        → PAOverview
  /dashboard/planipret/users           → PAUsers
  /dashboard/planipret/calls           → PACalls
  /dashboard/planipret/messages        → PAMessages
  /dashboard/planipret/voicemails      → PAVoicemails
  /dashboard/planipret/reports         → PAReports
  /dashboard/planipret/leads           → PALeads
  /dashboard/planipret/templates       → PATemplates
  /dashboard/planipret/audit-log       → PAAuditLog
  /dashboard/planipret/audit-checklist → PAAuditChecklist
  /dashboard/planipret/compliance      → PACompliance
  /dashboard/planipret/integrations    → PlanipretIntegrations
  /dashboard/planipret/privacy         → PlanipretPrivacy
  ```
- Les composants PA* sont conservés tels quels — ils lisent déjà `planipret_*` tables via Supabase avec `organization_id = PLANIPRET_ORG_ID`. Aucune migration de DB requise (tables, RLS, Edge Functions, API keys, programmation existent déjà et restent inchangées).
- Extension du sidebar AVA (`src/components/layout/AppLayout.tsx` ou son `AppSidebar`) : ajouter une section conditionnelle « Planipret » (visible uniquement quand `activeOrg.id === PLANIPRET_ORG_ID`) listant les 13 entrées ci-dessus.
- Idem section « Lemtel » conditionnelle (réutilise les routes `/lemtel/*` existantes — pas de changement).

### Étape 3 — Scoping par org via `org_members`
- `OrgSwitcher` : filtrer la liste d'orgs avec `supabase.rpc('get_accessible_org_ids', { _user_id })` (déjà existant). Résultat :
  - toi (super_admin) → AVA + Planipret + Lemtel
  - admin Planipret → Planipret seul
  - admin Lemtel → Lemtel seul
- `AppSeparationGuard` reste actif pour empêcher l'accès direct par URL à une org hors `org_members`.
- Aucune modification de schéma : on s'appuie sur `org_members` (déjà peuplée) + `has_role(_user_id, _org_id, role)` + `is_super_admin`.

### Étape 4 — Redirects de compatibilité
- Ajouter dans `App.tsx` des `<Route>` `/planipret/admin/*` → `<Navigate to="/dashboard/planipret/*" replace />` pour préserver les anciens liens, en gardant l'ancien `PlanipretAdminLayout` désactivé (commenté ou supprimé). Aucune suppression de page tant que la nouvelle route n'est pas vérifiée fonctionnelle.

### Étape 5 — Vérification (avant de retirer définitivement `/planipret/admin`)
- Build + check que chaque page PA* charge dans le nouveau portail.
- Vérifier dans Supabase que :
  - lecture de `planipret_phone_calls`, `planipret_phone_messages`, `planipret_voicemails`, `planipret_profiles`, `planipret_pipeline`, `planipret_integration_secrets` fonctionne (RLS scopées sur `organization_id`).
  - Edge Functions `pp-*` répondent (aucune URL ne change).

## Détails techniques

- **Aucune migration SQL.** Toutes les tables Planipret + API keys + secrets restent à leur place. Seul le frontend (routing + layout) change.
- **Aucune Edge Function modifiée.**
- **Sécurité conservée :** `org_members` + `user_roles(organization_id, role)` + `has_role` RPC déjà en place. Le scoping par org est server-side via RLS — le sidebar conditionnel n'est qu'une couche UX.
- **Lazy loading** des pages PA* conservé (déjà en `lazy()` dans `App.tsx`).
- **`PlanipretMobile` (route `/mplanipret`) reste intact** — c'est l'app mobile, pas l'admin web.
