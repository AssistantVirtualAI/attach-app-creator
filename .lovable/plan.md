
## 1. Edge function `pp-mobile-device-status`

Retourne, pour chaque profil courtier avec `ns_extension`, un rapport :
- `broker_id`, `full_name`, `email`, `ns_extension`
- `ns_mobile_device_id` (colonne DB)
- `ns_exists` : device présent sur NS-API pour cet id
- `ns_widget_device_id` (colonne DB) et présence widget sur NS
- `has_vault_secret` : booléen (via lookup Vault du secret `pp_sip_{id}_mobile`)
- `provisioned_at` : date la plus récente de `planipret_ns_migration_log` avec `action='create_mobile_device'` et `status='ok'`
- `last_error` : dernier log en erreur (le cas échéant)
- `state` : `ok` | `missing` | `error` | `partial`

Admin-gated (super_admin ou admin). Retourne aussi un compteur agrégé.

## 2. Edge function `pp-mobile-testcall`

- Input : `{ broker_id: uuid, from_number?: string }`
- Admin-gated.
- Lit `ns_extension` du profil ciblé.
- Déclenche un appel de test via NS-API `POST /calls` (ou `ns-calls action:start`) sourcé depuis le numéro admin, destination = l'extension du courtier → NS forke sur **tous** ses devices enregistrés (`_web` widget + `_mobile`).
- Génère un `test_call_id` (UUID) et l'insère dans `planipret_call_sessions` `(call_id, direction='inbound', broker_id, remote_number='TEST')`.
- Retourne `{ ok, ns_call_id, test_session_id, tip: "Décroche depuis un des appareils; l'autre doit s'éteindre." }`.
- Log dans `planipret_ns_migration_log` action=`test_call`.

## 3. Page admin `MobileDevicesVerification`

Route : `/planipret/admin/mobile-devices` (fr : « Vérification devices mobiles »).

Contenu :
- En-tête + bouton « Rafraîchir » qui appelle `pp-mobile-device-status`.
- Cartes de compteurs (total, OK, manquants, erreurs).
- Table triable/filtrable :
  - Courtier, extension, device mobile (id), widget id, état (pill), provisionné le, dernière erreur, action « Appel test ».
- « Appel test » ouvre un mini-modal : choix du numéro appelant (défaut : num admin/ligne test) puis lance `pp-mobile-testcall` avec le `broker_id` ; toast avec résultat + `test_session_id`.
- Realtime : souscription sur `planipret_call_sessions` filtrée sur le `test_session_id` renvoyé → affiche en direct « sonne… → répondu par MOBILE / WIDGET → terminé » pour prouver que le fork parallèle fonctionne et que la sync CDR/état est correcte.
- Section « CDR récents (test) » : lecture des 10 derniers `planipret_phone_calls` du courtier ciblé.

Ajout d'une entrée dans la navigation admin Planipret (à côté du dashboard NS-API sync).

## 4. Fichiers touchés

- `supabase/functions/pp-mobile-device-status/index.ts` (créé)
- `supabase/functions/pp-mobile-testcall/index.ts` (créé)
- `src/pages/planipret/admin/PAMobileDevices.tsx` (créé)
- Route ajoutée dans le routeur admin Planipret (recherche du fichier de routes).
- Petite entrée de navigation dans le menu admin Planipret.

## Vérifications post-implémentation

- Bouton « Appel test » sonne widget + mobile ensemble ; décrocher sur l'un stoppe l'autre.
- Le CDR NS-API apparaît dans `planipret_phone_calls` après ~30s.
- La page « Vérification devices mobiles » liste tous les courtiers, montre l'état par ligne.
