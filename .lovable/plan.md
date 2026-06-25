# Voicemail Greeting Generator + AVA Voice Agent (mobile)

## Audit de l'existant (à RÉUTILISER, pas dupliquer)

| Spec demandée | Existe déjà | Action |
|---|---|---|
| `generate-voicemail-greeting` edge fn | ✅ (110 lignes) | Auditer + compléter (push NS-API, signed URL, profile update) |
| `voicemail-greeting-tts`, `elevenlabs-generate-greeting`, `user-voicemail-greeting` | ✅ | Consolider/garder un seul chemin canonique |
| Storage bucket | ✅ `voicemail-greetings` (privé) | Réutiliser (pas créer `planipret-voicemail-greetings`) |
| `GreetingEditor.tsx` | ✅ (196 lignes) | Refondre selon spec (voix, templates, IA, sliders) |
| `MVoicemail.tsx` tabs | ✅ inbox/saved | Ajouter onglet `🎙️ Ma boîte vocale` en 1er |
| `ava-assistant` edge fn (Claude text) | ✅ (572 lignes) | Garder pour fallback texte |
| `elevenlabs-tool-handler` | ✅ (114 lignes, minimal) | **Réécrire** comme `ava-tool-executor` complet |
| `elevenlabs-convai-agent-config` | ✅ (1308 lignes) | **Garder** — déjà très complet; on ajoute un wrapper `ava-agent-config` qui le délègue avec contexte broker |
| `VoiceAgent.tsx` | ✅ (225 lignes) | **Refondre** comme `AvaVoiceAgent.tsx` (UI overlay, états, transcript live) |
| Table `planipret_ava_conversations` | ✅ (basique) | Étendre : `session_id`, `tool_name`, `tool_params`, `tool_result`, `audio_url`, `duration_ms` + relax CHECK (ajouter `'tool'`) |
| Colonnes profile (voicemail + ava_*) | ❌ | Ajouter |

## Plan d'exécution

### Phase 1 — DB migration (1 migration)
- `planipret_profiles` : `voicemail_greeting_text/voice_id/audio_url/updated_at/active`, `ava_sessions_count`, `ava_last_session_at`, `ava_preferred_lang`, `ava_autonomy_mode`
- `planipret_ava_conversations` : add `session_id`, `tool_name`, `tool_params jsonb`, `tool_result jsonb`, `audio_url`, `duration_ms` ; étendre CHECK role pour inclure `'tool'`

### Phase 2 — Voicemail Greeting Generator
- `supabase/functions/get-elevenlabs-voices/index.ts` (nouveau) : liste curée + cache 1h en mémoire/DB
- `supabase/functions/generate-voicemail-greeting/index.ts` (refonte) : ElevenLabs TTS → upload bucket `voicemail-greetings` → signed URL 24h → update profile → push NS-API (tente upload binaire puis URL, log méthode qui marche)
- `src/components/voicemail/GreetingEditor.tsx` (refonte complète) : Card état actuel, sélecteur voix (grid 2 col + preview), templates (Pro/Absent/Soir/EN auto-rempli avec `full_name`), textarea 500 char + compteur, bouton "✨ Améliorer avec IA" (Claude via `ava-assistant`), bouton "Générer l'audio" multi-étapes, preview player + Régénérer/Activer, sliders avancés repliables, historique
- `src/pages/planipret/mobile/MVoicemail.tsx` : ajout onglet `🎙️ Ma boîte vocale` en première position → monte `GreetingEditor`

### Phase 3 — AVA Voice Agent
- `supabase/functions/ava-agent-config/index.ts` (nouveau, mince) : récupère profile, génère system prompt dynamique selon spec (autonomie, intégrations, capacités), retourne `{agent_id, system_prompt, first_message, voice_id, tools[]}`. Délègue la config détaillée à `elevenlabs-convai-agent-config` existant.
- `supabase/functions/ava-tool-executor/index.ts` (nouveau, gros) : routeur sécurisé pour tous les tools listés. Catégories :
  - Téléphonie : `make_call`, `get_active_calls`, `hangup_call`, `get_call_history`, `get_recording`, `get_transcript`, `send_sms`, `get_sms_conversations`, `get_voicemails`, `generate_voicemail_greeting`
  - IA : `analyze_call`, `get_hot_leads`, `get_coaching_summary`
  - Maestro : `search_client`, `get_client_profile`, `get_client_history`, `create_task`, `create_appointment`, `get_pending_tasks`, `get_upcoming_appointments`, `update_client`, `create_client`
  - M365 : `read_emails`, `send_email`, `get_calendar_today`, `get_calendar_week`
  - Navigation : `navigate_to`, `show_client_in_app`, `open_call_detail` (via Supabase Realtime broadcast channel `ava-nav:{user_id}`)
  - Stats : `get_daily_briefing`, `get_my_stats`
  - Aide : `explain_feature`, `get_integration_status`
  - Chaque appel : log dans `planipret_ava_conversations` (role=`tool`)
- `src/components/AvaVoiceAgent.tsx` (refonte de `VoiceAgent.tsx`) : overlay plein écran, états (idle/connecting/listening/speaking/processing/tool_running/error), visualisations (pulse ring / waveform / arc rotatif / icône tool), transcript live, notification de tool, modale de confirmation (selon `ava_autonomy_mode`), chips actions rapides, barre bottom (input texte + bouton voix), bottom sheet réglages
- Intégration : bouton 🤖 sur `MHome.tsx`, onglet AVA dans `MMessages.tsx`, hook global `useAvaNavigation` qui écoute le channel Realtime et déclenche `navigate()`
- Permission micro + fallback texte (utilise `ava-assistant` Claude existant)
- SDK : `@elevenlabs/react` (`useConversation`) — bun add si absent

### Phase 4 — Vérifications
- Lint + build
- Test manuel : génération greeting + activation, AVA tap → écoute → tool call → navigation

## Détails techniques

**Sécurité** : tous les tools passent par `ava-tool-executor` (jamais d'appel direct provider depuis le client). JWT du broker vérifié à chaque tool call. Logs anti-abus dans `planipret_ava_conversations`.

**Realtime navigation** : `ava-tool-executor.navigate_to` → `supabase.channel('ava-nav:' + user_id).send({type:'broadcast', event:'navigate', payload:{route}})`. Hook côté client dans `PlanipretMobile.tsx` écoute et appelle `useNavigate()`.

**Push NS-API greeting** : essaie 1) `PUT users/{ext}/voicemails/greeting` multipart audio, 2) si 4xx, retry avec `{greeting_url}` JSON. Log la méthode qui passe dans `planipret_audit_log`.

**Pas touché** : Lemtel, fonctions edge non listées, schéma auth/storage.

## Hors-scope (à confirmer si nécessaire)
- `voice_agent_enabled` gating dans dashboard admin (mention spec mais déjà géré ailleurs probablement)
- Réécriture des autres fonctions `voicemail-greeting-*`/`elevenlabs-generate-greeting` (laissées en place, marquées dépréciées via commentaire)

## Questions

1. **`ava-tool-executor` énorme (~30 tools)** — OK de tout livrer dans un seul gros commit, ou tu préfères phaser (Phase 2 voicemail seul → review → Phase 3 AVA) ?
2. Le bucket `voicemail-greetings` existe déjà — je le réutilise plutôt que créer `planipret-voicemail-greetings`, OK ?
