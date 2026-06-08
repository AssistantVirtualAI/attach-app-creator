# Phase 2 — Telecom Settings utilisateur

Objectif : transformer `/my/telecom` (stub) en page fonctionnelle où chaque user gère son extension, ses heures de travail, son availability et son routage hors-heures, le tout persisté en DB et synchronisé FusionPBX via Edge Function sécurisée.

## 1. Base de données

Nouvelle migration :

- **Table `user_working_hours`** (une ligne par user+jour)
  - `id`, `organization_id`, `user_id`, `day_of_week` (0–6), `is_working_day` bool, `start_time` time, `end_time` time, `break_start` time null, `break_end` time null, `timezone` text, `created_at`, `updated_at`
  - Unique `(user_id, day_of_week)`
  - GRANTs `authenticated` + `service_role`
  - RLS : user manage ses lignes ; `org_admin` (via `has_role`) read/write dans son org ; super_admin read all
  - Trigger `updated_at`

- **Table `user_call_handling`** (1 ligne par user)
  - `id`, `organization_id`, `user_id` unique, `availability` enum (`available|busy|dnd|away|vacation`), `after_hours_action` enum (`voicemail|forward_extension|forward_external|follow_org_default`), `forward_target` text, `timezone` text, `sync_status` enum (`pending|synced|failed`), `sync_error` text, `last_synced_at`, timestamps
  - GRANTs + RLS identiques

- **Extension d'`audit_logs`** : aucune nouvelle table, on écrit `source='desktop_app'`, `action='user_telecom_settings.update'`.

## 2. Edge Function `user-telecom-settings`

Fichier `supabase/functions/user-telecom-settings/index.ts`.

- Validate JWT in code, charge user via service-role.
- Routes (POST body `{ action, payload }`) :
  - `get` → renvoie working_hours + call_handling + extension (depuis `pbx_softphone_users` du user).
  - `save_hours` → upsert 7 lignes `user_working_hours`, marque `sync_status='pending'`, push vers FusionPBX (time conditions) via `fusionpbx-proxy` interne, met à jour `synced`/`failed`.
  - `save_handling` → upsert `user_call_handling`, applique forwarding/voicemail via FusionPBX `pbx_call_forwarding` table + sync proxy, log audit.
  - `reset_to_org_default` → copie depuis `org_business_hours`.
- Jamais de credential PBX renvoyée au client.
- CORS + erreurs explicites (`tts_not_configured` style) avec code support.

## 3. Frontend `/my/telecom`

Refonte de `src/pages/my/TelecomSettings.tsx` en 3 sections :

### a. Extension & SIP
- Hook `useMyExtension()` → lit `pbx_softphone_users` par `portal_user_id`, retourne `{ extension, sip_domain, registered }`.
- Statut SIP via `useSyncStatus` existant + softphone snap. Aucun password.
- Badge : Connected / Registered / Not configured.

### b. Working Hours
- Composant `WorkingHoursEditor` : table 7 jours, toggle jour actif, 2 TimePickers (start/end), break optionnel, timezone select (Intl).
- Bouton **Save**, **Reset to org default**, badge sync (saved / pending / synced / failed) par save.
- Appelle Edge Function `user-telecom-settings:save_hours`.

### c. Availability & After-hours
- `AvailabilitySelector` (5 états) + `AfterHoursPanel` :
  - Radio : Send to voicemail / Forward to extension (input ext) / Forward to external (input E.164, désactivé si permission off) / Follow org default.
- Save via `:save_handling`.

### d. UX cross-section
- Loading skeletons, empty states, toasts succès/erreur (i18n FR/EN).
- Aucune string codée — entrées dans `src/locales/{en,fr}.ts` sous clé `telecomSettings.*`.

## 4. Hook partagé

`src/hooks/useMyTelecomSettings.ts` :
- `useQuery` get → cache TanStack.
- `useMutation` save/reset → invalidate.
- Centralise les appels `supabase.functions.invoke('user-telecom-settings', ...)`.

## 5. Sécurité & audit

- Edge Function valide que `payload.user_id === auth.uid()` (ou caller est `org_admin` éditant un user de son org).
- Forward external bloqué si `org_members.can_manage_users === false` OU flag org `allow_external_forward=false` (lecture depuis `organizations`).
- Chaque save → `audit_logs` (`source='desktop_app'`, before/after value).

## 6. Tests manuels (acceptance)

1. User normal ouvre `/my/telecom` → voit son extension + 7 jours par défaut.
2. Édite Lundi 9–17, save → badge "Synced", row visible dans `user_working_hours`.
3. Choisit "Forward to extension 205" → save → entrée dans `pbx_call_forwarding` + audit log.
4. Reload → valeurs persistées.
5. Reset to org default → repop. valeurs depuis `org_business_hours`.
6. User non-admin tente de PATCH une autre `user_id` → 403.

## Fichiers touchés

- **Nouveaux** :
  - `supabase/migrations/<ts>_user_telecom_settings.sql`
  - `supabase/functions/user-telecom-settings/index.ts`
  - `src/hooks/useMyTelecomSettings.ts`
  - `src/hooks/useMyExtension.ts`
  - `src/components/telecom/WorkingHoursEditor.tsx`
  - `src/components/telecom/AfterHoursPanel.tsx`
  - `src/components/telecom/AvailabilitySelector.tsx`
- **Modifiés** :
  - `src/pages/my/TelecomSettings.tsx` (page complète)
  - `src/locales/en.ts`, `src/locales/fr.ts` (clés `telecomSettings.*`)

Veux-tu que je lance la migration + Edge Function d'abord, ou je commence par le frontend avec un mode "draft local" en attendant la validation de la migration ?
