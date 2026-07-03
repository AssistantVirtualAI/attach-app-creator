
## Objectif
Aligner l'app mobile courtier (`/mplanipret` + l'aperçu `/planipret/mobile`) sur la configuration admin (`/planipret/admin`) : extension bien synchronisée, appels sortants fonctionnels, CDR / enregistrements / voicemails visibles, transcription + notes IA automatiques dès qu'un enregistrement arrive. Portée : chaque courtier ne voit que ses propres données.

## 1. Extension bien synchronisée
- Au boot de `PlanipretMobile.tsx`, appeler `ns-resolve-sip-credentials` (déjà en place mais silencieux) puis persister le résultat dans `planipret_profiles` (`sip_extension`, `sip_domain`) si absent/différent, et dans `sessionStorage.pp_sip_config`.
- Ajouter une bannière `ExtensionSyncStatus` en haut de MHome : état (résolue / manquante / erreur) + bouton "Resynchroniser" qui rappelle `ns-resolve-sip-credentials` et met à jour le profil. i18n FR/EN.
- Exposer `useExtensionSync()` (hook partagé) pour que MCalls / dialer / MVoicemail utilisent la même source (extension + org).

## 2. Appels sortants (WebRTC + fallback click-to-call)
- Le dialer actuel appelle déjà un backend (`dialer.callFailed`). Le rebrancher pour :
  1. Tenter WebRTC (SIP.js) si `pp_sip_config` prêt et `wssUrl` dispo.
  2. Sinon fallback : `supabase.functions.invoke("ns-click-to-call", { body: { to, from_extension } })`.
- Ajouter `supabase/functions/ns-click-to-call/index.ts` (nouveau) — POST NS-API `/click-to-call` avec l'extension du courtier authentifié (via `authBroker`). Journalise dans `planipret_phone_calls` en `status='initiated'`.
- Bouton d'appel dans MCalls / MContacts / RecordingsList utilise le même helper `useOutboundCall()`.

## 3. CDR, enregistrements, voicemails (isolation par extension)
- Vérifier/renforcer que `ns-cdrs`, `pp-ns-recordings`, `ns-voicemails` filtrent bien par `profile.extension` (déjà fait via `nsPath(domain, extension, ...)` — juste ajouter un test dans `pp-call-e2e-check` pour empêcher toute fuite).
- MCalls et RecordingsList existent déjà ; ajouter un pull-to-refresh + un état vide clair ("Aucun appel — extension: XXX").
- Ajouter un onglet "Voicemail" déjà présent (MVoicemail) — vérifier que la lecture Bearer marche (mêmes fix que ns-recordings).

## 4. Transcription + notes IA automatiques (parité admin)
- Créer un job auto : nouvelle fonction `pp-auto-ai-pipeline` déclenchée par un cron (existant `pbx_ai_jobs`) OU par un trigger DB sur `planipret_phone_calls` insert with `has_recording=true`.
  - Étape 1 : `ai-transcribe-call` (fallback OpenAI Whisper → LOVABLE_API_KEY gpt-4o-mini-transcribe).
  - Étape 2 : `ai-analyze-call` (résumé + prochaines étapes, mêmes prompts que l'admin).
- Ajouter table `planipret_ai_insights` (déjà existante) — écrire `summary`, `next_steps`, `sentiment`, `key_topics`.
- Dans MCalls (détail d'appel) : afficher automatiquement transcription + notes IA dès qu'elles sont dispo. Bouton "Régénérer" en cas d'échec.
- Ajouter un badge de statut : "Transcription en cours…", "Notes IA prêtes", "Échec — réessayer".

## 5. Route jumelle `/planipret/mobile`
- La route `/planipret/mobile` (aperçu web) réutilise déjà `PlanipretMobile.tsx`. Rien à dupliquer — les mêmes changements se propagent automatiquement.
- Vérifier que la garde ne redirige pas cet aperçu vers `/planipret/admin` (respecte `mplanipret-isolation-locked.md` : on ne touche PAS aux routes /mplanipret/*).

## 6. Vérification bout-en-bout
- Étendre `pp-call-e2e-check` pour valider dans l'ordre : extension résolue → CDR visibles → enregistrement lisible (Bearer) → transcription dispo → AI insights présents.
- Ajouter un bouton "Diagnostic" dans MMore qui invoque cette fonction et affiche le rapport.

## Fichiers touchés
**Créés**
- `supabase/functions/ns-click-to-call/index.ts`
- `supabase/functions/pp-auto-ai-pipeline/index.ts`
- `src/hooks/planipret/useExtensionSync.ts`
- `src/hooks/planipret/useOutboundCall.ts`
- `src/components/planipret/mobile/ExtensionSyncStatus.tsx`
- `src/components/planipret/mobile/AiInsightsPanel.tsx`

**Édités**
- `src/pages/planipret/PlanipretMobile.tsx` (hydrate extension + expose au dialer)
- `src/pages/planipret/mobile/MCalls.tsx` (auto AI panel, badges, régénérer)
- `src/pages/planipret/mobile/MHome.tsx` (bannière sync)
- `src/pages/planipret/mobile/MMore.tsx` (bouton diagnostic)
- `src/components/planipret/mobile/recordings/RecordingsList.tsx` (bouton appel via useOutboundCall)
- `supabase/functions/pp-call-e2e-check/index.ts` (ajout étape extension + AI)
- `src/lib/i18n/mplanipret.ts` (nouvelles clés FR/EN)

## Contraintes respectées
- Aucune modification des routes `/mplanipret/*`, de `MplanipretGuard`, ni d'`App.tsx`.
- Isolation : chaque courtier ne voit que sa propre extension (aucun changement RLS).
- Pas de nouveaux secrets requis (OPENAI_API_KEY et LOVABLE_API_KEY déjà en place).
