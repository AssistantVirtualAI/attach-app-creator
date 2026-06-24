# Refonte mobile Planiprêt — Plan en 10 phases

**Portée :** Organisation AVA Main Dashboard uniquement. Aucune modification backend (Edge Functions, schémas `planipret_*`, auth, NS-API, ElevenLabs, Maestro/M365). Refonte UI/UX mobile uniquement, avec ajout de 2 tables (`planipret_team_messages`, `planipret_ava_conversations`) pour les nouvelles surfaces Chat Équipe et AVA Chat.

**Cible :** `src/pages/planipret/PlanipretMobile.tsx` + `src/pages/planipret/mobile/**` + `src/components/planipret/**`.

---

## Phase 1 — Fondations visuelles (design system)

Mettre en place le système de tokens dark navy partagé par tous les écrans avant de toucher les pages.

- Ajouter variables CSS dans `src/index.css` (scope `.planipret-mobile`) :
  `--bg-base #060D1A`, `--bg-surface #0A1628`, `--bg-elevated #0D1F35`, `--bg-deep #040B16`, `--bg-border #0A1E35`, `--bg-border-2 #0E2A45`, `--brand-accent #2E9BDC`, `--color-success #00D4AA`, `--color-agent #9B7FE8`, `--color-warning #F5A623`, `--color-danger #E84C4C`, `--text-primary #E8EDF5`, `--text-secondary #8FA8C0`, `--text-muted #4A7FA5`, `--text-faint #2A4A6A`.
- Importer Inter + DM Sans (Google Fonts) dans `index.html`.
- Créer primitives partagées sous `src/components/planipret/mobile/ui/` :
  `GlassCard`, `StatCard`, `PillTabs`, `PrimaryButton`, `SecondaryButton`, `DangerButton`, `StatusPill`, `Avatar`, `BottomSheet`, `Waveform`.
- Animations standard : transition 200ms ease-out, tap scale(0.98), tab fade 150ms, bottom-sheet spring translateY.

## Phase 2 — Conteneur téléphone + navigation 5 onglets

Restructurer `PlanipretMobile.tsx` comme shell unique qui contient TOUT (overlays, modals, chatbot inclus).

- Wrapper desktop : 390×844, `border-radius:44px`, `border:2px solid #1A3A5A`, `background:#060D1A`, double box-shadow + inset highlight, `overflow:hidden`.
- Wrapper mobile (`<768px`) : 100vw/100vh, pas de border-radius.
- Tous les `position:fixed` deviennent `position:absolute` relatifs au conteneur.
- Nouvelle nav 5 onglets : Accueil / Appels / Messages / Contacts / Plus (Voicemail retiré de la nav).
- Routes : `/mplanipret/home|calls|messages|contacts|more` (+ redirection legacy `/mplanipret/voicemail` → `/mplanipret/calls?tab=voicemails`).
- Tab bar 72px, `rgba(4,11,22,0.98)` + blur(20px), icône 22px + label 9px, dot bleu actif, couleurs inactif `#2A4A6A` / actif `#2E9BDC`.
- FAB central 56px gradient `#1A4A8A→#2E9BDC`, flotte 16px au-dessus, ouvre `DialerSheet` (existant).

## Phase 3 — Écran Accueil (`/mplanipret/home`)

Refonte complète avec cartes glass-morphism dark, suppression de tout fond clair.

