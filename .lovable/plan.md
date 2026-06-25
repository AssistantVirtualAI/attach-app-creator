# Planipret Admin — Refonte navy/glass

## État actuel — TERMINÉ ✅

- **C1 Pages refondues** : Layout, Overview, Users, Calls, Messages, Voicemails, Reports, Leads, Templates, AuditLog, Compliance, AuditChecklist
- **C2 Polish UX** : `PPSkeleton` + `PPEmptyState` + raccourcis clavier (`Cmd+K`, `g o/u/c/...`)
- **C3 Command palette** : recherche cross-table (courtiers, appels, messages) + navigation
- **C4 Notifications** : `NotificationsBell` avec dropdown + compteur unread + singleton `useAdminRealtime`
- **C5 Export PDF** : `jspdf` + `html2canvas` sur Reports
- **C6 Performance** :
  - Index DB sur `planipret_phone_calls/messages/voicemails/pipeline/audit_log`
  - Pagination serveur (`range` + `count: exact`) sur PACalls, PAMessages, PAVoicemails, PAAuditLog, PALeads
  - Exports CSV étendus (5k–10k lignes filtrées serveur)

## Améliorations futures possibles

- Rapport hebdo auto par email (Edge function `pp-weekly-report`)
- Recherche full-text Postgres sur transcripts d'appels
- Heatmap horaire d'activité par courtier
- Bulk actions sur la table Users (export, suspend en masse)
