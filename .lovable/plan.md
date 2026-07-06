## Objectif

Abandonner l'approche WebRTC/WSS (port 7443 fermé) sur le mobile Planiprêt et adopter le **Click-to-Call REST NS-API v2** comme mode d'appel par défaut. Garder la porte ouverte pour un vrai WebPhone plus tard, mais uniquement via credentials dynamiques (jamais d'URL WSS en dur).

## Ce qui change

### 1. `supabase/functions/pp-ns-calls/index.ts` — payload conforme NS-API

Actuellement le POST `?action=start` envoie `{ destination, caller_id_number, caller_id_name }`. On le remplace par le payload officiel NetSapiens :

```json
{
  "synchronous": "yes",
  "call-id": "<uuid>",
  "call-orig-user": "<extension>@<domain>",
  "call-term-user": "<numéro client normalisé E.164>",
  "auto-answer-enabled": "no"
}
```

- Génération d'un `call-id` UUID côté edge function.
- Normalisation E.164 du numéro (déjà faite dans `ns-calls`, on la remonte ici).
- Insertion d'une ligne `planipret_phone_calls` avec `direction=outbound`, `status=outbound_ringing`, `ns_call_id`, comme fait `ns-calls`.
- Audit log `CALL_START`.

Le poste de l'agent sonne d'abord, puis NetSapiens rappelle le client — plus besoin de SIP dans le navigateur.

### 2. `src/pages/planipret/mobile/MHome.tsx` — désactiver le softphone WebRTC

- Retirer le bouton "reconnect" SIP et l'attente d'événement `pp:sip-ready` (source des timeouts 20s dans les logs).
- Remplacer le bloc "statut téléphone" par un simple indicateur "Prêt à appeler (mode Click-to-Call)".
- L'appel se déclenche par `pp-ns-calls?action=start` → toast "Votre téléphone va sonner…".

### 3. `src/pages/planipret/mobile/MCalls.tsx` — même flux

- Le dialer envoie `to_number` à `pp-ns-calls start`. Aucun changement UI majeur, juste s'assurer que le toast dit "sonne votre appareil".
- Les actions `answer/hold/transfer/disconnect` restent (PATCH REST déjà en place).

### 4. Softphone JsSIP — mis en veille (pas supprimé)

- `src/lib/softphone/jssipProvider.ts` et `ns-resolve-sip-credentials` restent en place mais ne sont plus câblés dans `MHome`. On garde le code pour l'Option 2 future.
- Suppression des `dispatchEvent("pp:sip-ready")` depuis les écrans mobiles.
- Aucun code d'URL WSS en dur ne sera ajouté (les fallbacks `pbxnode.lemtel.tel:7443` existants restent commentés/désactivés).

### 5. Push entrants (préparation, pas d'implémentation cette itération)

- Ajouter un TODO documenté dans `pp-ns-users` pour, lors du provisioning d'un device, poser `device-push-enabled: "yes"`. Pas d'appel FCM/APNs dans cette itération — juste préparer le terrain.

## Ce qui ne change PAS

- Toutes les autres edge functions NS-API (`pp-ns-cdr`, `pp-ns-voicemail`, `pp-ns-sms`, `pp-ns-contacts`, `pp-ns-recordings`, `pp-ns-users`).
- Les pages `MVoicemail`, `MMessages`, `MContacts`, `MPipeline`, `MStats`.
- La garde `MplanipretGuard` et le routage `/mplanipret/*`.
- Le secret `NS_SIP_WSS_URL` reste — il sera réutilisé le jour où l'Option 2 (WebPhone in-app avec credentials dynamiques) sera activée.

## Vérification après build

1. Depuis `/mplanipret/calls`, taper un numéro → cliquer Appeler → attendre le toast "votre appareil va sonner".
2. Vérifier dans `planipret_phone_calls` qu'une ligne `outbound_ringing` est créée avec un `ns_call_id`.
3. Vérifier que `/mplanipret/home` ne déclenche plus de tentative de reconnexion SIP (plus de log `registration wait finished timeout 20003ms`).
