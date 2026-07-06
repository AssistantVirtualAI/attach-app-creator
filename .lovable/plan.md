Je vais corriger en 4 blocs ciblés.

1. Écran durant un appel
- Faire afficher l’écran plein appel automatiquement sur le webphone/mobile dès `ringing-out`, `ringing-in`, `active` ou `held`.
- S’assurer que toutes les options visibles pendant l’appel sont présentes: muet, attente/reprendre, transfert, clavier DTMF, haut-parleur/diagnostic, raccrocher, répondre/refuser.
- Aligner le visuel sur la capture fournie: fond sombre, avatar central, numéro/nom, durée, boutons d’appel en bas.

2. Enregistrements autoload + écouter directement
- Corriger le player pour utiliser le bon proxy audio `ns-get-recording` avec `call_db_id/ns_callid` au lieu de l’ancien chemin qui reçoit seulement `call_id`.
- Précharger automatiquement les enregistrements quand l’onglet appels/recordings est ouvert, puis rafraîchir après synchro CDR.
- Garder un bouton “Écouter” immédiatement utilisable dès qu’un enregistrement est résolvable.

3. Transcription et analyse IA automatiques
- Remplacer les appels au mauvais endpoint `ns-transcription` par le bon endpoint actuel `ns-get-transcription` / `pp-admin-transcribe`.
- Lancer automatiquement la transcription NetSapiens, puis `pp-coach-call` dès que la transcription existe.
- Appliquer la même logique sur le détail d’appel, la liste des enregistrements, le webphone et l’application mobile.
- Utiliser la configuration IA déjà en place côté admin Planiprêt (`pp-coach-call`, modèle `PP_COACH_MODEL` ou défaut existant).

4. Microsoft 365
- Enregistrer les valeurs Microsoft fournies côté backend dans `planipret_integration_secrets` via la fonction existante, en corrigeant le mapping du formulaire: le champ fourni `CLIENT_SECRET_ID` doit être utilisé comme `client_id` pour l’OAuth.
- Améliorer l’erreur/validation du bouton Enregistrer pour montrer la vraie réponse backend au lieu d’un échec silencieux.
- Ne pas exposer le secret dans le frontend; il restera stocké côté backend.

Détails techniques
- Fichiers probables: `MCalls.tsx`, `MMore.tsx`, `PpActiveCallScreen.tsx`, `CallRecordingPlayer.tsx`, `RecordingsList.tsx`, `nsApi.ts`, fonctions `pp-integration-secrets`, `pp-admin-transcribe`, et éventuellement `pp-ns-recordings`.
- Après approbation, je modifierai uniquement ces zones et validerai avec typecheck ciblé et, si possible, un test fonction backend.