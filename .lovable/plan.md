## Goal
Ajouter deux nouveaux thèmes à l'app desktop AVA Softphone, en plus des thèmes `light` et `dark` actuels :
- **Daylight** — version plus claire, blanc lumineux, contrastes doux mais lisibles
- **Midnight** — version plus sombre, presque noir, accents brand renforcés

Les deux palettes seront calibrées pour un contraste texte/fond ≥ WCAG AA sur tous les composants existants (cards glass, nav, boutons, headers).

## Scope (UI uniquement)
Fichiers concernés (lecture seule jusqu'à approbation) :
- `apps/ava-softphone-desktop/src/lib/theme.tsx` — étendre `ThemeMode` et ajouter 2 jeux de tokens
- `apps/ava-softphone-desktop/src/styles/futuristic.css` — variantes CSS vars `[data-ava-theme="midnight|daylight"]` pour `.ava-glass`, scrollbars, mesh background
- `apps/ava-softphone-desktop/src/components/console/ConsoleLayout.tsx` — appliquer `data-ava-theme` sur `<html>`
- Sélecteur de thème : étendre le toggle existant (actuellement light/dark) en un menu 4 options dans le header glass

Hors scope : app mobile, portail web, landing.

## Design tokens

**Daylight** (plus clair que `light`)
- bg : `#f6f9ff` avec mesh aurora très diffus (opacity 0.06)
- surface glass : `rgba(255,255,255,0.92)`
- text : `#0a1226` / muted `#475569`
- accent : brand `#0023e6` inchangé, glow réduit pour ne pas écraser
- borders : `rgba(180,196,224,0.45)`

**Midnight** (plus sombre que `dark`)
- bg : `#05081a` avec mesh aurora saturé (opacity 0.28)
- surface glass : `rgba(12,18,40,0.62)` + blur 18px
- text : `#f1f5ff` / muted `rgba(241,245,255,0.62)`
- accent : `#8aa0ff` (lifté pour contraste sur noir)
- borders : `rgba(150,180,255,0.18)` + aurora hairline plus visible

## Sélecteur
Remplacer le bouton toggle binaire par un petit `ThemeSwitcher` segmenté (4 pastilles : Daylight · Light · Dark · Midnight) dans le header. Stockage `localStorage('ava-softphone-theme')` (clé existante, valeurs étendues).

## Vérification
1. Lancer l'overlay d'audit responsive (Ctrl/Cmd+Shift+R) sur Home + 1 page interne, dans chacun des 4 thèmes
2. Vérifier contraste texte/glass via inspection visuelle aux 4 widths (390 / 820 / 1280 / 1536)
3. S'assurer qu'aucun composant n'utilise de couleur hardcodée incompatible (rg sur `#fff`, `#000` dans `apps/ava-softphone-desktop/src/components`)

Aucun changement de logique métier, pas de migration, pas de backend.