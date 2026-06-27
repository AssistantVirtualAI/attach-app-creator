# Plan — Améliorations softphone mobile Lemtel

Périmètre : `apps/ava-softphone-mobile/**` + Edge Functions `ai-transcribe-call` / `ai-analyze-call`. Aucun changement Lemtel desktop ni autres portails. Après chaque phase, étape de test explicite à valider avant de passer à la suivante.

---

## Phase 1 — Ringback sortant (rapide, fondation audio)

**Problème 6** : aucun son de sonnerie côté appelant.

Actions :
- Vérifier `apps/ava-softphone-mobile/src/lib/sip/ringback.ts` (oscillateurs 440+480 Hz, cadence NA 2s on / 4s off).
- Dans `useSoftphoneNative.ts` : démarrer ringback dès `callPhase === 'ringing'` SANS early-media ; stopper sur `early-media`, `active`, `ended`, `idle`.
- Dans `CapacitorSip.swift` : confirmer émission de `provisional { code:180, hasSdp:false }` vs `183 hasSdp:true`.
- Gérer route audio : ringback doit sortir sur earpiece par défaut, pas écraser la session RTP.

**Test livré** : passer un appel vers une extension qui sonne sans répondre → entendre la tonalité de sonnerie locale ; décrocher → tonalité s'arrête net.

---

## Phase 2 — Speaker iOS

**Problème 1** : bouton speaker inopérant.

Actions :
- `CapacitorSip.swift` : `setAudioRoute(route:)` doit appeler `AVAudioSession.overrideOutputAudioPort(.speaker | .none)` APRÈS `setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetooth, .defaultToSpeaker])`, puis renvoyer `outputs` réels via `currentRoute.outputs`.
- Ne PAS toucher catégorie pendant un appel actif (cause connue de mute) ; uniquement `overrideOutputAudioPort`.
- `audioOutput.ts` : déjà câblé sur le natif, vérifier que `applySink` HTML ne court-circuite pas le résultat natif.
- Ajouter logs natifs `[AudioRoute] applied=speaker outputs=Speaker`.

**Test livré** : en appel actif, toggler speaker → audio bascule haut-parleur ; re-toggle → earpiece ; bouton reflète l'état réel.

---

## Phase 3 — Keypad standard

**Problème 3** : retirer le style « glass » récent du keypad.

Actions :
- `apps/ava-softphone-mobile/src/components/Dialpad.tsx` : revenir à des boutons ronds standards (shadcn `Button variant="outline"`, taille 64px, typo system, ripple natif, halo discret au tap, pas de gradient radial, pas de `::before` shine).
- Conserver le DTMF natif et l'haptique légère.

**Test livré** : ouvrir le dialer → keypad sobre, lisibilité chiffres OK, tap clair, plus d'effet futuriste.

---

## Phase 4 — Qualité audio + noise cancellation + focus voix

**Problème 4** : son médiocre, pas de NS/AEC/AGC.

Actions :
- `RTPAudioSession.swift` (RemoteIO) : activer `voiceProcessingIO` (`kAudioUnitSubType_VoiceProcessingIO`) au lieu de `RemoteIO` pur → AEC + NS + AGC iOS natifs gratuits.
  - Propriétés : `kAUVoiceIOProperty_BypassVoiceProcessing = 0`, `kAUVoiceIOProperty_VoiceProcessingEnableAGC = 1`, iOS 13+ `setAGCEnabled`, `setBypassVoiceProcessing(false)`.
- `AVAudioSession` : mode `.voiceChat` (déjà), ajouter `setPreferredIOBufferDuration(0.02)` et `setPreferredSampleRate(48000)`.
- Codec SDP : déjà PCMU/PCMA (G.711). Ajouter négo Opus 16 kHz si le PBX le supporte (offer `a=rtpmap:111 opus/48000/2` + `a=fmtp:111 useinbandfec=1; usedtx=1`). Fallback transparent à G.711.
- Jitter buffer : implémenter buffer adaptatif 20–60 ms côté réception RTP (dejitter avant push vers RemoteIO) pour réduire les craquements.
- Logs : `[Audio] codec=opus/48k AEC=on NS=on AGC=on bufferMs=20`.

**Test livré** : appel test, parler dans un café (bruit ambiant) → l'interlocuteur n'entend que la voix ; tester écho en speaker → aucun retour ; mesurer MOS subjectif > G.711 baseline.

---

