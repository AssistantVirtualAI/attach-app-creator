## Plan: 4 chantiers en parallèle

### 1. Domaines visibles sur Desktop
- Fix sélecteur de domaine dans `ConsoleLayout` / contexte org desktop
- Charger via `get_org_by_fusionpbx_domain` + `current_user_org_ids`
- Afficher badge domain actif dans header

### 2. Recordings + Transcription + AI Coaching complet
- **DB**: étendre `pbx_call_recordings` (transcription_text, sentiment, quality_score, coaching_notes, ai_status)
- **Edge function `transcribe-recording`**: download MP3 → Lovable AI STT (`openai/gpt-4o-mini-transcribe`) → save transcript
- **Edge function `analyze-call`**: Gemini 2.5 Flash → sentiment + score 0-100 + 3-5 points coaching + notes auto + résumé
- **UI Desktop**: panneau "Call Intelligence" sur détail appel (player + transcript + coaching tabs)
- **UI Mobile**: bottom-sheet avec transcript + résumé + score
- **Trigger**: bouton "Analyser" manuel + auto sur nouveaux recordings via cron

### 3. Chat équipe cross-platform (Desktop + Mobile + Web)
- **Scope**: même `fusionpbx_domain_uuid` (filter via `pbx_softphone_users.organization_id` matching domain)
- **DM 1-1**: nouvelle fonction RPC `get_or_create_dm_channel(_other_user_id)`
- **Group chat**: déjà existant `create_group_chat` — exposer UI
- **Liste team**: vue `team_members_by_domain` listant tous softphone users du même domain avec `user_presence`
- **Présence live**: Realtime sur `user_presence` + heartbeat 30s via `upsert_user_presence`
- **Mobile**: ajouter écran Chat (manquant) avec liste channels + DMs + présence
- **Desktop**: fix erreur "org/domain" lors création channel
- **Realtime**: vérifier `org_chat_messages` + `user_presence` dans publication

### 4. Sync + Dispatch
- Realtime sur toutes les tables critiques (déjà fait pour cdrs)
- Deploy toutes les edge functions
- Test cross-platform

### Détails techniques
- Modèles AI: `openai/gpt-4o-mini-transcribe` (STT), `google/gemini-2.5-flash` (analyse)
- Storage: recordings dans bucket existant
- RLS: nouveaux helpers `is_same_domain_as(_user)` pour chat team
- Mobile chat: nouveau `ChatScreen.tsx` + `useTeamPresence` hook

Confirmez et je lance les 4 chantiers en parallèle.
