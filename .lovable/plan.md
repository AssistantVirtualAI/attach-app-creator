## Objectif

Passer le portail `/planipret/admin/*` d'un thème glassmorphism sombre à une esthétique **claire, premium, finance/immobilier** — palette Navy Trust sur fond clair, typographie Urbanist + Epilogue, structure sidebar dashboard épurée.

## Direction visuelle verrouillée

**Palette (HSL tokens dans `src/index.css` sous un scope `.planipret-admin-scope`)**
- `--pp-bg`: `#F7F9FC` (fond app)
- `--pp-surface`: `#FFFFFF` (cartes)
- `--pp-surface-alt`: `#E8EDF3` (sidebar, hover)
- `--pp-border`: `#DCE3EC`
- `--pp-text`: `#0F1B3D` (navy foncé)
- `--pp-text-muted`: `#5A6B85`
- `--pp-primary`: `#1E3A5F` (navy)
- `--pp-accent`: `#3B6FA0` (bleu action)
- `--pp-success`: `#0D7A5F`, `--pp-warn`: `#C9A84C`, `--pp-danger`: `#B23A48`
- Ombres douces : `--pp-shadow-sm: 0 1px 2px rgba(15,27,61,.04)`, `--pp-shadow-md: 0 8px 24px -12px rgba(15,27,61,.12)`

**Typographie** — `@fontsource/urbanist` (headings, 600/700) + `@fontsource/epilogue` (body, 400/500). Tracking serré sur les KPI (`-0.02em`), majuscules espacées sur les labels de section.

**Layout** — sidebar dashboard fixe (240px ouverte / 64px collapsed), header sticky 56px, contenu sur grille 12 colonnes avec gouttières 24px.

## Changements par zone

### 1. Shell admin (`PlanipretAdminLayout.tsx`)
- Fond `--pp-bg`, sidebar sur `--pp-surface` avec bordure droite fine.
- Logo Planiprêt en haut + "AVA Statistic" en petit dessous le logo.
- Sections sidebar avec labels capitalisés (`Vue d'ensemble`, `Courtiers`, `Communications`, `Finance`, `Système`).
- Item actif : pastille bleue + fond `--pp-surface-alt`, barre verticale gauche 3px en `--pp-accent`.
- Header : breadcrumb à gauche, recherche centrale, cluster droite (notifs, profil, environnement).
- Profil dropdown : avatar initiales + nom + rôle, séparateur, déconnexion.

### 2. Page Vue d'ensemble (`PAOverview.tsx`)
- Hero KPI : 4 cartes blanches arrondies 16px, ombre douce, icône colorée à gauche, valeur en Urbanist 32px, delta en pilule.
- Section "Profit mensuel" : grand graphique aire avec gradient navy→transparent, légende minimale.
- Grille 2 colonnes : « Adoption services » (heatmap par courtier) | « Top performers ».
- Cartes financières (Mobile/Widget/AI) : ligne dégradée colorée en bordure haute, valeurs grandes, marge en vert.

### 3. Pages secondaires (Users, Reports, Settings, etc.)
- Tables : header sticky `--pp-surface-alt`, lignes alternées subtiles, hover `--pp-accent/5`.
- Boutons primaires : `--pp-primary` plein, hover plus foncé, focus ring 2px `--pp-accent`.
- Inputs : fond blanc, bordure `--pp-border`, focus ring `--pp-accent`.
- Toasts/dialogs : fond blanc, bordures fines, pas de glass blur.

### 4. Composants partagés
- Nouveau `PPStatCard`, `PPSectionHeader`, `PPDataTable` (variantes Tailwind via `cva`) pour cohérence.
- Badges statut (Actif/Inactif/Trial) couleurs sémantiques claires.

## Implémentation technique

```text
src/
├── index.css              + bloc .planipret-admin-scope { --pp-* tokens, font vars }
├── main.tsx               + import "@fontsource/urbanist/600.css" etc.
├── components/planipret/admin/
│   ├── PlanipretAdminLayout.tsx   (refonte shell + sidebar)
│   ├── PPStatCard.tsx             (nouveau)
│   ├── PPSectionHeader.tsx        (nouveau)
│   └── PPProfileMenu.tsx          (refonte light)
└── pages/planipret/admin/
    ├── PAOverview.tsx     (refonte complète sections)
    ├── PAUsers.tsx        (table light + filtres)
    ├── PAReports.tsx      (cartes + charts clairs)
    └── PASettings.tsx     (sections cards)
```

Dépendances : `bun add @fontsource/urbanist @fontsource/epilogue`.

## Hors scope (préservé tel quel)
- Toute logique backend, Edge Functions, requêtes Supabase, pricing.
- L'app mobile `/mplanipret` (déjà refondue séparément).
- Le portail admin Lemtel et le dashboard AVA principal.
- Aucune modification des routes ou des permissions.

## Critère de succès
Le portail respire : fonds clairs, navy comme couleur d'autorité, or/vert pour valeurs financières, typographie premium lisible, hiérarchie immédiate des KPI, zéro bruit visuel glassy résiduel.
