# Plan — Refonte mobile Planiprêt (Navy Trust + Accueil pro courtier)

## Objectif
Aligner `/mplanipret` sur l'élégance du portail admin (palette Navy Trust claire, typo Urbanist + Epilogue) et transformer la page d'accueil en véritable cockpit courtier : stats réelles, filtres temporels, résumé IA quotidien/hebdo/mensuel.

---

## 1. Système visuel "Navy Trust Mobile"

Créer `src/styles/planipret-mobile-theme.css` scopé sous `.mplanipret-scope` (isolé du dark theme actuel et du scope admin) :

- Fond app : `#F7F9FC`, surfaces : `#FFFFFF` avec ombre douce `0 4px 24px rgba(30,58,95,0.06)`
- Navy `#1E3A5F` (titres/CTA), accent `#3B6FA0`, succès `#10B981`, alerte `#F59E0B`, danger `#EF4444`
- Typo : Urbanist (KPI, titres, FAB), Epilogue (corps, listes)
- Composants : `pp-mobile-card`, `pp-mobile-kpi`, `pp-mobile-pill`, `pp-mobile-tab`, `pp-mobile-sheet` — même langage que `pp-card / pp-pill` admin
- Header sticky vitrifié (blur léger sur `rgba(247,249,252,0.85)`), logo Planiprêt centré, badge AVA gauche, cloche notif droite
- FAB AVA conservé (logo coloré) mais re-stylé bordure navy + halo doux
- Footer "POWERED BY AVA" conservé, recoloré navy/accent

Mise à jour des écrans existants pour utiliser le nouveau scope sans toucher la logique :
- `PlanipretMobile.tsx` (frame + login intégré)
- `pages/mplanipret/Home.tsx`, `Calls.tsx`, `Messages.tsx`, `Calendar.tsx`, `Contacts.tsx`, `Settings.tsx`
- `AvaChatSheet.tsx`, `AvaVoiceAgent` wrapper

Aucune modification des Edge Functions ni des hooks de données.

---

## 2. Accueil enrichi — Cockpit courtier

### 2.1 En-tête personnalisé
- Salutation dynamique ("Bonjour Marc — mercredi 14h22")
- Statut SIP + DND + transfert (déjà dispo via `mobile-dashboard`)
- Sélecteur de période global : **Aujourd'hui · Cette semaine · Ce mois · Mon quart** (persisté `localStorage`)

### 2.2 Bandeau KPI (6 cartes, données réelles)
Source : `mobile-dashboard` + nouveaux agrégats Planiprêt (déjà tables existantes, pas de migration) :
1. **Appels** (répondus / manqués) — `planipret_phone_calls`
2. **SMS non lus** — `planipret_phone_messages`
3. **Courriels** non lus — `planipret_profiles` (compte Gmail/Outlook déjà sync via `calendar_integrations` / future colonne mail si présente, sinon section vide gracieuse)
4. **Meetings cette semaine** — `appointments` filtré par `user_id`
5. **Leads chauds** — `planipret_phone_calls.lead_score >= 7` + `leads.status`
6. **Tâches à faire** — `planipret_reminders` non complétées

Cartes `pp-mobile-kpi` avec micro-sparkline (Recharts léger déjà présent).

### 2.3 Sections détaillées (collapsibles, ordre courtier)
- **🔥 Leads chauds** (top 5) — nom, score, dernière interaction, CTA Appeler/SMS
- **📅 Rendez-vous à venir** (semaine) — heure, client, type, lien visio si dispo
- **✅ Tâches du jour** — checkbox inline (update `planipret_reminders`)
- **📞 Appels manqués prioritaires** — avec badge "rappel suggéré"
- **💬 Conversations non lues** — SMS + chat équipe
- **📧 Courriels en attente** (si intégration présente)

Chaque section respecte le filtre de période. Pull-to-refresh global (hook existant `usePullToRefresh`).

