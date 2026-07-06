# Fix Click-to-Call Planiprêt Mobile

Objectif : rendre le bouton vert du dialpad fonctionnel en s'assurant que (1) le device SIP `_mobile` du courtier existe côté NS-API, (2) le payload envoyé à NetSapiens est conforme, (3) l'UX indique clairement au courtier de décrocher son téléphone.

## Ce qui change

### 1. `supabase/functions/ns-resolve-sip-credentials/index.ts`

Réécrire pour interroger réellement NS-API au lieu de retourner uniquement des valeurs d'env :

- Auth broker via token Supabase (déjà en place).
- Lire `ns_extension` / `ns_domain` dans `planipret_profiles` pour l'utilisateur connecté.
- `GET /domains/{domain}/users/{ext}/devices/{ext}_{mobile|web}` avec `NS_API_KEY`.
- Si 404 → fallback `GET .../devices` puis chercher un device dont le nom se termine par `_mobile` ou `_web`.
- Extraire de la réponse NS :
  - `device` → `sip_username`
  - `device-sip-registration-password` → `sip_password`
  - `device-sip-registration-core-server` → `sip_proxy` (fallback `core1.cluster1.ucstack.io`)
  - `device-sip-registration-uri` → `sip_uri`
  - `device-sip-registration-state` → `sip_state` (nouveau champ retourné)
- Toujours retourner `sip_wss_url = wss://{coreServer}:443/ws`.
- Si aucun device trouvé → 404 avec `{ error, available_devices, action: "Contact admin / run ns-provision-broker-devices" }`.

Les secrets fixes `NS_SIP_MOBILE_*` / `NS_SIP_WEB_*` deviennent uniquement des fallbacks (device-model + wss).

### 2. `supabase/functions/pp-ns-calls/index.ts` (action `start`)

- Récupérer d'abord le device SIP réel via `GET .../devices/{ext}_{client_type}` pour construire `call-orig-user` à partir du champ `device-sip-registration-uri` (fallback `{ext}_{client_type}@{domain}`).
- Normaliser `to_number` en E.164 (déjà en place).
- Payload envoyé à NS strictement conforme :
  ```json
  {
    "synchronous": "yes",
    "call-id": "<uuid>",
    "call-orig-user": "113_mobile@planipret.ca",
    "call-term-user": "+15145551234",
    "auto-answer-enabled": "no"
  }
  ```
  → Retirer les champs non standards (`destination`, `caller-id-*`, `callback-caller-id-number`, `callid` dupliqué) qui polluent la requête.
- URL: `POST /domains/{domain}/users/{ext}/calls` (sans `?callid=`).
- Accepter statut `200` **ou** `202` comme succès.
- Réponse JSON enrichie : `{ success, call_id, call_orig_user, destination, status: "initiated", message: "Votre téléphone va sonner…", debug: { … } }` — en cas d'erreur inclure `debug.call_orig_user`, `extension`, `domain`, status NS.
- Insertion `planipret_phone_calls` conservée (best-effort).

### 3. `src/hooks/useMplanipretSoftphone.ts` et écran dialer

- Nouveau helper `checkDeviceStatus()` : appelle `ns-resolve-sip-credentials` et renvoie `{ ready, sip_username, sip_state, device_registered }`.
- `handleCallPress` du dialpad devient une machine à états :
  1. `checking` → vérif device
  2. `calling` → invoke `pp-ns-calls` action `start`
  3. `ringing` → afficher « Décrochez votre téléphone pour parler au client »
  4. `active` / `idle` / `error`
- Toasts d'erreur explicites selon `error.action` (extension non liée, device manquant, NS 4xx).
- Retirer toute tentative WebRTC/JsSIP côté mobile Planiprêt — l'audio passe par le device SIP enregistré, pas le navigateur.

### 4. i18n (`src/locales`)

Ajouter les clés `dialpad.checking_device`, `dialpad.initiating_call`, `dialpad.answer_your_phone`, `dialpad.call_active`, `dialpad.call_failed` en FR + EN.

### 5. Panneau admin `NS-API` (`/planipret/admin/integrations`)

Bouton **« Tester mes devices SIP »** :
- Invoke `ns-resolve-sip-credentials` pour `mobile` puis `web`.
- Afficher pour chacun : nom du device, état d'enregistrement (`registered` / `unregistered` / absent), core-server, wss.
- Bloc « Commande curl » copiable pour reproduire l'appel `GET .../devices` avec `NS_API_KEY` masqué.

## Ce qui ne change PAS

- `MplanipretGuard`, routes `/mplanipret/*`, `OrganizationContext`.
- Secrets déjà en place (`NS_API_KEY`, `NS_API_BASE_URL`, `NS_DEFAULT_DOMAIN`, `NS_SIP_*`).
- Le softphone WebPhone du widget web (`/mplanipret` en desktop) continue à utiliser JsSIP contre `113_web` — inchangé.
- Fonctions NS-API secondaires (`pp-ns-cdr`, `pp-ns-voicemail`, `pp-ns-sms`, etc.).

## Détails techniques

- `NS_API_BASE_URL` par défaut `https://voice.ava-telecom.ca/ns-api/v2`.
- Header NS: `Authorization: Bearer ${NS_API_KEY}` (jamais le JWT Supabase).
- Toujours encoder `extension` et `deviceName` avec `encodeURIComponent`.
- Log serveur (edge) : `console.log` pour `call-orig-user`, `call-term-user`, statut NS — utile pour `supabase edge_function_logs`.
- Réponse d'erreur : retourner `status: 200` avec `{ success: false, error, debug }` pour éviter que `supabase.functions.invoke` masque le corps derrière une exception opaque.

## Vérification après build

1. `curl -X POST .../functions/v1/ns-resolve-sip-credentials -H "Authorization: Bearer <user-jwt>" -d '{"client_type":"mobile"}'` → doit retourner `sip_username: "113_mobile"`, `sip_state`, `sip_wss_url`.
2. Bouton « Tester mes devices SIP » dans admin → statut vert pour `_mobile` et `_web`.
3. Depuis `/mplanipret/calls`, composer un numéro → device mobile du courtier sonne → décrocher → NS bridge le client.
4. Vérifier ligne `planipret_phone_calls` avec `direction=outbound`, `status=outbound_ringing`, `ns_call_id`.
5. Logs edge `pp-ns-calls` : `call-orig-user: 113_mobile@planipret.ca`, statut NS `200` ou `202`.
