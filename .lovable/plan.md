# Phases 4b + 5 + 6 — Livraison groupée

L'utilisateur souhaite tout livrer en une seule itération. Voici la plan d'exécution consolidé.

## Phase 4b — Threads & recherche chat

### Schéma
- `org_chat_messages` : ajouter `parent_message_id uuid REFERENCES org_chat_messages(id) ON DELETE CASCADE`, `reply_count int DEFAULT 0`, `last_reply_at timestamptz`.
- Trigger `bump_thread_counters` qui maintient `reply_count` / `last_reply_at` sur le message parent.
- Colonne `tsv tsvector` + index GIN + trigger `to_tsvector('french', coalesce(content,''))`.

### Edge function `org-chat` (extensions)
- `list_thread(message_id)` — messages dont parent = id, tri ASC.
- `send_message` accepte `parent_message_id`.
- `search_messages(query, channel_id?, limit, before)` — `tsv @@ websearch_to_tsquery('french', q)` filtré par channels accessibles.

### Frontend
- `chat/ThreadPanel.tsx` : panneau latéral droit, composer, liste des replies, fermeture.
- `MessageBubble` : badge "N réponses" + "Répondre dans un fil".
- `chat/SearchBar.tsx` + `chat/SearchResults.tsx` : barre Cmd+K dans la sidebar, résultats avec extrait + highlight + jump-to-message.
- Hook `useOrgChatThread(messageId)` (React Query + realtime filtré).

## Phase 5 — Notifications & mentions

### Schéma
- Réutiliser `org_notifications` (existant).
- Trigger `notify_mentions_on_message` : parse `@uuid` dans `content`, insert lignes `org_notifications` (`type='chat_mention'`, payload = {channel_id, message_id}).
- Table `user_notification_prefs` (existante) : ajouter colonnes `email_mentions bool`, `email_dm bool`, `email_voicemail bool`, `email_missed_call bool`.

### Edge function `notifications`
- `list(limit, before)` — flux paginé.
- `mark_read(ids[])` / `mark_all_read()`.
- `prefs_get` / `prefs_update`.
- Worker `dispatch_email_notifications` (trigger pg_net post → fonction edge) qui envoie via Resend en respectant les prefs et un debounce 5 min.

### Realtime + Frontend
- `useNotifications()` : subscription `org_notifications` filtré `user_id=eq.<me>` ; cache React Query.
- `NotificationBell.tsx` dans `PortalShells` : badge unread, popover liste, "Tout marquer lu", deep-link vers ressource.
- `pages/my/NotificationSettings.tsx` : toggles prefs.
- Composer chat : auto-complétion `@` via membres de l'organisation, insertion `@<uuid>` rendu en `@DisplayName` côté bulle.

## Phase 6 — Calendrier & rendez-vous

### Schéma (table `appointments` existante — l'étendre)
- Ajouter `host_user_id uuid`, `host_kind text ('user'|'agent'|'team')`, `team_members uuid[]`, `location_type text ('phone'|'video'|'in_person')`, `meeting_url text`, `reminder_offsets int[] DEFAULT '{1440,60}'`, `timezone text`.
- Nouvelle table `appointment_slots` (slots de dispo générés / bookables publics).
- Nouvelle table `appointment_reminders` (sent_at, channel).

### Edge function `appointments`
- `list(range, host?)`, `create`, `update`, `cancel`, `reschedule`.
- `public_availability(host_id, range)` : calcule créneaux libres en croisant `user_working_hours`, `org_business_hours`, et appointments existants.
- `public_book(host_id, slot, contact)` — endpoint anon avec rate-limit + captcha-light.
- Worker `process_appointment_reminders` (déclenché par pg_cron toutes les 5 min) : envoie SMS Telnyx + email Resend selon `reminder_offsets`.

### Frontend
- `pages/my/Calendar.tsx` :
  - Vue Mois / Semaine / Jour (composant interne, pas de dep).
  - Sidebar mini-calendrier + filtres (host, status).
  - Drag-to-create + dialog edit.
- `pages/customer/Calendar.tsx` : variante orga avec multi-host.
- Page publique `/book/:slug` : créneaux dispo + formulaire contact + confirmation.
- Hooks `useAppointments`, `useAvailability`, `usePublicBooking`.

## Sécurité (toutes phases)
- Toutes les edge functions valident JWT + appartenance org via `current_user_org_ids()` ou `can_access_org`.
- Public booking : pas de JWT mais slug org/host validé + IP rate-limit (table `rate_limits` simple).
- RLS strictes sur nouvelles tables ; GRANT explicites `authenticated`/`service_role`.

## Hors scope
- Visio embarquée (juste lien meeting_url externe pour cette itération).
- Sync Google/Outlook 2-way (Phase 7 — table `calendar_integrations` déjà présente).
- Notifications push web (web push) → Phase 7.

## Validation
- Chat : ouvrir thread, envoyer reply, voir compteur, rechercher mot et jumper.
- Mention `@user` → bell badge + email reçu (si pref on).
- Créer RDV, voir reminder envoyé à T-1h, page publique `/book/:slug` permet booking.

Sur OK je passe en build mode et j'enchaîne les trois phases dans l'ordre 4b → 5 → 6.