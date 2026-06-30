Je vais corriger la sync Planiprêt pour que les courtiers, appels, messages, enregistrements, vue d’ensemble et rapports utilisent les vraies données NS-API sans timeout.

Plan d’implémentation :

1. Corriger la fonction backend `pp-admin-ns-sync`
   - Remplacer l’appel long synchrone par un démarrage rapide avec traitement en arrière-plan pour éviter les 504/150s.
   - Utiliser la même authentification NS-API fonctionnelle que `pp-ns-users` / `ns-live-test` : `NS_API_KEY` en Bearer.
   - Paginer les utilisateurs NS-API pour récupérer tous les ~355 courtiers, pas seulement une page.
   - Synchroniser les courtiers NS-only vers `planipret_profiles` ou au minimum garder un mapping extension/email fiable pour que les pages ne montrent plus seulement 1 courtier.

2. Remplir les données réciproques
   - Backfill CDRs/appels par lots, avec `upsert` idempotent sur `ns_call_id`.
   - Récupérer les URLs/métadonnées d’enregistrements depuis les champs NS-API disponibles et les stocker dans `planipret_phone_calls.recording_url`.
   - Synchroniser les messages si un endpoint SMS/messages NS est disponible, sinon afficher clairement l’état “endpoint non disponible” plutôt qu’un tableau vide silencieux.

3. Corriger les pages admin
   - `PAUsers` : afficher la totalité des courtiers NS-API avec extension, même sans compte local lié.
   - `PACalls`, `PARecordings`, `PAReports`, `PAOverview` : éviter les joins `!inner` qui masquent les appels sans profil local; afficher le nom/extension depuis les colonnes syncées et les métadonnées.
   - Ajouter un état de sync visible : en cours, terminé, erreurs partielles, nombre d’utilisateurs/appels/enregistrements importés.

4. Corriger les compteurs
   - Vue d’ensemble : compter les courtiers depuis la source synchronisée complète, pas seulement `planipret_profiles` local si la sync NS a plus d’utilisateurs.
   - Rapports : agréger par extension quand `user_id` est absent afin que les appels NS-only apparaissent quand même.

5. Vérification
   - Vérifier en base les volumes après sync : courtiers, appels, messages, enregistrements.
   - Vérifier que les pages ne restent plus vides et que les compteurs correspondent aux données réellement synchronisées.