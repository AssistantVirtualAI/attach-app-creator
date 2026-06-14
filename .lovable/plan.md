# Phase 8 — Portail AVA Statistic: temps réel téléphonie

3 nouvelles pages admin temps-réel branchées sur FusionPBX via `fusionpbx-proxy`.

## 1. Edge function — nouvelles actions

`supabase/functions/fusionpbx-proxy/index.ts` ajout de:

- **`list-active-calls`** — `GET /api/index.php?type=cmd&cmd=show+channels+as+json` (mod_commands FreeSWITCH). Parse JSON `{rows: [{uuid, name, cid_name, cid_num, dest, application, read_codec, secure, hostname, created}]}`. Retourne `{ok:true, data:rows}`.
- **`kill-active-call`** — `uuidkill <uuid>` (admin-only, audité).
- **`system-status`** — agrège `status` + `sofia status` (compte profiles/gateways UP/DOWN). Retourne `{uptime, version, sessions:{active,peak,total}, sofia:[{profile,state,calls}]}`.
- Ajout dans `readOnly` whitelist: `list-active-calls`, `system-status`.

## 2. Nouvelles pages admin

| Page | Route | Données | Refresh |
|---|---|---|---|
| AdminActiveCalls | `/org/lemtel/admin/active-calls` | `list-active-calls` | 5s (polling) |
| AdminRegistrations | `/org/lemtel/admin/registrations` | `get-registrations` existant | 10s |
| AdminSystemStatus | `/org/lemtel/admin/system-status` | `system-status` + `sync-status` | 15s |

Style: cohérent avec autres pages admin (Card + Table + AdminPageHeader + StatusBadge). Tables denses, recherche locale, bouton refresh manuel + indicateur "last updated".

### AdminActiveCalls
Colonnes: UUID (court), Caller (cid_name/cid_num), Destination, Application, Durée (now - created), Codec, Profile.
Action par ligne: **Hang up** (confirme + appelle `kill-active-call`, audité via `log-audit-event`).

### AdminRegistrations
Colonnes: User (utilisateur SIP), Agent (user-agent), Contact (IP:port), Expires, Status.
Groupe par profile SIP. Bouton "Re-register" → flush registrations (action future).

### AdminSystemStatus
Cards: Uptime, Active sessions, Peak sessions, Sessions/sec.
Tableau Sofia profiles: nom, état (running/down), calls, REGs. Action restart par profile (réutilise `restart-sip-profile` existant).
Section "Sync jobs" (réutilise composant de `AdminSyncHealth`).

## 3. Routes + sidebar

- `src/App.tsx`: 3 nouvelles routes sous `<LemtelAdminPage>`.
- `src/components/sidebar/sidebarConfig.ts` + `cockpitNavConfig.ts`: ajouter entrées dans le groupe "Monitoring" (sous PBX Sync Health):
  - Active Calls (icon `PhoneCall`)
  - Registrations (icon `Wifi`)
  - System Status (icon `Activity`)

## 4. Sécurité & audit

- Hang-up et restart-profile = `is_lemtel_admin` requis (déjà en place via proxy).
- Audit log chaque action destructive: `pbx.call_killed`, `pbx.profile_restarted`.
- RLS inchangée (lectures via proxy, pas de tables).

## Hors scope (phases suivantes)

- Call Block réel, SMS admin org, polish drawers admin → Phase 9.
- Test Playwright des écrans temps-réel.

## Livrables

- 3 nouvelles actions edge function.
- 3 nouvelles pages React.
- 3 nouvelles routes + entrées sidebar.
