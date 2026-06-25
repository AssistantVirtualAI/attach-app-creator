Quatre chantiers Phase 5, tous dans `/mplanipret` (org AVA), zéro changement de tables/Edge Functions existantes.

## 1. Historique AVA + recherche + brouillons par contact
- Nouveau composant `AvaHistorySheet.tsx` ouvert depuis l'en-tête de l'onglet AVA (Messages) et depuis l'overlay vocal.
- Liste groupée par jour des messages `planipret_ava_conversations` (déjà filtrés `user_id`), avec badge audio/texte (`metadata.mode`).
- Barre de recherche locale (filtre `ilike` côté client sur le batch chargé + bouton « Charger plus »).
- Brouillons par contact : nouveau hook `useAvaDraft(contactKey)` qui lit/écrit `localStorage` clé `pp-ava-draft:{user_id}:{contactKey}`. Auto-restauration au montage de l'AvaChat / overlay vocal quand un `contactKey` est fourni (par défaut `global`).
- Quand on tape dans le Composer AVA → enregistrement debounce 400 ms. Quand AVA répond avec succès → brouillon effacé.

## 2. Workflow « Résumer avec AVA » réutilisable
- Nouveau composant `AvaSummarizeSheet.tsx` (drawer 92 %) acceptant `{ source: "sms" | "team" | "email", title, content, contextMeta }`.
- 3 niveaux : **Court** (1 phrase), **Standard** (3 phrases + action), **Détaillé** (résumé + points clés + prochaine étape).
- Bouton « Copier » (clipboard) et « Coller dans réponse » (callback `onInsert`).
- Appel unique à `pp-ava-proactive` avec un prompt formé côté client selon le niveau. Aucun changement Edge Function.
- Branchement :
  - SMS ThreadView → menu kebab → « Résumer la conversation »
  - Team #general → menu kebab → « Résumer le canal »
  - Emails → remplace le bouton actuel « Résumer avec AVA » par ce composant partagé + option « Insérer dans une réponse ».

## 3. Logique complète « pp-ava-proactive »
- Nouveau service client `src/services/avaProactive.ts` qui wrappe `supabase.functions.invoke("pp-ava-proactive", …)` et normalise la réponse en `{ reply, suggestions: AvaSuggestion[], openCoach?: boolean, openVoice?: boolean }`.
- Type `AvaSuggestion = { id, label, kind: "call" | "sms" | "email" | "reminder" | "maestro_action", payload }`.
- Quand `openVoice: true` → appel `openAva()` (déjà dans le context shell).
- Quand `openCoach: true` → ouvre `CoachOverlay` (nouveau, mini drawer 50 %) montrant les suggestions + transcript live des derniers messages.
- Boutons d'action :
  - `call` → `openDialer(number)`
  - `sms` → navigation `/mplanipret/messages` + pré-remplissage du composer (param URL)
  - `reminder` → insert dans `planipret_reminders`
  - `maestro_action` → `supabase.functions.invoke("maestro-pipeline-orchestrator", { body: payload })` (déjà existant)
- Card « 🤖 AVA recommande » du MHome consomme ce service au lieu de mocks.

## 4. Onglet « Équipe » (membres + dispo + actions M365)
- Nouvelle sous-tab dans `MMessages` : `team-roster` (ou intégration sous l'actuelle « Équipe » via toggle « Chat / Équipe »).
- Requête `planipret_profiles` filtrée par même organisation (`organization_id` ou `is_planipret_member()`), champs : `full_name, email, extension, status, last_seen_at, voice_agent_enabled, avatar_url`.
- Disponibilité visuelle : pastille verte (en ligne <2 min), jaune (idle <30 min), grise (offline). Source : `last_seen_at`.
- Actions rapides par membre :
  - **Appeler** → `openDialer(extension)`
  - **SMS** → ouvre ThreadView sur l'extension
  - **Email M365** → ouvre `EmailComposeSheet` pré-rempli (`to=email`)
  - **Mention chat** → insert dans `planipret_team_messages` avec `@<full_name>`
- Pull-to-refresh + skeletons.

## Détails techniques
- Aucune nouvelle table, aucune nouvelle migration, aucun nouveau secret.
- `pp-ava-proactive` reste tel quel — on enrichit côté client la structure attendue (fallback gracieux si les champs manquent).
- Maestro déclenché via Edge Function existante `maestro-pipeline-orchestrator`.
- Tous les nouveaux composants sous `src/pages/planipret/mobile/` ou `src/components/planipret/ava/`.
- Tous les overlays restent `absolute` à l'intérieur du `<Frame>` (jamais `fixed`).
- Recherche : pas de FTS serveur, filtre client (jusqu'à 500 derniers messages chargés).

## Ordre d'exécution suggéré
1. Service `avaProactive` + types (base pour les autres).
2. `AvaSummarizeSheet` partagé + branchement SMS/Team/Email.
3. Historique AVA + brouillons localStorage.
4. CoachOverlay + intégration MHome card.
5. Onglet Équipe (roster + actions M365).

Tu valides cet ordre ou tu veux que je commence par un chantier précis ?