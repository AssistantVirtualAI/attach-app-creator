Le problème vient très probablement du pipeline natif, pas de la page React : le code de `MobileAuthScreen` est déjà identique à `/mplanipret`, mais l’app native n’a pas de dossier `dist` synchronisé et il existe encore des scripts/configs qui peuvent builder la racine au lieu du mobile.

Plan :

1. Verrouiller l’app native sur le build mobile uniquement
- Corriger `apps/planipret-mobile/scripts/ios-build.sh` pour supprimer le build de la racine du repo.
- Le script fera seulement : `cd apps/planipret-mobile`, `npm install`, `npm run build`, `npx cap sync ios`.

2. Empêcher Xcode/Android d’utiliser une mauvaise configuration
- Vérifier que `apps/planipret-mobile/capacitor.config.ts` reste la seule config utilisée pour cette app.
- Ajouter/ajuster la doc de commandes exactes pour iOS/Android depuis `apps/planipret-mobile`.

3. Ajouter une vérification de parité automatique
- Ajouter un script d’audit qui échoue si `apps/planipret-mobile` importe des fichiers hors de `apps/planipret-mobile/src`.
- Ajouter une vérification que les fichiers mobiles critiques sont identiques à ceux de `/mplanipret` : pages, composants, hooks, libs, locales, CSS/assets.

4. Valider le résultat
- Lancer le build mobile depuis `apps/planipret-mobile`.
- Confirmer que `dist/` existe et que les assets CSS/JS sont générés.

Après ça, la commande correcte sera :

```bash
cd apps/planipret-mobile
npm run build
npx cap sync ios
npx cap open ios
```

Et pour Android :

```bash
cd apps/planipret-mobile
npm run build
npx cap sync android
npx cap open android
```