Plan de correction ciblé

1. Desktop admin Customers
- Corriger les compteurs Extensions / Numbers / Queues pour qu’ils ne restent pas à 0 quand les données existent.
- Compter par `domain_uuid` quand disponible, puis fallback par `organization_id`.
- Afficher clairement `— not linked —` seulement pour le lien customer, pas pour les compteurs PBX réels.
- Remplacer le petit modal “Edit customer” par un vrai panneau d’édition type admin portal avec tous les champs PBX domaine disponibles : domain name, description, enabled, org/customer link, notes/métadonnées utiles, plus actions Sync/Refresh.

2. Sidebar Admin desktop visible sur tous viewports
- Garder une sidebar Admin accessible quel que soit le viewport.
- Sur largeur réduite : afficher une mini-sidebar/collapse rail au lieu de cacher complètement l’admin dans un bottom nav.
- Ajouter overflow/scroll horizontal/vertical propre pour éviter que les items admin soient coupés.
- Ne pas toucher `vite.config.ts`, `electron-builder.yml`, ni `.github/workflows/*`.

3. Mobile `/m` CDR réel et à jour
- Corriger la requête `mobile-calls` pour inclure les CDR récents même si le champ `extension` n’est pas rempli mais que le numéro est dans `source_number`, `destination`, `caller_number`, `destination_number`.
- Lancer un sync CDR manuel depuis le header/pill mobile quand l’utilisateur refresh/retry, puis recharger les calls.
- Afficher date + heure lisibles dans les listes `/m` et les détails, avec “last synced”.
- Réduire les cas où `/m` reste sur cache/polling sans forcer un vrai refresh.

4. Mobile recordings playback
- Corriger `mobile-recordings` pour retourner les bons champs audio (`recording_path`, `recording_name`, `domain_uuid`, `pbx_uuid/xml_cdr_uuid`, `organization_id`) afin que le lecteur mobile demande la bonne signed URL.
- Dans la liste recordings, afficher le statut réel : recording trouvée, fichier PBX manquant, transcript cached, AI cached.
- Dans le détail, améliorer le message d’erreur pour distinguer : CDR présent, signed URL OK/KO, fichier PBX introuvable, audio load/playback failed.

5. Home mobile plus complet + AVA summary
- Enrichir le Home avec stats daily / weekly / monthly et plage custom simple.
- Ajouter un panneau “AVA summary” qui résume les appels de la période : volume, missed calls, answer rate, top extensions, recordings/transcripts/AI notes.
- Éviter toute retranscription : utiliser uniquement CDR + insights/transcripts déjà en cache.

6. Vérification multi-plateforme
- Vérifier les chemins desktop app, `/m` mobile preview, mobile app code partagé, admin portal/user portal data paths concernés.
- Contrôler que les données viennent des mêmes tables backend et que les timestamps/last-sync sont visibles partout.