## 1. Persistance FR/EN via `planipret_profiles.language`

**État actuel** : le hook `useMplanipretLang` lit uniquement `localStorage` (`mplanipret-lang` / `ava-language`). L'écriture DB existe déjà côté `MMore` mais rien n'hydrate la valeur depuis `planipret_profiles` au démarrage.

**Changements** :
- `src/pages/planipret/PlanipretMobile.tsx#loadProfile` : après récupération du `profile`, si `profile.language` est `fr`/`en` et diffère de `lang`, appeler `setLang(profile.language)` (via le hook) → met à jour localStorage + document.lang + tous les listeners.
- `src/hooks/useMplanipretLang.ts` : exposer un `setLangSilent(l)` optionnel (ou réutiliser `setLang`) pour éviter une écriture DB pendant l'hydratation.
- `MMore.tsx` : garder l'écriture DB + `reloadProfile()`, mais s'assurer que le clic met à jour l'état local avant l'attente réseau (déjà le cas).
- Vérification : reload navigateur → `loadProfile` récupère `language` de la DB → override localStorage si différent. Changement de navigateur/device → DB reste la source de vérité.

## 2. PlanipretMobile.tsx — chaînes restantes

Audit ciblé : le fichier utilise déjà `t()` partout sauf **une occurrence** :
- L. 344-347 : `toast("🤖 Analyse IA disponible", { … action: { label: "Voir", … } })` → remplacer par `t("toasts.aiAnalysisReady")` et `t("common.view")`.

Ajouter les clés dans `MP_DICT.fr` et `MP_DICT.en` :
- `toasts.aiAnalysisReady` : « 🤖 Analyse IA disponible » / « 🤖 AI analysis ready »
- `common.view` : « Voir » / « View »

Vérification automatique : ajouter/étendre le test `src/hooks/__tests__` (ou un simple script `bunx tsgo`) qui parcourt toutes les clés utilisées via `t("…")` dans `src/pages/planipret/**` et confirme qu'elles existent dans les deux dictionnaires. Rapport en cas de clé manquante.

## 3. Étendre FR/EN à Overview & Reports

**Approche** : réutiliser exactement le même hook `useMplanipretLang` (source de vérité unique, déjà couplée à `LanguageContext` global). Aucun nouveau système.

**Étapes** :
1. Ajouter deux sous-arbres au dictionnaire `MP_DICT` : `overview.*` et `reports.*` (fr + en) couvrant :
   - Titres/sous-titres de section (KPI, Revenue Breakdown, Top brokers, Recent calls, Lead heat, etc.)
   - Libellés d'axes / légendes Recharts
   - Boutons (Actualiser, Exporter, période 7j/30j/90j)
   - États vides / chargement
2. Câbler `PAOverview.tsx` et `PAReports.tsx` :
   - `const { t, lang } = useMplanipretLang();`
   - Remplacer chaque chaîne FR codée en dur par `t("overview.xxx")` / `t("reports.xxx")`.
   - Utiliser `lang` pour la locale de `toLocaleDateString`, `toLocaleTimeString`, formatteurs de mois, etc. (`lang === "en" ? "en-CA" : "fr-CA"`).
   - Sous-composants locaux (`KpiCard`, section headers) : recevoir le titre déjà traduit.
3. Ajouter un mini switch FR/EN discret dans `PlanipretAdminLayout.tsx` (header admin) reliant `setLang` — cohérent avec celui du mobile.
4. Écrire les valeurs `overview.*` et `reports.*` dans les deux dictionnaires (~60-80 clés estimées).

## Ordre d'implémentation

1. Ajout clés `toasts.aiAnalysisReady` + `common.view` et remplacement dans `PlanipretMobile.tsx`.
2. Hydratation DB → hook dans `loadProfile`.
3. Extension `MP_DICT` avec sous-arbres `overview.*` / `reports.*`.
4. Refactor `PAOverview.tsx` + `PAReports.tsx` sous `useMplanipretLang`.
5. Switch FR/EN dans `PlanipretAdminLayout.tsx`.
6. Vérification finale : `bunx tsgo --noEmit` + parcours d'audit des clés `t("…")`.

## Notes

- Aucune migration DB requise (`planipret_profiles.language` existe déjà).
- Aucun changement de RLS.
- Les libellés Recharts sont dynamiques (labels formatters) → passer `t()` au moment du render.
- Pas de rupture d'API : `useLanguage` global reste synchronisé via le hook mobile existant.