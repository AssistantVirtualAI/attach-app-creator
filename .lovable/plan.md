## État actuel — ce qui existe déjà ✅

J'ai vérifié `/mplanipret` et la majorité du squelette UI est **déjà bâti** :

**Coquille (`PlanipretMobile.tsx`)**
- ✅ Cadre téléphone 390×844, bordure, ombre, fond `#060D1A`
- ✅ Barre d'onglets en bas, FAB central bleu
- ✅ DialerSheet (clavier 12 touches, +, appel via `ns-calls`)
- ✅ `useRealtimeManager` (inbound, ai-insight), `InboundCallOverlay`
- ✅ Badges non-lus messages/voicemails
- ✅ `UniversalSearchBar`, `usePullToRefresh`, `SessionTimeoutModal`, `PrivacyConsentGate`, `OnboardingTutorial`

**Écrans existants**
- ✅ MHome, MCalls (sous-onglets recents/active/missed/recordings/voicemails), MMessages (SMS/Équipe/AVA/Emails + Realtime `pp-team-chat` sur `planipret_team_messages`), MMore, MVoicemail, MContacts, MPipeline, MSearch, MStats
- ✅ AvaVoiceAgent overlay, composants recordings/voicemail

**Backend (à NE PAS toucher)**
- ✅ Edge functions `ns-calls`, `ns-sms`, `ns-auth`, `ms365-*`, `maestro-*`, `ai-analyze-call`, `generate-voicemail-greeting`, `ava-agent-config`
- ✅ Tables `planipret_*`, Realtime publications, RLS

## Écarts vs spécification ⚠️

| # | Écart | Sévérité |
|---|---|---|
| 1 | Tab bar = **6 colonnes** (Accueil/Appels/FAB/Messages/**Contacts**/Plus) au lieu de **5** (la spec retire Contacts du bottom bar) | moyen |
| 2 | FAB ne passe **pas en rouge pulsant** pendant un appel actif | moyen |
| 3 | Bouton flottant **AVA Voice** absent du MHome (devrait être bottom:80 right:16, gated par `voice_agent_enabled`) | moyen |
| 4 | MHome : KPIs, carte "AVA recommande", "Brief IA", "Appels récents", "Prochains RDV" à aligner sur la spec exacte (4 KPIs : Appels / Manqués / SMS non lus / Voicemails) | moyen |
| 5 | DialerSheet : hauteur 85%, sous-lettres ABC/DEF, hold-backspace 1s = clear, états visuels (`scale 0.92` + tinted bg) | mineur |
| 6 | RecordingDetailSheet 4 onglets (Audio / Transcript / Coaching / Maestro) à harmoniser avec la maquette détaillée (cercle de score, sections colorées) | moyen |
| 7 | VoicemailGreetingSheet 3 étapes (voix ElevenLabs → texte avec templates + IA → génération + activation) — composant à créer dans `/more` | majeur |
| 8 | Toast IA "slide-up" en bas du container avec actions (Voir / Plus tard) | mineur |
| 9 | Overlay AVA : visualisations d'état (idle/connecting/listening/speaking/processing/tool_running) à compléter | moyen |
| 10 | Overlay Inbound Call : lookup Maestro (avatar, nom, étape, "X appels précédents") à compléter | moyen |
| 11 | Skeletons partout (KPI, listes) au lieu de "Chargement…" | mineur |
| 12 | Transitions de page (fade 150ms entre onglets, slide pour navigation interne) | mineur |
| 13 | Tokens CSS `--pp-*` à figer dans `index.css` selon palette de la spec | mineur |

---

## Plan multi-phases

### Phase 1 — Refonte de la coquille (shell)
- Réduire la tab bar à 5 colonnes : Accueil / Appels / **FAB** / Messages / Plus. Déplacer Contacts dans MMore (route `/mplanipret/contacts` conservée).
- FAB : nouvel état `inCall` (rouge + animation `pulse-red 1.5s`) déclenché via Realtime/`useActiveCall`.
- Ajouter le bouton flottant AVA Voice (bottom:80 right:16, conditionné par `profile.voice_agent_enabled`).
- Geler les tokens CSS `--pp-bg-*`, `--pp-brand-*`, `--pp-text-*` dans `src/index.css` selon la spec.
- Remplacer les écrans de chargement par un `<MobileSkeleton variant="…" />`.

