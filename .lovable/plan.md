
## Problème

Actuellement `ns-resolve-sip-credentials` prend **le premier device softphone** de l'extension NS-API et **rote son mot de passe** à chaque login mobile. Résultat : quand l'app mobile s'enregistre, elle réutilise/écrase le device du widget Maestro. Un seul endpoint reste enregistrable → un seul appareil sonne.

Sur NetSapiens, il suffit d'avoir **deux devices SIP distincts** enregistrés sous la même extension pour qu'ils sonnent en parallèle (fork natif). Il faut donc réserver un device dédié « mobile » qui ne touche jamais au device du widget.

## Changements

### 1. `supabase/functions/ns-resolve-sip-credentials/index.ts`
- Accepter un paramètre `client_type` dans le body (`"mobile"` par défaut pour cette fonction ; `"widget"` réservé au widget Maestro).
- Construire un `deviceId` déterministe :
  - `mobile`  → `${extension}_mobile`
  - `widget`  → `${extension}_web` (inchangé côté Maestro)
- Chercher **uniquement** le device qui correspond à ce `deviceId` exact (au lieu du « premier softphone trouvé »).
- Si absent → créer ce device (POST `/devices`) avec un mot de passe dédié.
- Si présent → réutiliser le mot de passe stocké en Vault ; ne jamais rotate le mot de passe d'un autre device.
- Aucune modification du device widget existant.

### 2. Stockage du secret par client
- Nouveau nom de secret Vault : `pp_sip_${profile.id}_${client_type}`.
- Nouvelle colonne facultative sur `planipret_profiles` : `ns_sip_password_ref_mobile` (le champ `ns_sip_password_ref` actuel reste pour compatibilité widget).
- Migration SQL courte (ajout de colonne texte nullable).

### 3. Appel côté app mobile
- `useMplanipretSoftphone` passe déjà par `supabase.functions.invoke("ns-resolve-sip-credentials", { body: {} })`. On ajoute `body: { client_type: "mobile" }`.
- Aucun changement d'UI.

### 4. Provisioning initial (fonction `provision-softphone-user`)
- Vérifier qu'à la création d'un nouveau broker, on ne crée que le device `_web` (widget). Le device `_mobile` sera créé à la demande, au premier login mobile.

### 5. Détails techniques NetSapiens
- Fork parallèle par défaut : rien à activer côté extension.
- Contact de registration WSS différent (mobile / widget) → NS route correctement l'INVITE aux deux.
- ICE restart / re-registration mobile ne touchent que le device `_mobile`.

## Vérifications post-implémentation
- Appel entrant → widget Maestro **et** app mobile sonnent simultanément.
- Décrocher sur l'un raccroche l'autre (cancel natif NS).
- Rotation de mot de passe mobile n'invalide plus le widget.
- `pp-call-e2e-check` continue de passer.

## Questions ouvertes (non bloquantes)
- Nom exact du device widget existant sur NS-API pour le broker de test ? (par défaut on cible `${extension}_web` ; si c'est autre chose ex. `${extension}_app`, je lis le nom depuis les devices existants au premier appel et je le mémorise dans `planipret_profiles.ns_widget_device_id` pour ne plus jamais y toucher.)
