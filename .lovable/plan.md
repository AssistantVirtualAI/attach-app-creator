## État actuel

Refonte navy/glass terminée sur : Layout, Overview, Users, Calls, Messages, Voicemails, Reports + hook `useAdminRealtime`.

## Phases manquantes / améliorations restantes

### C1. Pages secondaires non refondues (encore style legacy)
- **PALeads.tsx** (132 l.) — pipeline & hot leads navy + Realtime
- **PATemplates.tsx** (95 l.) — éditeur SMS templates avec variables dynamiques
- **PAAuditLog.tsx** (182 l.) — table journal navy, filtres action/user/date, export CSV
- **PACompliance.tsx** (233 l.) — cartes RGPD/Loi 25 (consentements, rétention, exports)
- **PAAuditChecklist.tsx** (681 l.) — déjà gros, juste harmoniser tokens navy

### C2. Polish UX transverse
- Skeleton loaders cohérents (au lieu de "Chargement…") sur toutes les pages admin
- Empty states illustrés (icône + message + CTA) quand 0 résultats
- Toast global "Nouvelle activité" branché sur badge compteur sidebar (utilise `eventCount` du hook)
- Raccourcis clavier : `g o` Overview, `g u` Users, `g c` Calls, `/` focus recherche globale

### C3. Recherche globale (topbar)
- Champ recherche dans header → command palette (Ctrl/Cmd+K)
- Recherche cross-table : courtiers, appels (numéro), messages, leads

### C4. Notifications panel
- Bouton cloche actuel ne fait rien → dropdown listant les N derniers events Realtime
- Lien vers la page concernée au clic

### C5. Export & rapports
- Bouton "Exporter PDF" sur Reports (jspdf déjà dispo ?)
- Rapport hebdo auto par email (Edge function existante `useWeeklyReport` ?)

### C6. Performance
- Pagination serveur sur Calls/Messages (actuellement filtre client)
- Index DB sur `planipret_phone_calls.started_at`, `planipret_phone_messages.created_at` (à vérifier)

## Question

Quelle phase prioriser ? Tout C1 d'un coup, ou cherry-pick (ex: C1 + C3 command palette + C4 notifications) ?
