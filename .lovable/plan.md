## Desktop AVA — Phase 1 (UI futuriste) + Phase 7 (chatbot AVA)

Périmètre strict de cette livraison. Les phases 2-6 et 8 (auth/tenant, sync service, portails natifs complets, dashboards analytics, QA packaging) restent dans la roadmap mais ne sont **pas** dans ce ticket.

### Ce qui sort de cette livraison

**A. Refonte visuelle futuriste (Phase 1)**
Refonte de la coquille `apps/ava-softphone-desktop/src/components/console/ConsoleLayout.tsx` + `LeftRail.tsx` + `TitleBar.tsx` avec un design system desktop dédié (jeton CSS dans `src/styles/`).

- **Fond global** : gradient sombre `--desk-bg` (bleu nuit → noir) + deux halos blur cyan/violet positionnés en absolute dans la console (pas fixed, pour ne pas bleed sur la titlebar Electron).
- **LeftRail** : rail translucide 64px, icônes lumineuses, active state glow (`box-shadow: 0 0 12px var(--desk-accent-cyan)`), badges live pour appels actifs / nouveaux voicemails / sync status.
- **TitleBar** : drag region + statut PBX (pastille verte/orange/rouge), statut sync (dernière sync, retries), notifications IA en bell icon, profile/role chip.
- **Glass cards** : nouvelle primitive `DeskCard` (équivalent du `GlassCard` web) avec `backdrop-filter: blur(18px)`, bordure 1px `--desk-border`, ombre douce. Remplacement progressif des `Card` existants dans HomeDashboard, CallsView, AdminView, ContactsView, AIWorkspace.
- **Boutons** : variants `primary` (gradient cyan→violet shiny + light-sweep au hover), `ghost`, `danger`. Le softphone (CallControlGrid) garde sa logique, juste re-stylisé.
- **Tables** : `DeskTable` avec sticky headers, chips de statut, hover glow ligne.
- **Tokens** : nouveau fichier `src/styles/desk-tokens.css` avec `--desk-bg`, `--desk-surface`, `--desk-border`, `--desk-accent-cyan`, `--desk-accent-violet`, `--desk-shadow-glass`, `--desk-shadow-glow`. Inter pour le body, Space Grotesk pour les titres dashboard.
- **Micro-interactions** : framer-motion (déjà installé côté web — à ajouter au desktop si absent) pour fade-in cards 150ms, slide-up toasts, scale buttons hover.

**B. Chatbot AVA en panneau permanent (Phase 7)**
Nouveau composant `apps/ava-softphone-desktop/src/components/console/AvaChatPanel.tsx`, panneau droit fixe 360px, toggle via icône TitleBar (`Cmd+J` raccourci).

- Branché sur l'edge function **déjà déployée** `ava-admin-command` (Lovable AI Gateway + 6 tools : list_outages, extension_status, block_extension, force_sync, recent_voicemails, verify_isolation).
- Transport AI SDK : `useChat` + `DefaultChatTransport` pointant sur `${VITE_SUPABASE_URL}/functions/v1/ava-admin-command`, auth via session Supabase courante.
- Conversation **single + localStorage** (clé `ava-desk-chat`, dernier 50 messages). Pas de threading dans cette livraison.
- UI : AI Elements (à installer dans le desktop : `bun x ai-elements@latest add conversation message prompt-input tool shimmer`).
- Messages assistant rendus avec `MessageResponse` (markdown), tool calls affichés via `AvaCommandBubble` (composant déjà créé dans `src/components/lemtel/AvaCommandBubble.tsx` — à copier/adapter dans le desktop).
- Confirmation visuelle pour tools destructifs (`block_extension`, `force_sync`) avant exécution côté UI (le edge function audit déjà tout).
- Suggestions contextuelles initiales selon la vue active (CallsView → "Pourquoi tant d'appels manqués hier?", AdminView → "Liste les outages", HomeDashboard → "Résume mes voicemails").
- Gating : panneau visible uniquement si `is_super_admin || is_lemtel_admin` (vérifié via une nouvelle fonction RPC `ava_chat_eligible` ou via le 401 de l'edge function — message clair affiché aux non-admins).
- Erreurs gérées : 429 (rate limit) → toast warning, 402 (crédits) → toast error avec lien Settings, network → bandeau retry.

### Hors périmètre (à planifier ensuite)
- Phase 2 : tenant switcher dans le TitleBar, auth bridge, RolePortalGuard desktop.
- Phase 3 : nouveau sync service edge function (cron pg_cron) + tables `telecom_sync_*` étendues.
- Phase 4-5 : portails natifs complets My Extension / Telecom Admin (extensions, IVR, queues, DIDs, routing, hours) — pour l'instant le `PortalTab.tsx` webview reste l'accès admin/end-user complet.
- Phase 6 : dashboards AI Analytics admin/end-user.
- Phase 8 : QA isolation tenant, packaging electron-packager, tests rôles.

### Appendice technique
- Fichiers nouveaux (3) : `src/styles/desk-tokens.css`, `src/components/ui/DeskCard.tsx`, `src/components/console/AvaChatPanel.tsx`.
- Fichiers modifiés (~6) : `ConsoleLayout.tsx`, `LeftRail.tsx`, `TitleBar.tsx`, `HomeDashboard.tsx`, `App.tsx` (import tokens), `index.tsx` (Cmd+J shortcut).
- Deps à ajouter au `apps/ava-softphone-desktop/package.json` : `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible` (si pas déjà), `framer-motion`.
- AI Elements : `bun x ai-elements@latest add conversation message prompt-input tool shimmer` dans `apps/ava-softphone-desktop`.
- Aucune migration DB. Aucune nouvelle edge function (réutilise `ava-admin-command` existante).
- Vérification : lancer `cd apps/ava-softphone-desktop && bun run dev`, ouvrir l'app, vérifier nouveau look + panneau chatbot répond à "list outages" avec une tool card.
