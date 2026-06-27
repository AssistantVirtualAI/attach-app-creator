## Objectif
Refonte visuelle complète de l'app mobile Planiprêt (`/mplanipret`) : esthétique premium, branding AVA cohérent, bouton AVA intelligent (Claude chat OU agent vocal ElevenLabs selon activation), et conservation totale du backend (Supabase, NS-API, Claude, Edge Functions).

## 1. Design System Planiprêt Mobile
- Nouveau token set dans `src/styles/planipret-mobile.css` : palette navy (#0a1628) + accent doré Planiprêt + gradient AVA (bleu→violet→magenta du logo).
- Glassmorphism profond (blur 24px, borders translucides 1px), ombres "elegant" multi-couches.
- Typo : Inter pour le body, Space Grotesk pour les headings/stats — pas de fonts génériques.
- Composants partagés réutilisés depuis Lemtel : `Dialpad`, `ActiveCallSheet`, boutons "Glass" — wrappés dans un thème Planiprêt (couleurs + gradients différents).

## 2. Branding AVA + Planiprêt sur chaque page
- **Page Auth** : grand logo AVA centré (le logo uploadé) + tagline "Planiprêt Mobile · Powered by AVA".
- **Header global** (`PlaniMobileHeader.tsx`) sur chaque page mobile :
  - Logo Planiprêt centré
  - Petit logo AVA + "Powered by AVA" en bas du header
  - Avatar courtier à droite
- **Footer global** (`PlaniMobileFooter.tsx`) : "Developed by AVA" + mini logo, version build.
- Assets : import du logo AVA fourni via `src/assets/ava-logo.png` (lovable-assets pointer).

## 3. Écrans rebuildés
- **Home / Accueil** : conservée — refresh visuel uniquement (cartes glass, animations Framer). Stats personnelles courtier + section "Insights AVA" (Claude) en cartes premium avec gradient AVA.
- **Calls** : timeline élégante, cartes recents glass, IA badges.
- **Dialer / Active Call** : boutons existants Lemtel réutilisés (verrouillés visuellement Planiprêt).
- **SMS / Voicemails / Profil** : carte list pattern uniforme.

## 4. Bouton AVA intelligent (remplace l'ancien chatbot/agent)
Un seul bouton flottant "AVA" en bas (FAB premium gradient) avec logique conditionnelle basée sur `planipret_profiles.voice_agent_enabled` :

```text
voice_agent_enabled = TRUE  → ouvre AvaVoiceSheet (ElevenLabs WebRTC)
voice_agent_enabled = FALSE → ouvre AvaChatSheet (Claude via pp-ava-chat)
```

- **AvaVoiceSheet** : utilise `@elevenlabs/react` (`useConversation`) + Edge Function `pp-ava-voice-token` qui mint un `conversation_token` à partir de `ELEVENLABS_API_KEY` et de `planipret_profiles.elevenlabs_agent_id`.
- **AvaChatSheet** : conserve l'intégration Claude existante (`pp-ava-chat`), juste relookée.
- Le FAB affiche un micro pulsant (voix) ou une bulle (chat) selon le mode actif.

## 5. Insights AVA sur Home (Claude)
- Carte "Insights AVA" sur Home appelant `pp-ava-insights` (réutilise/étend `pp-ava-chat`) : envoie stats du courtier (appels, leads chauds, conversions 7j) à Claude, retourne 3 insights actionnables.
- Skeleton + animation reveal Framer Motion.

## 6. Conservation backend (intouché)
- Aucune modif aux tables, RLS, ou Edge Functions existantes sauf ajout de `pp-ava-voice-token` (nouveau).
- AVA org only, séparation Lemtel respectée.
- Connexion ElevenLabs : utilise le standard connector → `ELEVENLABS_API_KEY` côté Edge Function uniquement.

## Détails techniques
- Fichiers créés :
  - `src/styles/planipret-mobile.css`
  - `src/components/mplanipret/layout/PlaniMobileHeader.tsx`
  - `src/components/mplanipret/layout/PlaniMobileFooter.tsx`
  - `src/components/mplanipret/ava/AvaFab.tsx` (FAB conditionnel)
  - `src/components/mplanipret/ava/AvaVoiceSheet.tsx`
  - `src/components/mplanipret/ava/AvaChatSheet.tsx` (refonte)
  - `src/components/mplanipret/home/AvaInsightsCard.tsx`
  - `src/assets/ava-logo.png.asset.json` (pointer)
  - `supabase/functions/pp-ava-voice-token/index.ts`
- Fichiers édités : layout root `/mplanipret`, `MHome.tsx`, `MAuth.tsx` (branding), pages courantes pour wrapper Header/Footer.
- Connector ElevenLabs : vérifier/lier via `standard_connectors`.

## Hors scope
- Aucune modif des dashboards admin web `/planipret/admin/*`.
- Aucun touch sur Lemtel.
- Pas de changement de logique softphone/SIP/RTP.
