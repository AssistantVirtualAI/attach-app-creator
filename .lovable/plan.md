# Ajouter MAESTRO_WEBHOOK_SECRET

## État actuel
- Table `planipret_integration_secrets` existe (contrainte `provider IN ('microsoft','maestro')`) mais **0 ligne** — aucun secret Maestro stocké.
- `_shared/maestro.ts` lit dans l'ordre : `config.webhook_secret` (DB) → `Deno.env.get("MAESTRO_WEBHOOK_SECRET")` → `""`.
- Donc deux endroits possibles pour configurer : DB ou variable d'env Edge Function.

## Plan

### 1. Générer + stocker côté Edge (recommandé)
- Appeler `secrets--generate_secret` pour créer `MAESTRO_WEBHOOK_SECRET` (64 chars) si absent — disponible à toutes les fonctions `maestro-*` via `Deno.env`.

### 2. Synchroniser dans `planipret_integration_secrets`
- Insérer la ligne `provider='maestro'` avec `config = { webhook_secret: <même valeur> }` pour qu'elle soit visible/éditable depuis l'admin UI (`PlanipretIntegrations`).
- Migration : seed via fonction `SECURITY DEFINER` qui lit l'env var et fait l'upsert (évite d'exposer la valeur dans le SQL).
  - Alternative simple : laisser vide en DB → le code retombe automatiquement sur l'env var. Pas de migration nécessaire.

### 3. Où le configurer côté Maestro (webhook)
Dans le portail Maestro → **Paramètres → Webhooks** :
- **URL** : `https://gejxisrqtvxavbrfcoxz.supabase.co/functions/v1/maestro-webhook-receiver`
- **Signing secret** : coller la valeur de `MAESTRO_WEBHOOK_SECRET`
- **Events à activer** : `call.received`, `client.created`, `client.updated`, `client.phone_updated`, `task.completed`, `appointment.created`
- Le header attendu par notre handler est `x-maestro-signature` (HMAC-SHA256 du body).

### 4. Vérification
- Lancer `maestro-pipeline-test` → step "webhook signature" doit passer.
- Tab admin **Intégrations → Maestro** doit afficher "Webhook secret : configuré ✅".

## Détails techniques
- Pas de changement de schéma DB.
- Pas de changement de code (les helpers gèrent déjà les deux sources).
- Seule action automatisée : `generate_secret({ name: "MAESTRO_WEBHOOK_SECRET", length: 64 })`.
- Action manuelle utilisateur : coller la valeur dans le portail Maestro (je ne peux pas afficher la valeur générée — récupérable via les logs Edge ou un test endpoint temporaire).
