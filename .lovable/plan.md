
# Phase 1 — AVA Assistant IA + Emails Outlook

Portée limitée : **Outlook (lecture/envoi/analyse)** + **chat AVA avec confirmations**. Teams, brief matinal, webhooks Graph, et Maestro CRM seront livrés dans les phases suivantes.

## Prérequis à confirmer

- **Clé Anthropic** requise : je demanderai `ANTHROPIC_API_KEY` via `add_secret` (modèle `claude-sonnet-4-5`).
- **OAuth Microsoft par courtier** : la fonction `ms365-oauth-exchange` existe déjà. Je vais vérifier que les tokens (`ms_access_token`, `ms_refresh_token`, `ms_token_expires_at`) sont bien stockés par broker dans `planipret_profiles` et ajouter un helper de refresh automatique.
- **Actions Maestro** : mockées → journalisées dans `planipret_ava_action_log` avec `execution_mode='mock'`. UI affichera « Sera exécutée quand Maestro sera branché ». Aucun appel externe.

## 1. Base de données (migration)

```sql
CREATE TABLE public.planipret_ava_email_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES planipret_profiles(id) ON DELETE CASCADE,
  ms_message_id text NOT NULL,
  email_subject text,
  email_from text,
  email_from_name text,
  intent text,           -- contrat_signe | nouveau_lead | demande_rdv | documents_recus | question_info | autre
  urgency text,          -- high | medium | low
  lead_score int,
  key_info jsonb,
  proposed_actions jsonb NOT NULL,
  notification_summary text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(broker_id, ms_message_id)
);

CREATE TABLE public.planipret_ava_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES planipret_profiles(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES planipret_ava_email_analyses(id) ON DELETE SET NULL,
  action_type text NOT NULL,   -- email_reply | maestro_task | maestro_note | calendar_event | ...
  action_params jsonb,
  modified_content text,
  execution_mode text DEFAULT 'live',  -- live | mock
  success boolean,
  result jsonb,
  error text,
  modified_by_broker boolean DEFAULT false,
  executed_at timestamptz DEFAULT now()
);
```

+ GRANTs (`authenticated`, `service_role`) + RLS scopée sur `broker_id = auth.uid()` + ajout au `supabase_realtime` publication.

## 2. Edge Functions

**`ms365-graph-proxy`** (nouvelle) — appelle Graph pour le courtier connecté avec refresh automatique du token.
- `GET /me/messages` (liste, filtres, pagination)
- `GET /me/messages/{id}` (détail + body HTML)
- `GET /me/messages/{id}/attachments/{aid}` (téléchargement)
- `POST /me/sendMail`
- Auth : JWT courtier → charge tokens depuis `planipret_profiles` → refresh si expiré.

**`ava-email-analyzer`** — analyse un email via Claude.
- Input `{ ms_message_id }`
- Fetch email via `ms365-graph-proxy`
- Appel Claude (`claude-sonnet-4-5-20250929`) avec prompt JSON structuré (schéma cité dans le prompt utilisateur)
- Insert dans `planipret_ava_email_analyses`
- Broadcast Realtime channel `ava-analyses-{broker_id}`
- Retourne l'analyse

**`ava-action-executor`** — exécute une action approuvée.
- Input `{ analysis_id, action_id, modified_content? }`
- Switch sur `action_type` :
  - `email_reply` → `ms365-graph-proxy` `POST /me/sendMail`
  - `calendar_event` → `ms365-graph-proxy` `POST /me/events`
  - `maestro_*` → **mock** : insert dans `planipret_ava_action_log` avec `execution_mode='mock'`, `success=true`, note « Maestro non branché »
- Log toujours dans `planipret_ava_action_log`

## 3. UI mobile — `/planipret/mobile/messages`

**Onglet 📧 Emails** (`src/components/planipret/mobile/messages/OutlookInbox.tsx`)
- Header : logo Outlook #0078D4, badge « Connecté » ou CTA « Se connecter avec Microsoft » (réutilise OAuth existant).
- Filtres : dossiers (Boîte, Envoyés, Brouillons, Importants, Supprimés).
- Liste virtualisée : avatar initiales, expéditeur/sujet en gras si non lu, aperçu, date relative, 📎, importance, point bleu non lu.
- Query : React Query, `useInfiniteQuery`, `$top=30` par page.
- Bottom sheet détail email (`OutlookEmailDetail.tsx`) : sujet, expéditeur/dest, corps HTML sanitisé via `DOMPurify`, pièces jointes téléchargeables.
- Actions sticky : Répondre / Répondre à tous / Transférer / Supprimer / Important / **🤖 Analyser avec AVA**.
- Composer (`OutlookComposer.tsx`) : full-screen, À/Cc/Sujet/corps + envoi.

**Onglet 🤖 AVA** (`src/components/planipret/mobile/messages/AvaAssistant.tsx`)
- Chat UI (gradients spécifiés). Header avatar 🤖 + badges intégrations.
- Suggestions rapides (chips) — Phase 1 : « 📧 Résumer mes courriels non lus », « ✏️ Rédiger un email », « 🔍 Analyser dernier email ».
- Historique local (state) — pas de persistance en Phase 1.
- Sur clic « Analyser avec AVA » depuis un email → ouvre l'onglet AVA avec la carte d'analyse rendue.
- **Composant clé `AvaProposedActionsCard.tsx`** :
  - Rend `proposed_actions` comme cartes numérotées (1️⃣ 2️⃣ ...).
  - Chaque brouillon éditable inline (textarea repliable).
  - Boutons `[✅ Tout faire] [✏️ Modifier] [❌ Skip]` + boutons individuels.
  - Sur exécution → appelle `ava-action-executor`, affiche progression, puis « ✅ Effectué » avec liens (email envoyé ouvre `/planipret/mobile/messages/sent/{id}`; Maestro affiche badge « Sera synchronisé quand Maestro sera branché »).
- Réception Realtime : nouvelle analyse push → carte apparaît en haut du fil.

## 4. Intégration & routage

- Ajout de `useMs365Connection()` hook (statut token + bouton connect).
- L'onglet **👥 Équipe** est laissé inchangé (Teams = phase suivante).
- Pas de push FCM en Phase 1 (Realtime uniquement pour l'instant) — les notifications push seront dans la phase Teams/brief.

## 5. Secrets nécessaires

- `ANTHROPIC_API_KEY` (à demander)
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` : déjà configurés (Phase MS365 SSO précédente) — je vérifierai.

## Ce qui est explicitement HORS scope Phase 1

- Onglet Teams / Graph chats
- Webhooks Graph pour push automatique sur nouveaux emails (l'analyse est déclenchée manuellement via bouton ou refresh)
- Renouvellement CRON des subscriptions
- Brief matinal 8h00
- Notifications push FCM/APNs
- Écran paramètres AVA (More tab)
- Intégration Maestro CRM réelle
- Intégration calendrier (les actions `calendar_event` seront branchées quand on activera Teams+webhooks)

Souhaitez-vous que je réduise davantage (p. ex. remettre `calendar_event` en mock aussi pour ne toucher qu'à `sendMail` en Phase 1), ou est-ce que ce périmètre convient ?
