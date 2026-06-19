Je vais corriger uniquement l’app mobile, sans toucher à `vite.config.ts`, `electron-builder.yml` ni `.github/workflows/`.

Plan:
1. Light theme
   - Ajouter des hooks CSS génériques (`data-search-bar`, `data-pill`, `data-bubble`, classes de surfaces) aux écrans ciblés.
   - Renforcer les overrides light pour boutons, icônes, headers, bottom/input bars, modals, listes, badges et bulles.
   - Passer les composants communs (`Card`, `Chip`, `SectionTitle`, `EmptyState`, rows) sur des classes/data-hooks testables.

2. Recordings
   - Garder le scope strict: admin/super_admin = tout le domaine; non-admin = seulement sa propre extension.
   - Charger les extensions du domaine séparément pour que le filtre extension montre toutes les extensions, pas seulement celles déjà présentes dans les 100 derniers enregistrements.
   - Corriger les champs requis par le player audio (`xml_cdr_uuid`/metadata) et rendre le filtre visible/lisible en light mode.

3. Contacts
   - Remplacer le chargement fragile côté REST direct par un fallback Edge Function `org-chat/list_directory` qui retourne aussi les extensions non liées à l’app.
   - Fusionner `pbx_extensions_directory` + softphone users + directory backend pour afficher toutes les extensions du domaine.
   - Empêcher les erreurs de présence de casser la liste.

4. Team Chat / General
   - S’assurer que le canal `general` est sélectionnable et que `list_messages` recharge les anciens messages.
   - Augmenter la limite initiale raisonnablement et afficher les messages existants (Kenny/Juliano) si le backend les retourne.
   - Ajouter les hooks light-mode aux bulles et inputs.

5. Validation
   - Vérifier par requêtes backend les données attendues: enregistrements domaine, 18 extensions, messages general existants.
   - Mettre à jour/ajouter les tests de non-régression light mode pour couvrir les hooks ajoutés et éviter le retour de texte illisible.