# Phase 2 AVA — Teams, Brief matinal, Maestro live

Phase 1 (Outlook webhook + analyse + push) est en prod. On enchaîne avec les 3 blocs restants de la vision AVA.

## Bloc A — Microsoft Teams (Chats + Channels)

**But** : le courtier lit/répond ses conversations Teams depuis l'app mobile Planiprêt, et AVA peut proposer des réponses avec confirmation.

- Edge Functions :
  - `ms365-teams-list` (chats récents + canaux joints, via `/me/chats` et `/me/joinedTeams`)
  - `ms365-teams-messages` (GET messages d'un chat/canal, POST envoi après approbation)
- Réutilise le token MS Graph déjà stocké dans `planipret_profiles` (scopes `Chat.ReadWrite`, `ChannelMessage.Send`, `Team.ReadBasic.All` — ajout au consentement OAuth existant).
- UI mobile : nouvel onglet **Teams** dans `MMessages.tsx` (segmenté Email / SMS / Teams), liste conversations + fil, composer avec bouton "🤖 Suggérer avec AVA" → réutilise `AvaProposedActionsCard` (nouvelle action `teams_reply`).
- Extension de `ava-action-executor` : handler `teams_reply` qui poste dans `/me/chats/{id}/messages`.

## Bloc B — Brief matinal AVA (7h30 heure du courtier)

**But** : chaque matin, AVA résume la journée à venir + priorités et pousse une notif "Bonjour, voici votre journée".

- Table `planipret_ava_morning_briefs` (broker_user_id, date, summary, priorities jsonb, sent_at) + RLS courtier lit siens.
- Edge Function `ava-morning-brief-generator` :
  - Récupère rendez-vous du jour (calendar_integrations), leads chauds (lead_score ≥ 7 des dernières 24h), courriels non traités, tâches Maestro dues.
  - Claude Sonnet 4.5 → résumé FR 4-6 lignes + top 3 priorités.
  - Insère dans la table, appelle `pp-push-notify` avec deep link `/mplanipret/home?brief=today`.
- `pg_cron` toutes les 15 min : sélectionne les courtiers dont `timezone` local = 07:30 et pas de brief pour la date locale → invoque la function.
- UI : `MorningBriefCard.tsx` sur `MHome.tsx` (bandeau haut, dismissible), route `/mplanipret/home?brief=today` scroll-to.

## Bloc C — Maestro tasks live (retire le mock)

**But** : les actions `create_task_maestro` proposées par AVA créent vraiment la tâche dans Maestro CRM.

- Secret : `MAESTRO_API_KEY` + `MAESTRO_BASE_URL` (à demander).
- Dans `ava-action-executor` : remplace la branche mock par un POST authentifié vers `${MAESTRO_BASE_URL}/tasks` avec mapping (title, due_at, client_id résolu via `planipret_maestro_clients` sur le courriel/téléphone de l'analyse).
- Fallback : si client Maestro introuvable, on crée un lead Maestro d'abord puis la tâche, et on logue `client_resolution: created`.
- Rien à changer côté UI — `AvaProposedActionsCard` gère déjà l'affichage du résultat.

## Détails techniques

```text
DB
  planipret_ava_morning_briefs (id, broker_user_id, brief_date, summary, priorities jsonb, sent_at, created_at)
  RLS: courtier SELECT own, service_role ALL
  GRANT SELECT to authenticated, ALL to service_role

Edge Functions (nouvelles)
  ms365-teams-list         (JWT)
  ms365-teams-messages     (JWT, GET+POST)
  ava-morning-brief-generator (verify_jwt=false, appelée par cron)
Edge Functions (modifiées)
  ava-action-executor      (+ handler teams_reply, + Maestro live)
  ms365-mail-webhook-setup (+ scopes Teams pour prochains consents — noop si déjà accordés)

Cron
  select cron.schedule('ava-morning-brief', '*/15 * * * *', $$ select net.http_post(...) $$)

UI
  src/pages/mobile/planipret/MMessages.tsx  (tabs Email/SMS/Teams)
  src/components/mobile/planipret/TeamsThreadList.tsx
  src/components/mobile/planipret/TeamsThreadView.tsx
  src/components/mobile/planipret/MorningBriefCard.tsx
  src/pages/mobile/planipret/MHome.tsx (mount MorningBriefCard)
```

## Ordre d'exécution

1. Bloc B (brief matinal) — autonome, valeur immédiate visible dès demain matin.
2. Bloc A (Teams) — nécessite ré-autorisation OAuth avec scopes Teams.
3. Bloc C (Maestro live) — dès que `MAESTRO_API_KEY` fournie.

## Ce dont j'ai besoin de toi

- **Confirmer l'ordre** ci-dessus (ou en changer).
- **Fuseau horaire par défaut** pour le brief si le courtier n'a pas de `timezone` sur son profil : `America/Toronto` OK ?
- **Maestro** : tu as la clé API + l'URL de base sous la main, ou on ship Bloc C plus tard ?
