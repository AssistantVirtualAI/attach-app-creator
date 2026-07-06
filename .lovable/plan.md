## Objectif

Dans `/mplanipret` → Messagerie vocale, permettre au courtier de taper un texte, choisir une voix ElevenLabs, prévisualiser l'audio généré, puis le pousser comme greeting sur son extension via NS-API v2.

## Backend

Nouvelle Edge Function `pp-voicemail-tts` (`supabase/functions/pp-voicemail-tts/index.ts`) :

1. `requirePlanipretBroker(req)` → ctx { extension, nsDomain }.
2. Actions:
   - `GET ?action=voices` → proxy `GET https://api.elevenlabs.io/v1/voices` (retourne liste id/name/preview_url). Cache en mémoire 5 min.
   - `POST action=preview` body `{ text, voiceId, modelId? }` → appel ElevenLabs `/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128` (model `eleven_multilingual_v2`) → renvoie `{ audio_base64, mime: "audio/mpeg" }`.
   - `POST action=upload` body `{ text, voiceId, index=1, script?, modelId? }` → génère l'audio (comme preview) puis POST multipart vers `https://{ns}/ns-api/v2/domains/{nsDomain}/users/{extension}/greetings` avec champs `script`, `index`, `convert=yes`, `synchronous=yes`, `File=<mp3 blob>`. Utilise le helper `nsFetch` existant (à étendre pour supporter `FormData`, sinon fetch direct avec le token NS résolu comme dans `nsFetch`).
3. CORS + logs dans `planipret_edge_function_runs`.

Le secret `ELEVENLABS_API_KEY` est déjà présent (déjà utilisé par `elevenlabs-sync`, `ava-tool-executor`).

## Frontend mobile

Dans `src/pages/planipret/mobile/MVoicemail.tsx` (ou nouveau composant `VoicemailGreetingDialog.tsx`) :

- Bouton "Greeting IA" ouvrant un `Dialog` mobile-friendly (plein écran, scroll).
- Champs :
  - `Textarea` texte du message (max 500 car.)
  - `Select` voix — chargé via `functions.invoke('pp-voicemail-tts', { body: { action:'voices' } })`, affiche nom + bouton play du preview_url.
  - `Select` index greeting (1–9, défaut 1).
- Boutons :
  - "Prévisualiser" → action=preview → `<audio>` src = data URI.
  - "Enregistrer sur ma messagerie" → action=upload → toast succès/erreur.

Aucun changement admin: la fonction est réutilisable depuis l'admin plus tard.

## Détails techniques

- Multipart NS: construire `FormData` côté Deno; NS-API attend `File` (majuscule) + `script`, `index`, `convert`, `synchronous`.
- Format audio: `mp3_44100_128` accepté par NS avec `convert=yes` (NS convertira en WAV interne).
- Voix par défaut : `EXAVITQu4vr4xnSDxMaL` (Sarah).
- Modèle par défaut : `eleven_multilingual_v2`.
- Limite input 4000 car côté UI, validation Zod côté fonction.
- Erreurs ElevenLabs / NS relayées telles quelles (status + body).

## Fichiers touchés

- `supabase/functions/pp-voicemail-tts/index.ts` (nouveau)
- `src/pages/planipret/mobile/MVoicemail.tsx` (ajout dialog)
- éventuellement `src/components/planipret/mobile/VoicemailGreetingDialog.tsx` (nouveau composant)

## Validation

- Deploy `pp-voicemail-tts`, test `action=voices` → 200, `action=preview` → audio jouable, `action=upload` → NS 200/202 et greeting visible dans le portail admin.
