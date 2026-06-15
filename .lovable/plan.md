## Phase 2 — Ring Groups visual editor

Refondre `src/pages/telephony/TelephonyRingGroups.tsx` pour passer d'un formulaire texte basique à un vrai éditeur visuel branché sur les données PBX réelles, avec auto-sync au chargement et write-back FusionPBX.

### 1. Auto-sync à l'arrivée sur la page
- Dans `TelephonyRingGroups`, si `groups.length === 0` au premier render et qu'aucun job `sync-ring-groups` n'a été lancé récemment, invoquer automatiquement :
  - `fusionpbx-proxy` action `sync-ring-groups` (déjà existante, ligne 2148)
  - puis `qc.invalidateQueries({ queryKey: ['pbx'] })`
- Bouton manuel "Resync from PBX" en haut à droite à côté de `PbxRefreshButton`.

### 2. Liste enrichie (vue table)
Colonnes : Nom, Extension, Stratégie (badge coloré par stratégie), Membres (avatars empilés des extensions avec nom + statut registration depuis `usePbxExtensions`), Forwarding (badge "voicemail", "external", ...), Statut, Actions.
Ligne cliquable → ouvre l'éditeur en mode `edit`.

### 3. Nouveau `RingGroupDialog` visuel (tabs)

**Tab "General"**
- Nom, Extension (auto-suggestion du prochain numéro libre), Description, Switch Enabled.
- Sélecteur stratégie en cartes radio (simultaneous / sequence / enterprise / rollover / random) avec icône + courte description.

**Tab "Destinations"** (cœur du visuel)
- Picker à gauche : liste filtrable de toutes les extensions (`usePbxExtensions`), ring groups (`usePbxRingGroups`), queues (`usePbxQueues`). Affiche extension + display_name + statut registered/offline.
- Panneau à droite : liste ordonnée des destinations sélectionnées avec drag-handle (`@dnd-kit/core` déjà présent), champ "Timeout (s)" et "Prompt" par destination, bouton supprimer.
- Sérialisation : chaque ligne sous forme `300,30` (extension,timeout) concaténée par virgule pour `ring_group_destinations` (format FusionPBX).
- Parser dans `getDestinations` mis à jour pour relire ce format au chargement.

**Tab "Fallback"**
- Sélecteur visuel "Forward destination" : extension / voicemail / ring group / queue / custom — produit la chaîne `voicemail:300`, `transfer:301 XML default`, etc.
- Caller ID prefix / name prefix (champs `ring_group_cid_name_prefix`, `ring_group_cid_number_prefix`).
- Music on hold dropdown (depuis `usePbxHoldMusic`).
- Missed call alert email (`ring_group_missed_call_data`).

### 4. Hook helper
Nouveau `src/hooks/usePbxQueues.ts` / réutilise existant. Ajouter petit utilitaire `parseRingGroupDestinations` + `serializeRingGroupDestinations` dans `src/lib/pbx-ring-groups.ts` (testables séparément).

### 5. Write-back FusionPBX (inchangé)
Continuer d'utiliser `create-ring-group` / `update-ring-group` / `delete-ring-group` du proxy. Après chaque save → lancer `sync-ring-groups` pour rafraîchir la table locale avec la version FusionPBX.

### 6. Empty-state amélioré
Si zéro ring group après sync : carte centrale avec illustration, bouton "Create your first ring group" + bouton "Resync from PBX".

### Files touched
- **Edit** `src/pages/telephony/TelephonyRingGroups.tsx` — refonte complète UI/UX.
- **New** `src/lib/pbx-ring-groups.ts` — parse/serialize destinations.
- **Edit** `src/hooks/usePbxData.ts` — éventuel `usePbxRingGroupMembers` helper si nécessaire pour résoudre extension → display_name.

### Out of scope (Phase 2)
- Pas de nouvelle table SQL (formats déjà supportés).
- Pas de modification du proxy edge function (actions déjà en place).
- Pas de "Test Ring Group" via `originate` (peut venir en Phase 4 avec Queue Agents).
- Pas de refonte visuelle globale du module Telephony.

### Validation
1. Naviguer `/telephony/ring-groups` → sync auto → ring groups existants apparaissent avec leurs membres résolus.
2. Edit d'un groupe existant → destinations affichées dans l'ordre, drag-reorder fonctionne, save → vérifier dans FusionPBX que l'ordre est respecté.
3. Création d'un nouveau groupe avec 3 extensions + fallback voicemail → vérifier appel entrant fait sonner les 3 puis tombe sur voicemail.
4. Delete → ligne disparaît de la table locale ET de FusionPBX.