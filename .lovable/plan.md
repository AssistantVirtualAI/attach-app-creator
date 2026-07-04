Plan d’implémentation

1. Corriger App Review pour qu’il soit réellement créé dans le système téléphonique
- Modifier `pp-appreview-provision` pour ne plus retourner “prêt” tant que l’utilisateur `1999@planipret.ca` n’est pas confirmé côté système téléphonique.
- Utiliser le format officiel des champs NS-API (`user`, `name-first-name`, `name-last-name`, `email-address`, `user-scope`, etc.).
- Après création, refaire une vérification côté système téléphonique par liste/recherche; si l’utilisateur n’existe toujours pas, afficher une erreur claire au lieu d’un faux succès.
- Créer ensuite les appareils mobile/web seulement après confirmation que l’utilisateur existe.

2. Rendre la page Courtiers bidirectionnelle avec le système téléphonique
- Étendre `ns-sync-user` pour supporter :
  - `sync_from_ns` : téléphone → base locale, avec mise à jour nom/email/extension/statut quand possible.
  - `sync_to_ns` : base locale → téléphone, création/mise à jour des utilisateurs manquants.
  - `sync_one` : synchroniser un courtier précis lors d’un ajout/modification/toggle.
- Brancher `pp-admin-user` sur cette logique pour que :
  - créer un courtier crée aussi l’utilisateur téléphone;
  - modifier nom/email/extension met à jour le téléphone;
  - supprimer un courtier supprime/désactive côté téléphone;
  - les toggles restent cohérents localement et déclenchent la sync nécessaire.
- Ajouter une vraie réponse détaillée au bouton “Sync NS-API” de la page Courtiers.

3. Rendre Devices mobiles bidirectionnel
- Dans `pp-mobile-device-status`, lire l’état réel des appareils côté téléphone et synchroniser la base locale quand un appareil existe déjà côté téléphone mais manque localement.
- Ajouter une action “Synchroniser appareils” sur la page pour faire :
  - téléphone → local : détecter et lier les appareils existants;
  - local → téléphone : provisionner les appareils manquants.
- Corriger `ns-provision-broker-devices` pour chercher le courtier par `id` ou `user_id`, créer l’utilisateur téléphone si absent, puis créer les appareils.

4. Refaire le visuel de Devices mobiles pour matcher les autres pages admin
- Remplacer le style actuel trop shadcn/bold par le style Planiprêt existant : `pp-card`, variables `--pp-*`, header compact comme Courtiers.
- Header plus petit, moins gras, meilleur interlignage et contrastes.
- Statistiques en badges/cartes sobres alignées avec Courtiers.
- Tableau responsive avec colonnes contrôlées, texte qui wrap proprement, actions en menu compact, pagination identique.
- Améliorer le loading avec skeletons cohérents et message clair pendant la synchronisation.

5. Vérification
- Tester le flux App Review : création utilisateur téléphone vérifiée avant succès.
- Tester Courtiers : ajout/modification/sync depuis téléphone.
- Tester Devices mobiles : scan, liaison locale, provisionnement manquant, pagination/lecture responsive.