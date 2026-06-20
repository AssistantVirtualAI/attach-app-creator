## Objectif
1. Finaliser la traduction française des écrans secondaires restants.
2. Accélérer significativement le chargement des données sur toutes les pages.

## Partie 1 — Traduction française

Écrans encore à traduire / vérifier :
- `CallDetailScreen.tsx`
- `CallsScreen.tsx`
- `DashboardScreen.tsx`
- `DataSafetyScreen.tsx`
- `FeaturesScreen.tsx`
- `MessagesHubScreen.tsx`
- `MoreScreen.tsx`
- `PrivacyScreen.tsx`
- `QueuesScreen.tsx`
- `RecordingsScreen.tsx`
- `TeamChatScreen.tsx`
- `VoicemailScreen.tsx`

Approche : remplacer les libellés codés en dur, placeholders, aria-labels, états vides et messages d'erreur par `t(...)` ou des branches `lang === 'fr' ? ... : ...` cohérentes avec l'existant. Ajouter les clés manquantes dans `src/lib/i18n.tsx`.

## Partie 2 — Performance du chargement des données

Problèmes identifiés :
- `useAutoSync` exécute un `refresh()` immédiat à chaque montage, même quand le cache est frais → re-fetch à chaque navigation.
- `intervalMs = 60s` redéclenche un fetch même hors focus utilisateur.
- Pas de déduplication entre composants utilisant le même `cacheKey`.
- `visibilitychange` re-fetch à chaque retour d'onglet sans seuil de fraîcheur.
- Skeletons non systématiques pendant la première charge depuis le cache.

Changements :

1. **`useAutoSync.ts`**
   - Ajouter `staleTimeMs` (par défaut 30 s). Si cache présent et `Date.now() - cachedAt < staleTimeMs`, ne pas refetch au mount — afficher direct le cache.
   - Stocker `{value, at}` dans le cache au lieu de la valeur brute, exposer `lastSyncedAt` depuis le cache.
   - **Déduplication globale** : map module-level `inflight: Map<cacheKey, Promise>` ; tous les hooks partageant la même clé attendent la même promesse.
   - **Cache partagé en mémoire** : `Map<cacheKey, {value, at}>` consultée avant `localStorage` (évite JSON.parse répétés).
   - **Broadcast** : quand un fetch réussit pour une clé, notifier tous les abonnés de cette clé via un EventTarget pour qu'ils mettent à jour leur state sans refetch.
   - `visibilitychange` / `focus` → ne refresh que si `Date.now() - lastSyncedAt > staleTimeMs`.
   - Réduire `timeoutMs` à 10 s, `retries` à 1 sur les pages secondaires, augmenter le backoff seulement sur erreurs réseau réelles.

2. **`mobileApi.ts` / `mobileSupabase.ts`**
   - Ajouter un cache mémoire court (5–10 s) sur les requêtes GET identiques pour absorber les doubles montages React 18 StrictMode.
   - Limiter les colonnes sélectionnées (`select=...`) là où c'est encore `*`.

3. **Écrans lourds** (`DashboardScreen`, `CallsScreen`, `VoicemailScreen`, `RecordingsScreen`, `QueuesScreen`, `CallDetailScreen`)
   - Afficher immédiatement le cache si disponible (pas de spinner plein écran).
   - Ajouter/uniformiser des skeletons légers pendant le premier fetch.
   - Pagination/limit côté requête (ex: `limit(50)` au lieu de tout charger).

4. **`MobileApp.tsx`**
   - Précharger en parallèle au boot les caches des 3 écrans principaux (Home, Calls, Voicemail) via un seul `Promise.all`, pour que la navigation soit instantanée.

## Détails techniques

- Format cache : `{ v: T, at: number }` ; migration douce (si ancien format → ignorer et refetch).
- Signature : `useAutoSync(loader, { cacheKey, staleTimeMs?, intervalMs?, timeoutMs?, retries?, deps? })`.
- Aucun changement d'API publique pour les composants existants.
- Pas de modification de la logique métier ni des Edge Functions.

## Hors scope
- Refactor des écrans qui n'utilisent pas `useAutoSync`.
- Changements visuels au-delà des skeletons.
- Logique d'authentification ou backend.