### 2.4 Résumé IA AVA — "Brief du jour"
Nouvelle carte en haut, sous le KPI, **fixe et magnifique** :
- 3 modes via segmented control : **Jour / Semaine / Mois**
- Génération via nouvelle Edge Function **`pp-ava-brief`** (calque sur `pp-ava-chat` existant, même provider Lovable AI Gateway, `google/gemini-3-flash-preview`)
  - Input : profil courtier + agrégats (appels, leads, RDV, tâches, SMS) sur la période
  - Output structuré Zod : `{ headline, priorities[3], risks[], suggestions[3] }`
  - Cache 30 min en `planipret_ai_insights` (table existante) pour éviter coûts
- UI : headline gras navy, 3 priorités numérotées, chips suggestion cliquables (call/sms/reminder via payload — réutilise `SuggestionSchema` de `pp-ava-chat`)
- Bouton "Régénérer" + "Écouter" (TTS optionnel via AVA voice si activé)

### 2.5 États vides & erreurs
- Skeletons Navy doux
- Message clair si intégration manquante (ex. calendrier non connecté → CTA "Connecter")
- Mode dégradé respecté (déjà géré pour `pp-ns-users`)

---

## 3. Détails techniques

- **Aucune migration DB** (tables `planipret_phone_calls`, `appointments`, `planipret_reminders`, `planipret_ai_insights`, `planipret_phone_messages` déjà présentes)
- **Nouvelle Edge Function** : `supabase/functions/pp-ava-brief/index.ts` (verify_jwt off, JWT validé en code, CORS standard, gateway helper partagé)
- **Nouveau hook** : `src/hooks/usePlanipretBrief.ts` (React Query, key `[brief, period, userId]`, TTL 30 min)
- **Nouveau hook** : `src/hooks/usePlanipretHomeStats.ts` agrégateur unique appelant `mobile-dashboard` + queries Supabase scopées RLS (utilisateur connecté)
- **Composants nouveaux** sous `src/components/mplanipret/home/` : `PeriodFilter.tsx`, `KpiGrid.tsx`, `BriefCard.tsx`, `HotLeadsList.tsx`, `MeetingsList.tsx`, `TasksList.tsx`, `MissedCallsList.tsx`, `UnreadThreadsList.tsx`, `EmailsList.tsx`
- **Theme CSS** scopé : aucune fuite vers admin ou autres apps
- **Backend Lemtel intact** : aucune touche à `useSoftphone*`, `CapacitorSip`, RTP, etc.

---

## 4. Livrables & validation

1. Thème Navy Trust mobile appliqué à toutes les pages `/mplanipret/*`
2. Accueil refondu avec 6 KPI + 6 sections + Brief IA
3. Filtre période fonctionnel et persistant
4. Edge Function `pp-ava-brief` déployée et testée
5. Test Playwright : `/mplanipret/home` charge, affiche KPI, brief IA visible, filtre change les données
6. Aucun impact sur `/planipret/admin/*` ni Lemtel

```text
┌──────────────────────────────┐
│  AVA  ·  Planiprêt  ·  🔔    │  header glass navy
├──────────────────────────────┤
│  Bonjour Marc — mer 14:22    │
│  [Jour][Semaine][Mois][Quart]│  filtre
│                              │
│  ┌───────── BRIEF AVA ─────┐ │
│  │ "3 leads chauds à rappe-│ │
│  │  ler avant 17h..."      │ │
│  │  1. Appeler Dupuis      │ │
│  │  2. Confirmer RDV Roy   │ │
│  │  3. Relancer Tremblay   │ │
│  │  [Régénérer] [Écouter]  │ │
│  └─────────────────────────┘ │
│                              │
│  [Appels][SMS][Mails]        │
│  [RDV  ][Hot ][Tâches]       │  KPI
│                              │
│  🔥 Leads chauds   >         │
│  📅 RDV semaine    >         │
│  ✅ Tâches du jour >         │
│  📞 Manqués        >         │
│  💬 Non lus        >         │
│  📧 Courriels      >         │
│                              │
│       (•) FAB AVA            │
│  POWERED BY AVA · DEV BY AVA │
└──────────────────────────────┘
```
