
## Gating (key requirement)

AVA n'est PAS activée pour tous les courtiers. Le flag existant `planipret_profiles.voice_agent_enabled` (déjà géré dans `PAUsers.tsx`) contrôle l'accès.

- **Mobile (`MHome.tsx`)** : avant d'afficher le bouton AVA / `AvaVoiceAgent`, lire `voice_agent_enabled` du profil. Si `false` → bouton masqué.
- **Edge functions** `ava-agent-config` & `ava-tool-executor` : reject 403 si l'utilisateur appelant n'a pas `voice_agent_enabled = true`.
- **Admin `PAUsers.tsx`** : le toggle "Agent IA" existe déjà — aucun changement requis, juste documenter qu'il pilote l'accès.

## SECTION 1 — Edge Function `elevenlabs-manage-agent`

Nouveau fichier `supabase/functions/elevenlabs-manage-agent/index.ts`. Admin only (vérification `user_roles.role = 'admin'`). Actions :
`get_agent`, `create_agent`, `update_agent`, `sync_all_tools` (les 35 tools listés), `update_voice`, `update_system_prompt`, `update_llm`, `get_all_voices`, `test_agent`, `get_agent_stats`, `delete_tool`, `add_single_tool`.

Headers ElevenLabs : `xi-api-key: ELEVENLABS_API_KEY`. URL base `https://api.elevenlabs.io/v1`.

`sync_all_tools` construit le tableau des 35 webhooks pointant vers `${SUPABASE_URL}/functions/v1/ava-tool-executor` avec `Authorization: Bearer ${SUPABASE_ANON_KEY}`, puis PATCH `/convai/agents/{id}`. Broadcast progress sur channel Realtime `elevenlabs-setup:{admin_user_id}` (`tool_added`, `setup_complete`, `setup_error`).

`create_agent` : POST `/convai/agents/create` avec le payload spécifié, sauvegarde `agent_id` dans la table `planipret_elevenlabs_config` (key=`agent_id`) ET met à jour le secret runtime via `set_secret` (`ELEVENLABS_DEFAULT_AGENT_ID`).

## SECTION 2 — Migration DB

```sql
ALTER TABLE planipret_profiles
  ADD COLUMN IF NOT EXISTS elevenlabs_session_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elevenlabs_last_session timestamptz,
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_status text DEFAULT 'not_configured';

CREATE TABLE public.planipret_elevenlabs_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planipret_elevenlabs_config TO authenticated;
GRANT ALL ON public.planipret_elevenlabs_config TO service_role;
ALTER TABLE public.planipret_elevenlabs_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only" ON public.planipret_elevenlabs_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

## SECTION 3 — UI Admin

Nouveau composant `src/components/planipret/admin/integrations/ElevenLabsManagementCard.tsx` qui REMPLACE la carte ElevenLabs actuelle dans `PlanipretIntegrations.tsx` (uniquement quand l'utilisateur est admin de l'org Planiprêt).

Panneaux (collapsibles, glass-morphism cyber, palette existante) :
1. **Connection Status** — clé API, test `/v1/user`.
2. **Agent AVA** — empty state + wizard 1-clic OU info card (avatar, stats via `get_agent_stats`, quick actions).
3. **Outils (35)** — tableau status, bouton sync, URL webhook copiable, ajout manuel.
4. **Voix** — current voice + preview, grille de voix (`get_all_voices`), sliders stability/similarity/style.
5. **LLM** — radio (claude-3-5-sonnet recommandé), temperature, max_tokens.
6. **System Prompt** — textarea + bandeau bleu expliquant que `ava-agent-config` génère le prompt par session.
7. **Test & Validation** — quick test + pipeline 8 étapes.
8. **Agents dédiés par courtier** — table des brokers `voice_agent_enabled=true`, création d'agent dédié → `planipret_profiles.elevenlabs_agent_id`.

**Bannière "Setup 1-clic"** en haut si non configuré, wizard 4 étapes (clé → create_agent → sync_all_tools → résumé), confetti final.

Hook `src/hooks/useElevenLabsSetupProgress.ts` : subscribe channel Realtime pour la progression.

## SECTION 4 — Gating runtime

- `src/pages/planipret/mobile/MHome.tsx` : guard `if (!profile?.voice_agent_enabled) return null` autour du trigger `AvaVoiceAgent`.
- `supabase/functions/ava-agent-config/index.ts` & `ava-tool-executor/index.ts` : ajouter en début la check :
  ```ts
  const { data: p } = await supabase.from("planipret_profiles")
    .select("voice_agent_enabled").eq("user_id", userId).single();
  if (!p?.voice_agent_enabled) return new Response(JSON.stringify({error:"AVA non activée pour cet utilisateur"}), {status:403, headers:corsHeaders});
  ```

## SECTION 5 — Gestion d'erreurs

Mapping 401/403/404/422/429/network avec messages FR et actions de récupération comme spécifié.

## Hors scope (préservé)

Aucune modification de : Lemtel, mobiles non-Planiprêt, autres cartes d'intégration, generate-voicemail-greeting, ava-agent-config (sauf ajout du guard), ava-tool-executor (sauf ajout du guard), pipeline Maestro, dark mode, auth/routing.

## Détails techniques

- `SUPABASE_URL` & `SUPABASE_ANON_KEY` lus via `import.meta.env.VITE_SUPABASE_URL` côté UI et `Deno.env` côté edge function.
- Tous les composants UI utilisent tokens sémantiques `index.css` (pas de couleurs hardcodées).
- Tools array (35) défini dans un module partagé `supabase/functions/_shared/ava-tools.ts` pour pouvoir le réutiliser dans `sync_all_tools` ET la table de status UI (fetch via une nouvelle action `list_expected_tools`).
- L'admin check côté edge function utilise `has_role(auth.uid(), 'admin')`.