- Header : logo + "Planiprêt", pill statut SIP tappable (vert/rouge) qui déclenche reconnexion `ns-auth`.
- Greeting : éyebrow date majuscule `#2A4A6A`, "Bonjour, {prenom} 👋" Inter 26/700.
- SearchBar 48px qui ouvre un overlay plein conteneur appelant `pp-search`.
- StatsCards horizontales (4 × 140×100) alimentées par `planipret_phone_calls` (jour courant) : Appels, Manqués, SMS non lus, Voicemails. Bordure-top couleur par métrique.
- AI Recommendations card : gradient violet/bleu, 3 bullets depuis dernier `ai_analyze-call` / `pp-ava-proactive`, liens "Voir mes stats" + "Parler à AVA" (ouvre l'onglet AVA Chat).
- Brief IA card avec bouton [Écouter] gradient.
- Prochains RDV (M365) : 2 events ou CTA compact "Connectez M365 →".
- Appels récents : 3 derniers, avatar directionnel + score IA.
- Bouton AVA flottant 48px gradient violet (absolute, dans le conteneur), ouvre bottom-sheet 70% avec chat (réutilise UI Phase 5 sub-tab AVA).

## Phase 4 — Écran Appels (`/mplanipret/calls`)

Pill tabs `[Récents] [Actifs] [Manqués] [Enregistrements]`. Aucune route ni hook modifiés, juste présentation.

- **Récents** : cartes (pas de rows), avatar directionnel 40px, score IA, ligne d'actions expand-on-tap [🎙️][📝][🤖][📞], badge "🤖 Analysé" si `ai_summary`.
- **Actifs** : empty-state dark si aucun ; sinon carte large gradient, timer 40px, waveform animée, grille 2×2 d'actions (Muet/Attente/Transfert/Raccrocher). Overlay inbound plein conteneur avec 3 pulses + Répondre/Rejeter.
- **Manqués** : mêmes cartes, bordure gauche rouge, [📞 Rappeler] proéminent.
- **Enregistrements** (NOUVEAU) : cartes avec waveform statique, player audio inline (progress, ⏮▶⏭, vitesse 1×/1.5×/2×), transcript scrollable avec labels Broker/Client, [⬇️ Télécharger].

## Phase 5 — Écran Messages (`/mplanipret/messages`) + 2 tables backend

Sub-tabs pills horizontales : `[SMS] [Chat Équipe] [AVA Chat] [Emails]`.

**Migration SQL** (créée dans `supabase/migrations/`) :

```sql
-- planipret_team_messages
CREATE TABLE public.planipret_team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.planipret_profiles(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  reply_to uuid REFERENCES public.planipret_team_messages(id),
  reactions jsonb DEFAULT '{}'::jsonb,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planipret_team_messages TO authenticated;
GRANT ALL ON public.planipret_team_messages TO service_role;
ALTER TABLE public.planipret_team_messages ENABLE ROW LEVEL SECURITY;
-- policies: brokers du même domaine lisent/écrivent ; canal 'admin' restreint via has_role

-- planipret_ava_conversations
CREATE TABLE public.planipret_ava_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  message text NOT NULL,
  tool_calls jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.planipret_ava_conversations TO authenticated;
GRANT ALL ON public.planipret_ava_conversations TO service_role;
ALTER TABLE public.planipret_ava_conversations ENABLE ROW LEVEL SECURITY;
-- policy: user_id = auth.uid()
```

- **SMS** : threads card style dark, vue thread avec bulles, picker pièces jointes [📷][📄][🎙️], templates [⚡].
- **Chat Équipe** : sidebar canaux (général / transactions / leads-chauds / admin), zone messages avec avatar 32px, réactions 👍❤️🔥✅, threads reply, upload Storage (`organization-assets` ou nouveau bucket `planipret-team-files`), Realtime channel `team-chat:{domain}`, badge mentions `@name`.
- **AVA Chat** : interface principale d'AVA (le bouton flottant Home y redirige). Affiche tool executions, chips d'actions rapides [📞][📅][📊][📧][🔥], mic → VoiceAgent dans le conteneur. Persistance dans `planipret_ava_conversations`.
- **Emails M365** : CTA connect si absent ; sinon liste 20 derniers, détail avec [↩️][↪️][🗑️][🤖 Résumer], compose overlay avec autocomplete contacts.

Badge unread sur l'onglet Messages = SMS non lus + team mentions.

## Phase 6 — Écran Contacts (`/mplanipret/contacts`) — NOUVEAU

Remplace Voicemail dans la nav.

- SearchBar permanente.
- Pills `[Maestro CRM] [Téléphone] [Récents]`.
- **Maestro** : `maestro-actions` recherche, cartes avec score lead + quick actions [📞][💬][📧], détail = profil complet + historiques.
- **Téléphone** : permission contacts device (Capacitor `@capacitor/contacts` si dispo, sinon entrée manuelle), index alpha à droite.
- **Récents** : agrégation calls + SMS + emails dédupliquée.

## Phase 7 — Écran Plus (`/mplanipret/more`)

Refonte uniquement présentation, conserve toutes les actions existantes.

- Header avatar 72px gradient + nom + extension + [✏️ Modifier].
- Mini stats card "Ce mois: X appels · Y leads · Z%".
- Sections groupées : Mon compte / Téléphonie / Intégrations / Assistant AVA / Préférences / Aide / Déconnexion (rouge).
- Voicemail accessible ici en plus de l'onglet Appels.

## Phase 8 — Voicemail (déplacé)

- Surface principale = 4e sub-tab "Voicemails" dans `/mplanipret/calls`.
- Cartes dark, bordure gauche bleue si non lu, player inline + transcript, actions [📞 Rappeler][💾 Garder][🗑️ Supprimer].
- Lien depuis Plus → réutilise le même composant.

## Phase 9 — Système visuel global

Appliquer les tokens Phase 1 partout, supprimer tout fond clair restant, harmoniser :

- Cards : `var(--bg-surface)` + border `var(--bg-border-2)` + radius 16px.
- Boutons Primary / Secondary / Danger normalisés.
- Vérifier que chaque écran refondu n'utilise plus de `bg-white`, `text-black`, ni couleurs hardcodées.

## Phase 10 — Fixes critiques & QA

1. Bouton AVA = `position:absolute` dans le conteneur (jamais `fixed` page).
2. Audit tailwind grep `bg-white|text-black|bg-gray-[1-3]` sous `src/pages/planipret/mobile/` et `src/components/planipret/` → remplacer.
3. `overflow:hidden` sur frame desktop confirmé visuellement.
4. Badge Messages branché sur SMS + team mentions.
5. Stats Home : requête réelle `planipret_phone_calls` (today range).
6. Pill SIP "Hors ligne" → handler reconnexion `ns-auth`.
7. SearchBar → appel `pp-search` avec debounce 250ms.
8. Pull-to-refresh sur Appels / Messages / Contacts / Voicemails (composant partagé).

---

## Détails techniques

**Fichiers créés (estim.) :**
- `src/components/planipret/mobile/ui/*.tsx` (~10 primitives)
- `src/components/planipret/mobile/home/*.tsx` (StatsRow, AIRecsCard, BriefCard, UpcomingCard, RecentCallsCard, AvaFab)
- `src/components/planipret/mobile/calls/*.tsx` (CallCard, ActiveCallView, RecordingCard, AudioPlayer)
- `src/components/planipret/mobile/messages/*.tsx` (SmsList, TeamChat, AvaChat, EmailsList)
- `src/components/planipret/mobile/contacts/*.tsx`
- `src/pages/planipret/mobile/MContacts.tsx`
- `supabase/migrations/<timestamp>_planipret_team_and_ava_tables.sql`

**Fichiers édités :**
- `src/pages/planipret/PlanipretMobile.tsx` (shell + nav 5 onglets + FAB + frame)
- `src/pages/planipret/mobile/MHome.tsx`, `MCalls.tsx`, `MMessages.tsx`, `MMore.tsx`
- `src/index.css` (tokens scope `.planipret-mobile`)
- `index.html` (fonts)
- Router app (route `contacts`, redirect voicemail)
- `src/integrations/supabase/types.ts` (régénération auto après migration)

**Non touché (garanti) :** toutes Edge Functions, schémas `planipret_*` existants, auth/routing global, NS-API, ElevenLabs, Maestro/M365, dark mode prefs, PWA manifest, audit logging, Lemtel Communications.

**Stratégie de livraison :** chaque phase = un lot d'edits autonome, testable en preview avant de passer à la suivante. Phases 1-2 d'abord (sans elles, le reste casse visuellement). Phase 5 inclut la migration SQL — à appliquer avant d'écrire les composants Chat Équipe / AVA Chat.
