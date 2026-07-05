## Problème

Le client (`MMessages.tsx`) appelle `supabase.functions.invoke("pp-ns-sms", { body: { action: "threads" } })`. `functions.invoke` envoie toujours en **POST** avec l'action dans le **body JSON**.

L'edge function `pp-ns-sms` lit `action` uniquement depuis les **query params** de l'URL et matche sur `req.method === "GET"`. Résultat : toutes les requêtes tombent sur `"Action inconnue: threads"` → 400 → « Edge Function returned a non-2xx status code ». Ça casse l'onglet SMS et toute la page Messages.

## Correctif

Rendre `pp-ns-sms` tolérant à l'appel via `functions.invoke` :

1. Parser le body JSON une fois en haut du handler (POST/GET), et lire `action`, `thread_id`, `limit`, `to`, `message`, `type` depuis body **ou** query params (body prioritaire).
2. Router sur `action` sans dépendre de `req.method` :
   - `threads` → GET `/messagesessions`
   - `messages` (nécessite `thread_id`) → GET messages du thread
   - `sms-numbers` → GET `/smsnumbers`
   - `send` (nécessite `to` + `message`) → POST NS-API
3. Garder le OPTIONS/CORS et le `requirePlanipretBroker` inchangés.
4. Toujours retourner `corsHeaders` sur les réponses d'erreur (déjà via `jsonResponse`).

## Vérification

- Redéployer `pp-ns-sms`.
- `curl_edge_functions` POST `/pp-ns-sms` avec `{"action":"threads"}` → attendu 200 `{ok:true,threads:[...]}`.
- Ouvrir `/planipret/mobile` onglet SMS → la liste des threads charge sans erreur, les autres onglets (Équipe, Teams, Annuaire, AVA, Emails) restent fonctionnels.

## Fichiers modifiés

- `supabase/functions/pp-ns-sms/index.ts`
