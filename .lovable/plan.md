Je vais corriger exactement ces points sans toucher à la landing page.

## Plan d’implémentation

1. **Appels sortants / web phone mobile**
   - Remettre le démarrage d’appel dans la configuration qui fonctionnait: si le softphone WebRTC est enregistré, lancer réellement l’appel SIP et ne pas afficher seulement “call started”.
   - Corriger le mapping du `wssUrl` venant de `ns-resolve-sip-credentials` (`sip_ws_url` vs `sip_wss_url`) pour éviter une initialisation invalide.
   - Garder l’écran d’appel actif avec les boutons visibles: muet, attente, transfert, clavier, raccrocher.
   - Ajouter un retour d’erreur plus clair si WebRTC échoue avant le fallback PBX.

2. **Carte Identity / extension**
   - Afficher le nom configuré sur l’extension quand l’identité NS est liée, pas seulement Microsoft 365 ou “—”.
   - Priorité d’affichage: nom extension / profil courtier / nom Microsoft / email.
   - Conserver l’extension, domaine et état “Linked”.

3. **Popup “Configurer Microsoft 365” mobile**
   - Transformer la bottom sheet actuelle en modal mobile lisible et scrollable correctement.
   - Corriger les champs coupés: Tenant ID, Client ID, Client Secret.
   - Garder les boutons accessibles en bas avec safe-area, sans débordement.

4. **Recordings mobile alignés avec admin**
   - Utiliser le même flux que `/planipret/admin/recordings`: `ns-get-recording` pour charger l’audio via proxy backend.
   - Permettre de cliquer et écouter même quand l’URL directe manque, en envoyant `call_db_id`, `ns_callid`, `orig/term_callid`, extension.
   - Ne plus masquer des appels qui ont un enregistrement résolvable côté NS même si `recording_url` est vide.

5. **Transcription depuis le phone system, IA seulement pour correction/analyse**
   - Sur mobile, appeler d’abord `ns-get-transcription` comme l’admin.
   - Sauvegarder la transcription NS brute, puis lancer `pp-coach-call` pour corriger la transcription, générer résumé, note/score et coaching.
   - Garder `pp-admin-transcribe` seulement comme fallback si NS ne retourne aucune transcription.

6. **Synchronisation partout admin/mobile**
   - Mettre à jour la carte mobile avec les champs retournés par `pp-coach-call`: transcription corrigée, résumé, coaching, score.
   - Ajouter/aligner l’écoute realtime sur les updates `planipret_phone_calls` pour que les résultats IA faits depuis admin ou mobile apparaissent partout.

7. **Validation**
   - Vérifier le typecheck ciblé.
   - Tester le rendu mobile des écrans concernés avec Playwright: identité, modal Microsoft 365, page recordings.
   - Vérifier les logs/erreurs du chemin d’appel si disponibles.