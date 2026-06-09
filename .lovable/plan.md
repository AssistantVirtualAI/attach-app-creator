
# Plan: Réappliquer les améliorations portail org

**Règle absolue:** ne pas modifier `src/pages/Landing.tsx` ni les composants `src/components/landing/**`. Tout le travail reste dans les portails (`/org/*`, `/my/*`, `/platform/*`) et leurs primitives partagées.

## 1. Verrouiller la landing page

- Ajouter une note dans `mem://index.md` Core: « Ne jamais modifier `src/pages/Landing.tsx` ni `src/components/landing/**` sans demande explicite de l'utilisateur ».
- Aucune édition de fichiers landing dans ce plan.

## 2. Restaurer le système visuel "glass / aurora" pour les portails uniquement

Cible: `src/index.css` (déjà chargé), nouvelles classes scopées aux layouts portails (pas de styles globaux qui pourraient impacter la landing).

- Ajouter tokens dark mode "aurora": `--glass-bg`, `--glass-border`, `--glass-blur`, `--neon-edge`, `--shadow-glass`, `--shadow-glow-primary`.
- Ajouter utilitaires CSS scopés sous `.portal-shell` :
  - `.portal-shell .glass-card`, `.glass-panel`, `.glow-hover`, `.aurora-bg`
- Wrapper portail: ajouter la classe `portal-shell` dans:
  - `AdminPortalLayout` (org)
  - `MyPortalLayout` (my)
  - `PlatformPortalLayout` (platform)
- Background aurore (fixed, `prefers-reduced-motion` respecté) injecté uniquement dans ces layouts.

## 3. Modernisation Sidebar + Header portails

- Sidebar (org/my/platform): fond verre flou, border néon, item actif avec halo, séparateurs subtils.
- Header: barre verre, blur, ombre douce, breadcrumbs cohérents.
- Aucune modification des sidebars/headers de la landing.

## 4. Tables, listes, cards (portails)

- Tables admin (Devices, Queues, Customers, Extensions, IVR, SMS, Voicemail, etc.): rangées glass, hover halo, alignements et espacement uniformes.
- Cards stats: bordure dégradée subtile + shadow-glow au hover.

## 5. Boutons, inputs, focus (a11y)

- Surcharger les variants shadcn (`button`, `input`, `textarea`, `select`, `badge`, `dropdown`) avec:
  - Variante `neon` pour CTA principaux portail.
  - Focus ring double (primary 80% + offset) pour navigation clavier.
  - Contrastes WCAG AA validés en dark mode.

## 6. Spec design portail

- Créer/mettre à jour `docs/portal-design-spec.md` (tokens, scale typographique, spacing 4px, motifs de composants). Sert de référence aux pages futures.

## 7. Pages portail à finaliser (uniformiser au nouveau spec)

- `/org/lemtel/admin/customers` (vérifier bouton "Create Organization" + impersonation).
- `/org/lemtel/admin/devices` (catalogue vendor/model, CSV import, statut provisioning).
- `/org/lemtel/admin/queues` (boutons New/Edit/Delete déjà visibles pour super_admin).
- Voicemail, SMS, IVR, Extensions, Downloads, Recordings: appliquer glass + empty states + skeletons.

## 8. Sweep FR/EN final

- Passer en revue les modules télécom restants pour clés i18n manquantes (`useTranslation`).

## 9. QA visuelle

- Vérifier `/org/{slug}/admin`, `/my/dashboard`, `/platform` en clair + sombre.
- Confirmer que `/` (landing) est strictement inchangée (diff = 0 sur landing files).

## Détails techniques

- Fichiers touchés (prévisionnel):
  - `src/index.css` (tokens + utilitaires sous `.portal-shell`)
  - `src/components/portals/AdminPortalLayout.tsx`, `MyPortalLayout.tsx`, `PlatformPortalLayout.tsx`
  - `src/components/ui/{button,input,textarea,select,badge,dropdown-menu,table,card}.tsx` (variants additionnels, pas de breaking changes)
  - Pages portail listées au §7
  - `docs/portal-design-spec.md` (nouveau)
  - `mem://index.md` (règle landing)
- Fichiers **interdits** ce tour: `src/pages/Landing.tsx`, `src/components/landing/**`, `src/App.css` (déjà neutre, on n'y retouche pas).

## Critères d'acceptation

- Landing `/` pixel-identique avant/après.
- Portails arborent un look glass/aurora cohérent, accessible clavier, contrastes AA.
- Boutons CRUD visibles pour super_admin sur Queues/Devices/Customers.
- Spec documentée; nouveaux écrans héritent automatiquement.
