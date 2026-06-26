## Objectif
Empêcher tout utilisateur avec un email `@lemtel.com` d'être membre de l'organisation Planiprêt, et nettoyer les cas existants (Juliano Lemme).

## Étapes

### 1. Nettoyage des données existantes
- Supprimer de `planipret_profiles` toutes les lignes où `lower(email) LIKE '%@lemtel.com'` (Juliano Lemme aujourd'hui).
- Supprimer les `user_roles` correspondants (`planipret_admin`, `planipret_broker`) pour ces user_ids dans l'org Planiprêt.
- Logger l'opération dans `planipret_audit_log` (action = `purge_lemtel_domain`).

### 2. Garde-fou côté base de données (trigger)
Créer un trigger `BEFORE INSERT OR UPDATE` sur `planipret_profiles` :
- Si `lower(email)` se termine par `@lemtel.com` → `RAISE EXCEPTION 'Les emails @lemtel.com ne peuvent pas être membres de Planiprêt'`.
- Trigger en `SECURITY DEFINER`, `search_path = public`.

Créer un trigger équivalent sur `user_roles` pour les rôles `planipret_admin` / `planipret_broker` : vérifie l'email de `auth.users` du `user_id` et bloque si `@lemtel.com`.

### 3. Garde-fou côté Edge Functions
- `pp-admin-user/index.ts` : avant `upsert` dans `planipret_profiles`, rejeter avec 422 si `email` finit par `@lemtel.com` (message clair).
- `pp-ns-users/index.ts` : dans la fusion NS↔local, **filtrer** les subscribers dont l'email finit par `@lemtel.com` pour qu'ils n'apparaissent pas dans la liste admin.

### 4. UI
- `PAUsers.tsx` : afficher un badge/info "Les comptes @lemtel.com sont exclus de Planiprêt" en haut de la page, et catcher l'erreur du trigger avec un toast lisible si un admin tente de créer un tel compte.

## Détails techniques

```text
INSERT/UPDATE planipret_profiles
        │
        ▼
 trigger guard_no_lemtel_in_planipret  ──► RAISE si @lemtel.com
        │
        ▼
   ligne acceptée
```

- Filtre email : `lower(NEW.email) ~ '@lemtel\.com$'`
- Le trigger sur `user_roles` joint `auth.users` (SECURITY DEFINER requis car `auth` n'est pas accessible côté `authenticated`).
- L'edge `pp-ns-users` continue de lister les subscribers NetSapiens mais filtre côté merge — la liste NS reste intacte, seule la vue Planiprêt est nettoyée.

## Hors scope
- Pas de changement dans Lemtel (ses tables `lemtel_*` et `pbx_*` restent intactes).
- Pas de modification du flux d'authentification Supabase.
