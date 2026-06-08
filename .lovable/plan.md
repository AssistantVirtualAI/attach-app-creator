# Plan – Refonte visuelle futuriste du portail AVA Statistic

Objectif : moderniser visuellement **tout le portail web** (admin + client) avec une esthétique cyberpunk/glassmorphism élégante, sans toucher à la logique métier ni aux apps desktop/mobile.

## 1. Fondations du design system (`src/index.css` + `tailwind.config.ts`)

- **Palette enrichie** autour du primary actuel `#0023e6` :
  - Ajout de tokens `--surface-glass`, `--surface-glass-strong`, `--border-glass`
  - Couleurs d'accent néon : cyan électrique, violet, magenta (utilisés avec parcimonie)
  - Fond dégradé profond (deep navy → near black) avec halos radiaux
- **Nouveaux tokens** :
  - `--gradient-aurora`, `--gradient-mesh`, `--gradient-primary-glow`
  - `--shadow-glass`, `--shadow-glow-primary`, `--shadow-elevated`
  - `--blur-glass: 20px`, `--blur-glass-strong: 40px`
- **Typographie** : conserver Inter, ajouter un display font pour les titres (ex. Space Grotesk ou Sora) pour le côté futuriste.
- **Rayons** : passer à un système plus généreux (`--radius: 1rem`) pour les cartes principales.

## 2. Primitives réutilisables

Créer dans `src/components/ui/` :
- `glass-card.tsx` — wrapper carte avec `backdrop-blur`, bordure dégradée, hover glow
- `glow-button.tsx` — variante bouton avec halo lumineux animé
- `aurora-background.tsx` — fond animé subtil (mesh gradient) pour pages clés
- `noise-overlay.tsx` — texture grain légère pour casser l'aspect plastique

## 3. Layout global (`src/components/layout/`)

- **AppLayout** : fond global avec aurora + grille subtile (style MagicUI `AnimatedGridPattern`)
- **Sidebar** : 
  - Verre teinté semi-transparent, bordure droite lumineuse
  - Item actif avec barre néon verticale + glow
  - Icônes avec micro-animation au hover
- **Header/Topbar** : barre flottante en glass, sticky, avec recherche redesignée

## 4. Pages prioritaires à retravailler

Ordre d'impact visuel :
1. **Dashboard** (`src/pages/Dashboard.tsx`) — KPI cards en glass + sparklines glow, graphiques avec gradients
2. **Agents / Clients / Conversations** — listes en glass cards, états hover avec border-beam
3. **Analytics** — recharts re-stylés (gradients, glow lines, tooltip glass)
4. **Settings / Billing** — formulaires en glass panels
5. **Landing publique** — hero avec Meteors/Particles, sections en bento grid
6. **Client portal** — même langage visuel, palette légèrement adoucie

## 5. Micro-interactions & motion

- Framer Motion : fade+slide à l'entrée de page, stagger sur les listes
- Hover : scale subtil (1.02) + glow renforcé sur cards
- Border-beam (MagicUI) sur cartes premium / CTA
- Shimmer sur les états loading (remplace skeletons gris plats)

## 6. Composants MagicUI à intégrer

- `AnimatedGridPattern` — fond layout
- `BorderBeam` — cards highlight (plan actif, agent featured)
- `Meteors` / `Particles` — hero landing
- `NumberTicker` — KPI dashboard
- `Shimmer` — loading states

## 7. QA visuelle

- Vérifier contraste WCAG AA sur tous les tokens
- Tester light/dark (le portail est dark-first ; s'assurer que le light reste cohérent ou le retirer si non utilisé)
- Vérifier sur mobile (sidebar collapse, cards stack)
- Pas de régression sur les pages non-touchées (tokens sémantiques préservés)

## Hors scope

- Aucune modification fonctionnelle (API, queries, RLS, edge functions)
- Aucun changement dans `apps/ava-softphone-desktop/` ni `apps/ava-softphone-mobile/`
- Aucun changement aux fichiers CI/CD protégés

---

## Question avant de coder

Avant d'implémenter, je te propose de **choisir la direction visuelle** via 3 questions rapides (palette, typographie, ambiance) — comme ça la refonte reflète exactement ton goût plutôt que mes suppositions. Veux-tu qu'on passe par cette étape, ou je fonce direct avec la direction "cyberpunk glass bleu électrique" décrite ci-dessus ?
