# Phase 4 — Org Chat temps réel

Objectif : transformer `MyOrgChat` en messagerie d'équipe Slack-like, temps réel, accessible depuis Customer Admin et My Workspace.

## État actuel
- Tables `org_chat_channels` / `org_chat_messages` existent avec RLS.
- Page `src/pages/my/OrgChat.tsx` créée mais squelette/placeholder.
- Bucket `chat-attachments` privé existant.

## Livrables

### 1. Edge Function `org-chat`
- `list_channels` — channels visibles (#general auto-créé si absent + DMs)
- `create_channel` — public/privé, nom unique, membres initiaux
- `list_messages` — paginé (avant un cursor), tri desc
- `send_message` — texte + attachments[] (paths storage)
- `edit_message` / `delete_message` (soft)
- `add_reaction` / `remove_reaction`
- `mark_read` — met à jour `last_read_at` côté membre
- `upload_url` — signed upload URL bucket `chat-attachments`
- `presence_ping` — réutilise `upsert_user_presence`
- Audit minimal (audit_logs)

### 2. Realtime
- Activer `supabase_realtime` publication sur `org_chat_messages`.
- Hook `useOrgChat(channelId)` :
  - React Query pour fetch initial paginé
  - Subscription Postgres Changes filtrée `channel_id=eq.X` pour INSERT/UPDATE/DELETE
  - Présence canal via Realtime Presence (`channel:org-chat:{channelId}`)

### 3. Frontend
- `src/pages/my/OrgChat.tsx` refonte :
  - Layout 3 colonnes : sidebar channels + DMs / message list / detail panel
  - Composer (textarea, drop file, emoji simple, /commands optional)
  - Bulles messages avec avatar, time, reactions, edited badge
  - Indicator unread + scroll auto + "jump to bottom"
  - Empty/Loading/Error states
- Composants partagés :
  - `chat/ChannelSidebar.tsx`
  - `chat/MessageList.tsx`
  - `chat/MessageBubble.tsx`
  - `chat/MessageComposer.tsx`
  - `chat/CreateChannelDialog.tsx`
  - `chat/ChatAttachmentPreview.tsx`
- Hook `useOrgChat.ts` (channels + messages + realtime + mutations)
- FR/EN via `useLanguage`

### 4. Intégration portails
- Customer Admin → route existante `/customer/chat` réutilise même page (vue org).
- My Workspace → `/my/chat`.
- Badge unread dans `PortalShells` sidebar (via count messages non lus).

### 5. Sécurité
- Edge function valide JWT + appartenance org/channel avant tout write.
- Bucket `chat-attachments` : signed URLs uniquement (1h), pas d'accès public.
- RLS existante sur `org_chat_messages` reste source de vérité ; edge function utilise service_role mais filtre toujours par `organization_id` du caller.
- Attachments scannés taille max 25 MB.

## Hors scope (suite)
- Threads (replies) → Phase 4b si demandé.
- Notifications push/email mention → Phase 7.
- Recherche full-text → Phase 4c.

## Validation
- Envoi message visible <1s sur 2 onglets différents.
- Création channel + invitation membres.
- Upload + preview image attachment.
- Reactions toggle.
- Unread badge décroît en marquant lu.

Sur OK je passe en build mode.