## Phase 5 — Enregistrement + accès temps réel + pré-téléchargement

**Problème 2** : record déclenché mais introuvable, accès temps réel + cache local manquants.

Actions :
- Diagnostic : vérifier que `CapacitorSip.startRecord()` invoque bien le PBX (`recording_action=start` sur FusionPBX via API ou DTMF `*1`) ET que le CDR remonte avec `record_path`.
- Edge Function `pp-recordings-list` (ou existante) : exposer `recording_path`, `recording_status` (`pending|ready`) et URL signée 1h.
- `RecordingsScreen.tsx` : 
  - Subscription realtime sur `pbx_xml_cdr` (filter `record_path IS NOT NULL`) → injecte nouvelles entrées en haut.
  - Badge « En traitement » tant que `record_status != ready`.
- Pré-téléchargement : nouveau service `apps/ava-softphone-mobile/src/lib/recordings/prefetch.ts` qui, au montage de l'écran et sur événement realtime, télécharge silencieusement les 20 dernières en cache Capacitor `Filesystem` (Documents/recordings/<uuid>.wav). Lecture offline si présent.
- UI : pastille « ⬇ Téléchargé » vs « ☁ Streaming ».

**Test livré** : démarrer un appel → toggle Record (REC banner) → raccrocher → dans les 30 s la ligne apparaît dans Recordings sans refresh, statut passe `pending → ready`, fichier auto-téléchargé, lecture instantanée hors-ligne (mode avion).

---

## Phase 6 — Transcription forcée + fallback Claude

**Problème 5** : transcription échoue, besoin de fallback.

Actions :
- Forcer la transcription : à la fin de chaque appel enregistré, `useSoftphoneNative` déclenche `ai-transcribe-call` automatiquement (debounce 30 s pour laisser le PBX synchroniser le WAV). Plus de bouton manuel obligatoire ; bouton reste pour re-run.
- Edge Function `ai-transcribe-call` : 
  - Tentative 1 — Lovable AI `openai/gpt-4o-mini-transcribe` (déjà en place).
  - Si erreur (`stub`, `recording-not-synced` après 3 retries espacés, `missing-ai-key`, réponse vide < 5 chars) → **fallback Claude** via `ANTHROPIC_API_KEY` (déjà en secrets) : utiliser `claude-3-5-sonnet` avec audio attaché en base64 (ou Claude Haiku audio si dispo) ; sinon convertir WAV en chunks et utiliser `messages` avec `input_audio`.
  - Marquer `transcription_provider` dans `ai_call_insights` (`lovable|claude`).
- `useCallAi.ts` : afficher provenance + bouton « Réessayer avec Claude » si fallback non auto-déclenché.
- `ai-analyze-call` : inchangé, consomme le texte fourni.

**Test livré** : appel test 30 s, raccrocher → 30 s plus tard, transcription apparaît automatiquement dans le détail de l'appel ; simuler échec Lovable (clé vide en dev) → fallback Claude s'enclenche, badge « via Claude » visible.

---

## Détails techniques (référence dev)

Fichiers principaux touchés :
- `apps/ava-softphone-mobile/ios/App/App/CapacitorSip.swift` (P1, P2, P4, P5)
- `apps/ava-softphone-mobile/ios/App/App/RTPAudioSession.swift` (P4 — VoiceProcessingIO)
- `apps/ava-softphone-mobile/src/hooks/useSoftphoneNative.ts` (P1, P5, P6)
- `apps/ava-softphone-mobile/src/lib/sip/ringback.ts` (P1)
- `apps/ava-softphone-mobile/src/lib/sip/audioOutput.ts` (P2)
- `apps/ava-softphone-mobile/src/components/Dialpad.tsx` (P3)
- `apps/ava-softphone-mobile/src/screens/RecordingsScreen.tsx` (P5)
- `apps/ava-softphone-mobile/src/lib/recordings/prefetch.ts` *(nouveau, P5)*
- `apps/ava-softphone-mobile/src/hooks/useCallAi.ts` (P6)
- `supabase/functions/ai-transcribe-call/index.ts` (P6 — fallback Claude)

Après chaque phase touchant le natif iOS : `git pull` + `npx cap sync ios` + rebuild Xcode requis côté utilisateur.

Aucun changement Lemtel desktop, aucun edit Landing, aucune migration de schéma (réutilisation tables existantes).

---

Confirme et je commence par la **Phase 1 (ringback)**, ou indique une autre phase prioritaire.