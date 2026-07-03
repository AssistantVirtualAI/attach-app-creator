
## Objectif

1. Isoler strictement le device mobile (jamais toucher au device du widget existant).
2. Provisionner automatiquement un device mobile dédié pour chaque utilisateur au premier login mobile.
3. Gérer les collisions quand widget + mobile sonnent en parallèle : décrochage simultané, CANCEL, reprise d'appel, perte réseau.
4. Partager un `call_id` unique entre mobile et widget pour synchroniser l'état.

## 1. Verrouiller le device mobile (edge fn `ns-resolve-sip-credentials`)

- Pour `client_type: "mobile"` : matcher **uniquement** l'id exact `{ext}_mobile` (ou celui déjà mémorisé dans `planipret_profiles.ns_mobile_device_id`).
- Retirer la « fallback discovery » côté mobile — plus aucune chance d'attraper le device du widget (`_web`, `_app`, etc.).
- Si le device n'existe pas sur NS-API → `POST /devices` avec `device: "{ext}_mobile"`, model `"Mobile Softphone"`, protocole `sip`.
- Le widget n'est jamais touché : aucune requête PUT/POST sur autre chose que `{ext}_mobile`.
- La colonne `ns_mobile_device_id` sert de garde-fou (une fois écrite, elle est immuable côté fonction).

## 2. Provisionnement par utilisateur

- Le resolver déclenche la création du device au premier appel (déjà en place).
- Ajout d'un log `planipret_ns_migration_log` (row `action=create_mobile_device`) pour tracer par broker.
- Idempotent : deux logins parallèles ne créent pas deux devices (guard via `ns_mobile_device_id` + upsert avant POST NS-API).

## 3. Table de sessions d'appel partagée

Nouvelle table `planipret_call_sessions` :

```
id uuid pk
call_id text unique   -- SIP Call-ID (partagé mobile/widget)
broker_id uuid -> planipret_profiles(id)
direction text        -- inbound | outbound
remote_number text
started_at timestamptz
answered_at timestamptz
answered_by text      -- 'mobile' | 'widget' | null
ended_at timestamptz
ended_reason text     -- answered_elsewhere | hangup | cancel | network_lost
state text            -- ringing | active | ended
```

GRANTs + RLS : broker lit/écrit uniquement ses propres sessions ; service_role plein accès.

Realtime activé (`ALTER PUBLICATION supabase_realtime ADD TABLE`).

## 4. Client mobile : capture du Call-ID + sync

Dans `ppSipProvider.ts` : exposer `session.request.call_id` (JsSIP le fournit) via un callback `onCall({ callId, direction, remote })`.

Dans `useMplanipretSoftphone.ts` :
- À la sonnerie (`newRTCSession`) → upsert `planipret_call_sessions` `(call_id, state='ringing')`.
- À l'acceptation locale → update `state='active'`, `answered_by='mobile'` avec `WHERE state='ringing'` (guard atomique).
- Si le UPDATE renvoie 0 rows → un autre appareil a déjà décroché → forcer `session.terminate()` local, afficher toast « Répondu sur un autre appareil ».
- À la fin → update `state='ended'`, `ended_reason`.
- Souscription realtime sur `call_id` → si `answered_by !== 'mobile'` pendant qu'on sonne → dismiss ring UI proprement.

## 5. Gestion collisions & reprise

- **Décrochage simultané** : le UPDATE conditionnel garantit un seul gagnant. Le perdant reçoit un CANCEL SIP (natif NS) + confirmation via realtime.
- **Perte réseau pendant appel actif** : `handoverController` déclenche déjà ICE restart ; on ajoute un timeout de 15s → si pas de reprise, marquer `ended_reason='network_lost'`.
- **Double raccrochage** : idempotent grâce à `state='ended'`.
- **Reprise post-handover** : le Call-ID SIP reste identique → la row n'est pas dupliquée.

## 6. UI mobile

- `ActiveCallOverlay` affiche « Répondu sur le widget web » quand realtime signale un answer distant.
- Aucun changement widget.

## Détails techniques

- Migration SQL : création table + RLS + GRANT + publication realtime.
- Edge fn `ns-resolve-sip-credentials` : retrait fallback discovery pour mobile, log migration, guard idempotent.
- Nouveau helper `src/lib/planipret/calls/callSessionSync.ts` pour la logique upsert/guard/subscription.
- Wiring dans `ppSipProvider` + `useMplanipretSoftphone`.

## Vérifications

- Deux appareils sonnent, un décroche → l'autre s'éteint proprement avec message clair.
- Perte de réseau mid-call → ICE restart, sinon fin propre.
- Chaque nouveau broker obtient automatiquement son `{ext}_mobile` sans intervention manuelle.
- Le device widget n'apparaît jamais dans les requêtes NS-API PUT/POST côté mobile.
