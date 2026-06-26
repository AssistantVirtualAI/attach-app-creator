## Fix : 29 outils ElevenLabs créés correctement + statut tableau de bord

### 1. `supabase/functions/_shared/ava-tools.ts`
Réécrire `buildAvaToolConfigs()` :
- Paramètres AVA **à plat** dans `request_body_schema.properties` (plus de nested `parameters`, plus de `tool_name` ni `constant_value`).
- Schema final par outil :
  ```
  { tool_config: {
      type: "webhook", name, description, response_timeout_secs: 20,
      api_schema: {
        url, method: "POST",
        request_headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer <anon>",
          "X-Ava-Tool-Name": "<name>"   // routage côté executor
        },
        request_body_schema: {
          type: "object",
          properties: <flat AVA params>,
          required: <required[]>
        }
      }
  }}
  ```
- Outils sans paramètres : envoyer `request_body_schema` minimal `{ type: "object", properties: {} }` (sans `required`).

### 2. `supabase/functions/ava-tool-executor/index.ts`
- Lire `tool_name` depuis le header `X-Ava-Tool-Name` en priorité, fallback `body.tool_name` (rétro-compat).
- `parameters` = soit `body.parameters` (legacy), soit le body brut (nouveau format à plat, en excluant `tool_name`/`session_id`/`parameters`).

### 3. `supabase/functions/elevenlabs-manage-agent/index.ts`
- Dans `elFetch` et `sync_all_tools` : sérialiser proprement les erreurs ElevenLabs (`JSON.stringify` si objet/array — notamment les détails de validation `detail: [{loc, msg, type}]`) au lieu de `[object Object]`.
- Ajouter `console.log` détaillé par outil : nom, status HTTP, body d'erreur brut.
- Dédupliquer les `tool_ids` avant le PATCH agent.
- Renvoyer dans la réponse JSON un tableau `errors_detailed: [{ tool, status, message }]`.

### 4. Déploiement + test
- `deploy_edge_functions(["ava-tool-executor", "elevenlabs-manage-agent"])`
- `curl_edge_functions` → `POST /elevenlabs-manage-agent` `{action: "sync_all_tools"}` avec l'auth de session.
- Lire `edge_function_logs("elevenlabs-manage-agent")` pour confirmer `29/29`.
- Si encore des erreurs, lire le détail JSON renvoyé pour ajuster le schema.

### 5. UI
Aucun changement nécessaire — `ElevenLabsManagementCard` consomme déjà `tools_synced / total_expected / errors`. L'affichage `29/29 outils synchronisés` apparaîtra automatiquement.
