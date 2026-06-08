# Phase 3 — Voicemail + AI Greeting

Objectif : permettre à chaque user de gérer sa boîte vocale (lecture, transcription, résumé IA) et de générer un greeting personnalisé via ElevenLabs TTS.

## Livrables

### 1. Backend (DB + Edge Functions)
- Migration : étendre `pbx_voicemail_settings` (greeting_url, greeting_text, greeting_voice_id, greeting_mode `default|recorded|tts`, transcription_enabled, ai_summary_enabled).
- Edge Function `user-voicemail` :
  - `list` — voicemails de l'utilisateur (via `pbx_voicemails` + jointure softphone)
  - `mark_read` / `delete` (soft delete + audit_logs)
  - `get_audio_url` — signed URL temporaire bucket `voicemail-audio`
  - `transcribe` — ElevenLabs `scribe_v2` (batch), stocke dans `pbx_call_transcripts`
  - `summarize` — Lovable AI Gateway (`google/gemini-3-flash-preview`), stocke résumé + intent
- Edge Function `user-voicemail-greeting` :
  - `get_settings` / `save_settings`
  - `generate_tts` — ElevenLabs TTS (`eleven_multilingual_v2`), upload `voicemail-greetings`, retourne URL
  - `upload_recorded` — accepte blob recorded mic, upload bucket
  - sync FusionPBX via `fusionpbx-proxy` (mailbox greeting)

### 2. Frontend `/my/voicemail` (nouvelle page)
- Liste voicemails : caller, durée, date, badge unread, player audio inline.
- Actions par item : Play, Transcribe, Summarize (IA), Mark read, Delete.
- Panel détail : transcript + résumé IA + tags + notes (réutilise `set_call_notes`).
- Section "Greeting" :
  - 3 modes : Default org / Recorded (MediaRecorder) / AI TTS (textarea + voice picker parmi top voices).
  - Preview audio + Save.
- Skeletons, empty states, FR/EN.

### 3. Hooks & composants
- `useMyVoicemails` (React Query : list/mutations)
- `useMyGreeting`
- `components/voicemail/VoicemailList.tsx`
- `components/voicemail/VoicemailDetail.tsx`
- `components/voicemail/GreetingEditor.tsx` (3 tabs : Default | Record | AI Voice)
- `components/voicemail/VoicePicker.tsx` (top 5 voices ElevenLabs)

### 4. Routing & Sidebar
- Ajouter `/my/voicemail` (lazy) dans `App.tsx`.
- Ajouter item "Voicemail" dans `PortalShells` (user workspace).

### 5. Sécurité
- RLS : user lit/écrit uniquement ses voicemails (via `portal_user_id` du softphone lié).
- Org admin peut voir/réécouter (déjà couvert par policies existantes).
- `ELEVENLABS_API_KEY` déjà présent côté secrets — utilisé uniquement server-side.
- Tous les `transcribe` / `summarize` / `generate_tts` loggés dans `audit_logs`.

## Détails techniques
- TTS modèle par défaut : `eleven_multilingual_v2`, format `mp3_44100_128`.
- STT modèle : `scribe_v2`, langue auto-détectée + override `fr`/`en`.
- Résumé IA prompt : extraction de `caller_intent`, `priority`, `callback_required`, `summary` (≤ 3 phrases), structured output via `Output.object`.
- Bucket `voicemail-greetings` existe déjà (privé) — signed URL 1h pour preview.

## Hors scope (phases suivantes)
- Notifications email/push voicemail → Phase 7 (Reports/Notifications).
- Greeting after-hours distinct du greeting busy → extension possible plus tard.

## Prochaine action
Sur ton OK je passe en build mode et j'enchaîne migration → edge functions → UI.
