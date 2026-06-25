… (concise)

## Objectif
Garantir qu'aucune configuration ne manque sur les Phases 1→7 du module Planipret mobile, ajouter une couverture de tests minimale et appliquer des améliorations ciblées sans casser l'existant.

## 1. Audit de configuration (lecture seule + corrections additives)

### 1.1 Edge Functions
Vérifier que toutes les fonctions appelées par le front existent et sont déployées :
- `pp-ava-chat`, `pp-ava-proactive`, `pp-search`, `pp-ns-calls`, `pp-ns-cdr`, `pp-ns-auth`, `pp-contact-timeline`, `pp-calendar-sync`, `pp-push-notify`, `pp-vapid-public`, `pp-greeting-*`, `pp-integration-secrets`, `pp-data-retention`, `pp-gdpr-export`, `pp-audit-*`, `maestro-pipeline-orchestrator`.
- Compléter `supabase/config.toml` avec les blocs `[functions.<name>] verify_jwt = …` manquants pour les fonctions PP (par défaut `true`, sauf webhooks publics).
- Vérifier la présence des en-têtes CORS sur chaque fonction PP (patch additif si manquant).

### 1.2 Secrets
- Vérifier via `fetch_secrets` : `LOVABLE_API_KEY` (AVA), clés NetSapiens / Maestro / ElevenLabs / VAPID / Resend si déjà utilisées.
- Si manquant, créer via `ai_gateway--create` (LOVABLE_API_KEY) ou demander à l'utilisateur via `add_secret` (autres).

### 1.3 RLS & GRANT
- Lancer `supabase--linter` et corriger uniquement les findings liés aux tables touchées par les phases 1-7 (`planipret_ava_conversations`, `planipret_reminders`, `planipret_team_messages`, `planipret_contacts`, `planipret_phone_calls`, `planipret_phone_messages`, `planipret_voicemails`, `planipret_pipeline`).
- S'assurer que chaque table a `GRANT` cohérent + policies par `user_id`/organisation.

### 1.4 Routes & contextes UI
- Vérifier que `useOutletContext` expose bien partout : `openAva`, `openDialer`, `openVoice`, `broker`, `org`.
- Ajouter les routes/imports manquants éventuels (`MMore`, `MSearch`).

## 2. Tests

### 2.1 Tests frontend (Vitest + RTL)
Mise en place si absente (`vitest.config.ts`, `src/test/setup.ts`).
Tests ciblés :
- `useAvaDraft` : write/read/debounce/effacement.
- `avaProactive.applyAvaSuggestion` : routage `call`/`sms`/`reminder`/`maestro_action` (mocks supabase + navigate).
- `AvaSummarizeSheet` : changement de niveau déclenche un appel, bouton copier copie le texte.
- `AvaHistorySheet` : recherche filtre la liste, "Charger plus" pagine.
- `CoachOverlay` : clic suggestion → callback `applyAvaSuggestion`.

### 2.2 Tests Edge Functions (Deno)
- `pp-ava-chat/index_test.ts` : OPTIONS = 200 CORS ; POST sans body = 400 ; POST valide renvoie structure `{ reply, suggestions[] }`.
- `pp-ava-proactive/index_test.ts` : idem + fallback gracieux quand LLM down.
- `pp-search/index_test.ts` : recherche basique + auth requise.

### 2.3 Smoke E2E (Playwright via shell, optionnel)
Charger `/mplanipret`, vérifier que les 6 onglets s'ouvrent sans erreur console.

## 3. Améliorations transverses

- **Gestion d'erreurs unifiée** : helper `toastError(e)` partagé, utilisé par tous les `catch` AVA / Maestro / NS.
- **Loading & skeletons** : compléter les skeletons manquants dans `AvaHistorySheet` (pagination), `Team roster`, `CoachOverlay`.
- **Pull-to-refresh** : extraire `usePullToRefresh` hook et l'appliquer uniformément à MHome, MMessages (chaque sous-tab), MPipeline, MStats, MContacts, MVoicemail.
- **Debounce recherche** : 250 ms sur `AvaHistorySheet` et roster Équipe.
- **A11y** : `aria-label` sur tous les boutons icône-only des nouveaux composants (CoachOverlay, AvaHistorySheet, AvaSummarizeSheet, InboundCallOverlay).
- **Persist last tab** : mémoriser onglet actif Messages (`sms|team|ava|email|roster`) en `localStorage`.
- **Optimistic UI** : envoi SMS / message Équipe / reminder → affichage immédiat puis réconciliation.
- **AVA budget guard** : court-circuit côté client si `LOVABLE_API_KEY` retourne 402/429 → toast explicatif + désactivation temporaire (60 s).

## 4. Livrables
- `supabase/config.toml` mis à jour (verify_jwt par fonction PP).
- Tests : `src/**/__tests__/*.test.ts(x)` + `supabase/functions/**/index_test.ts`.
- Nouveau hook `src/hooks/usePullToRefresh.ts`, helper `src/lib/toastError.ts`.
- Branchements dans MHome/MMessages/MPipeline/MStats/MContacts/MVoicemail.
- Patchs additifs CORS/GRANT si findings.

## 5. Hors scope
- Pas de nouvelle table, pas de nouvelle fonctionnalité produit.
- Pas de modif de la landing ni des composants admin.
- Pas de rotation de clé existante.

Tu valides ? Je peux aussi restreindre à un sous-ensemble (par ex. uniquement audit + tests, sans les améliorations UX) si tu préfères un périmètre plus court.