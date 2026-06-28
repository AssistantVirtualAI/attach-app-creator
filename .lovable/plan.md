# Plan — Android SIP parité iOS + métriques + transcription status

## 1. Android natif (parité iOS)
**Fichier:** `apps/ava-softphone-mobile/android/app/src/main/java/.../CapacitorSip/` (créer si absent)
- `CapacitorSipPlugin.kt` : exposer `initAccount`, `call`, `hangup`, `hold`, `startRecord` (mêmes signatures que iOS).
- Avant `initAccount` : demander `Manifest.permission.RECORD_AUDIO` via `ActivityCompat.requestPermissions`; bloquer si refus.
- `AudioManager` :
  - `mode = MODE_IN_COMMUNICATION`
  - `isSpeakerphoneOn` configurable
  - acquérir audio focus `AUDIOFOCUS_GAIN_TRANSIENT`
- `RTPAudioSession.kt` (équivalent Swift) :
  - `AudioRecord` (VOICE_COMMUNICATION, 8 kHz mono) pour capture → encode PCMU → RTP TX
  - `AudioTrack` (STREAM_VOICE_CALL, 48 kHz mono, MODE_STREAM) pour RX
  - Décodage PCMU (μ-law → PCM16)
  - **Upsampling 8→48 kHz** (interpolation linéaire) et **downsampling 48→8 kHz** (moyenne) — port direct du Swift
  - **Jitter buffer** : amorçage 3 paquets (60 ms), re-prime sur underrun
- `AndroidManifest.xml` : `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE_MICROPHONE`.

## 2. Logs & métriques jitter / codec (iOS + Android)
**iOS** `RTPAudioSession.swift`, **Android** `RTPAudioSession.kt` :
- Compteurs : `packetsReceived`, `packetsDropped`, `underrunCount`, `repriming`, `avgJitterMs`, `decodedSamples`, `upsampledOutSamples`.
- Log toutes les 5 s : `[RTP] rx=… drop=… underruns=… jitter=…ms buffer=…pkts`.
- Émettre événement Capacitor `rtpStats` consommé côté JS dans `useSoftphone_new` → stocké en mémoire + visible dans un panneau debug (More → Diagnostics).
- Edge function existant inutile — métriques locales seulement.

## 3. Ringback : démarrage immédiat / arrêt strict
**Fichiers:** `src/lib/sip/ringback.ts`, `src/hooks/useSoftphone_new.ts`
- Confirmer `primeRingbackContext()` appelé **dans le handler du tap** (avant tout await) ; `startRingback()` immédiatement après.
- Arrêt UNIQUEMENT sur :
  - transition d'état → `'active'`
  - `callEnded` / `failed` / `hangup`
- Ajouter test : log `[ringback] start@tap`, `[ringback] stop reason=active|ended`.
- Garde : si plusieurs `progress` arrivent, ne pas redémarrer si déjà actif.

## 4. État de transcription (UI + provider)
**UI** `src/screens/CallDetailScreen.tsx` :
- Badge état : `⏳ En cours` / `✅ Terminée` / `❌ Échec`
- Sous-ligne : `Provider: Whisper-1` ou `Provider: Gemini (fallback)` ou erreur classifiée.
- Réutiliser colonnes existantes `planipret_phone_calls.transcription_status` / `transcription_provider` (ajouter migration si absentes).

**Edge** `supabase/functions/ai-transcribe-call/index.ts` :
- Vérifier ordre strict :
  1. `whisper-1` (OpenAI direct)
  2. Si throw / status ≠ 2xx / texte vide → log `whisper_failed reason=…`
  3. **Puis seulement** appeler Gemini via Lovable Gateway
- Persister `transcription_provider` = `whisper` | `gemini-fallback`, `transcription_status` = `processing|done|failed`, `transcription_error`.
- Émettre Realtime sur `planipret_phone_calls` pour mise à jour live du badge.

## 5. Vérification
- Build Android (Gradle) via `npx cap sync android` (instruction utilisateur).
- Test manuel : appel sortant → vérifier ringback instantané ; appel entrant Android → audio clair, pas de choppy ; déclencher transcription → badge passe `en cours → terminé (Whisper-1)` ; forcer échec Whisper (clé invalide simulée) → fallback Gemini visible.

## Hors scope
- Intégrations Microsoft (manuel par l'utilisateur).
- Refonte UI au-delà du badge transcription.