### Phase 2 — MHome conforme
- 4 cartes KPI exactes (Appels / Manqués / SMS non lus / Voicemails) avec couleurs et `border-top` corrects.
- Carte "🤖 AVA recommande" (3 items dynamiques + refresh + CTA "Parler à AVA").
- Carte "🎧 Brief IA du jour" (bouton Écouter ouvre le brief audio).
- Carte "📞 Appels récents" (3 derniers + badge AI).
- Carte "📅 Prochains RDV" (M365 ou CTA connexion).
- Skeletons shimmer sur chaque carte.

### Phase 3 — Dialer + écran Appels
- DialerSheet : hauteur 85%, drag-handle, sous-lettres, hold-backspace 1s, animations.
- MCalls : sous-onglets pill-style ; cartes avec border-left coloré ; pipeline 4 étapes sur Enregistrements ; CTA Rappeler sur Manqués.
- RecordingDetailSheet 4 onglets harmonisé avec la maquette (cercle score, sections colorées, "Tout créer" batch Maestro). Aucun changement aux Edge Functions appelées.
- ActiveCallCard : timer, waveform, grille 2×2 (Muet/Attente/Transfer/Raccrocher).

### Phase 4 — Messages (SMS / Équipe / AVA / Emails)
- Sous-tabs pills horizontales déjà présents → ajustement visuel.
- Bulles SMS gradient envoyé / dark reçu (border-radius spec).
- Équipe : sidebar canaux, réactions, threading, upload fichier (Storage).
- AVA : quick-chips, intégration micro → ouvre VoiceAgent overlay.
- Emails : liste + détail + composer + "Résumer avec AVA".

### Phase 5 — MMore + VoicemailGreetingSheet
- Refonte MMore en sections (Mon compte / Téléphonie / **Boîte vocale IA** / Intégrations / Assistant AVA / Préférences / Aide / Déconnexion).
- **Nouveau composant** `VoicemailGreetingSheet` (3 étapes) branché sur `generate-voicemail-greeting` + ElevenLabs voices existantes. Aucun nouveau secret.
- EditProfileSheet, gestion DND avec horaire, export GDPR (`pp-gdpr-export`).
- Toggles Mode sombre + Notifications (Permission API).

### Phase 6 — Overlays AVA + Inbound + Toasts + Transitions
- AvaVoiceAgent : visualisations 7 états, ToolNotification slide-down, transcript live, modal de confirmation.
- InboundCallOverlay : lookup Maestro (skeleton → fiche), 3 rings pulse, auto-dismiss 30s + toast manqué.
- Toast système : positionné bas du container, types (success/error/info/warning/ai), action buttons pour insights IA.
- Transitions : fade 150ms entre tabs ; slide 300ms pour navigation interne via `framer-motion`.

### Phase 7 — Recherche globale + Pull-to-refresh + QA
- GlobalSearchOverlay branché sur `pp-search` (groupes : Appels / Messages / Voicemails / Contacts / Emails), historique localStorage.
- Pull-to-refresh sur toutes les listes (déjà hook, à appliquer partout).
- Tests manuels device 390×844 + responsive mobile.

---

## Règles strictes respectées

- ❌ Aucune modification d'Edge Function, de table, de RLS, de secrets, de configuration ElevenLabs.
- ❌ Aucune modification de Lemtel ni du dashboard admin.
- ❌ Aucun nom de canal Realtime modifié.
- ✅ Toutes les requêtes Supabase et signatures conservées à l'identique.

## Détails techniques

- Tous les overlays utilisent `position: absolute` à l'intérieur du `<Frame>` (jamais `fixed`).
- Le FAB en mode appel s'abonne à `planipret_phone_calls` filtré par `status in ('active','ringing')` via le `useRealtimeManager` existant.
- Le composant `VoicemailGreetingSheet` appelle uniquement `supabase.functions.invoke('generate-voicemail-greeting', { … })` — aucun changement côté serveur.
- Les skeletons utilisent une seule keyframe `shimmer` ajoutée à `index.css`.
- L'overlay AVA réutilise `AvaVoiceAgent.tsx` existant ; on ajoute les états visuels manquants sans toucher à la logique LLM.
