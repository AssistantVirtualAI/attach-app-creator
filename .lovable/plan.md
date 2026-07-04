## Diagnostic

J'ai vérifié la base — les données existent, ce sont les filtres du dashboard qui sont mauvais :

| KPI | Cause du 0 |
|---|---|
| Appels aujourd'hui | Filtre sur `started_at ≥ minuit` — or les 6 appels d'aujourd'hui ont `started_at = NULL` (seulement `created_at` rempli). |
| SMS aujourd'hui | Même problème : filtre `sent_at`, colonne vide sur les nouveaux messages. |
| Appels manqués | Filtre `direction='missed'` — or `direction` ne contient que `inbound`/`outbound`. Le "missed" est dans la colonne `status`. |
| Courtiers actifs | Lit `brokerStats.app_mobile_active` depuis le hook, mais `load()` capture la valeur au premier rendu (0) et ne se relance pas quand le hook finit de charger. |
| Graphique 7 jours | Même bug `started_at`/`sent_at` que ci-dessus. |

Design, layout, textes, i18n : **rien ne change**. Uniquement les queries.

## Changements (fichier unique : `src/pages/planipret/admin/PAOverview.tsx`)

### 1. Basculer les filtres temporels sur `created_at`
Dans `load()` :
- `getPlanipretCallCount({ from: todayIso })` → nouvelle helper ou query directe utilisant `created_at`.
- Idem pour `callsYest`, `callsPeriodStats`, `topCalls`, `callsByDir`, `callsP`.
- `planipret_phone_messages` : remplacer `.gte("sent_at", …)` par `.gte("created_at", …)`.
- Idem pour la série 7 jours : agrégation basée sur `created_at.slice(0,10)`.

Pour ne pas casser les autres pages qui utilisent `getPlanipretCallCount`, j'ajoute un paramètre `dateField?: "started_at" | "created_at"` (défaut `started_at`) dans `src/lib/planipret/adminCounts.ts`, et je le passe à `"created_at"` depuis Overview.

### 2. Corriger le filtre "appels manqués"
- `getPlanipretCallCount({ direction: "missed", … })` → `{ status: "missed", … }`.
- Distribution "direction" : construire la 3ᵉ tranche (Missed) à partir de `status='missed'` au lieu de `direction='missed'`, en excluant ces rows du décompte inbound/outbound pour éviter le double comptage.

### 3. Faire réagir `load()` à `brokerStats`
Ajouter `brokerStats` dans les dépendances du `useEffect` qui appelle `load`, avec debounce, pour que `stats.brokers` / `stats.brokersTotal` se mettent à jour dès que la vue `planipret_broker_stats` renvoie ses vraies valeurs.

Fallback en attendant : si `brokerStats.app_mobile_active === 0` ET `brokerStats.total_courtiers === 0`, utiliser le count direct `planipret_profiles WHERE mobile_app_enabled = true` (déjà récupéré via `svcProfiles`) comme valeur affichée.

### 4. Rien d'autre
- Aucune modif visuelle, aucun composant renommé/supprimé.
- Pas de changement à `/admin/reports` (PAReports.tsx) — la page overview seule est concernée par les symptômes rapportés.
- Realtime, période 7/30/90, sync NS : intacts.

## Vérification
- Recharger `/admin/overview` : appels aujourd'hui = 6, SMS = 0 (réel), manqués corrects, courtiers actifs = valeur réelle du hook, graphique 7 jours peuplé.
- Console : plus de "chart all zeros" quand il y a des données.
