## Diagnostic

### 1. « Configurer AVA automatiquement » → erreur

Le bouton appelle `elevenlabs-manage-agent` action `create_agent`. Vérifié :
- ✅ Tu as bien le rôle `planipret_admin` (pas de 403)
- ✅ `ELEVENLABS_API_KEY` est configurée
- ❌ Le payload envoyé à ElevenLabs utilise `llm: "claude-3-5-sonnet"` — **ce nom de modèle n'est plus accepté** par l'API ElevenLabs Convai (déprécié). C'est ce qui fait remonter l'erreur après le clic.
- ❌ Le payload utilise aussi une **ancienne structure** `conversation_config.agent.prompt.llm` que la nouvelle API ElevenLabs a déplacée vers `agent.prompt.llm_id` (selon version) + `model` au niveau racine.

**Important** : la clé Claude (`ANTHROPIC_API_KEY`) n'est PAS utilisée par ce bouton — ElevenLabs appelle Claude lui-même côté ElevenLabs, donc avoir sauvegardé la clé Claude dans Lovable ne change rien à cette erreur. C'est une confusion à clarifier dans l'UI.

### 2. Système téléphonique → ne fonctionne pas

Vérifié dans `planipret_profiles` pour ton compte :
- `extension` = **NULL**
- `ns_jwt` = absent

Conséquence : `ns-auth` retourne `400 "ns_extension manquante"`, donc aucun appel softphone NetSapiens ne peut s'authentifier. ElevenLabs n'a rien à voir — la téléphonie passe par NetSapiens (NS-API), pas par ElevenLabs.

Les 350+ courtiers existent côté NetSapiens, mais leurs `extension` ne sont pas backfillés dans `planipret_profiles`.

---

## Plan de correction

### A. Fix « Configurer AVA automatiquement »
1. Dans `supabase/functions/elevenlabs-manage-agent/index.ts` :
   - Mettre à jour le payload `create_agent` au format ElevenLabs Convai actuel : `llm: "claude-sonnet-4-5"` (ou modèle dispo, à découvrir via `GET /v1/convai/llms`).
   - Ajouter une action `list_llms` qui appelle `/v1/convai/llms` pour récupérer dynamiquement les modèles supportés, et utiliser le 1er Claude dispo en fallback.
   - Améliorer le message d'erreur : si ElevenLabs retourne `model_not_supported`, renvoyer un texte clair.
2. Dans `ElevenLabsManagementCard.tsx` :
   - Ajouter une note sous le bouton : « Cette configuration utilise la clé ElevenLabs uniquement. La clé Claude n'est pas requise ici. »
   - Charger la liste des LLMs via `list_llms` et la proposer dans `LlmEditor` au lieu de la liste codée en dur.

### B. Fix téléphonie (extension manquante)
1. **Court terme — ton compte** : SQL ponctuel pour assigner ton extension (à confirmer laquelle : `300` apparaît dans les logs de `softphone-credentials`).
2. **Long terme — backfill** : nouvelle action dans `pp-ns-users` action `sync_extensions` qui, pour chaque `planipret_profiles` sans `extension`, fait un match par `email`/`name` avec la liste NetSapiens et upsert `extension`.
3. Bouton « Synchroniser les extensions NS » dans `PAUsers.tsx` (admin), qui déclenche cette action et affiche le nombre de profils mis à jour.
4. Dans `ns-auth`, si `extension` manque, retourner un message plus utile : « Aucune extension NetSapiens liée à ce compte. Demande à un admin de lancer la synchro. »

### C. Vérification
- Tester `create_agent` via `supabase--curl_edge_functions` après le fix → attendre `success: true` avec `agent_id`.
- Tester `ns-auth` après backfill de ton extension → attendre `success: true, expires_in: 3600`.

### Détails techniques
- Source du modèle Claude actuel ElevenLabs : `GET https://api.elevenlabs.io/v1/convai/llms` (auth `xi-api-key`).
- L'extension `300` vue dans les logs vient de `pbx_softphone_users.portal_user_id` — à confirmer avant de l'assigner à `planipret_profiles.extension`.

Confirme-moi : (1) quelle extension NetSapiens t'appartient (300 ?), (2) OK pour ajouter le bouton de backfill admin ?