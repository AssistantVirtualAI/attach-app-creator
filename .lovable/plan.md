
Gros chantier — découpé en 4 phases pour livrer chaque page utilisable indépendamment. Aucun changement visuel global (on garde glass/cyberpunk, navigation, agents IA intacts).

## État actuel (vérifié)

| Page | Données en base | Problème |
|---|---|---|
| IVR | 2 IVR, 0 options, 0 audio | Les options & fichiers TTS chargés depuis `pbx_ivr_options`/`pbx_ivr_audio` ne se synchronisent pas, pas de upload audio du PBX |
| Ring Groups | 0 lignes | Jamais synchronisé depuis FusionPBX; dialog texte brut sans picker visuel |
| Call Forwarding | 0 lignes (table par-utilisateur) | Page admin ne lit que la table locale; rien n'est tiré du dialplan FusionPBX |
| Queue Agents | 9 dans `pbx_queue_agents` (sans `organization_id`) | Sous-onglet "Agents" de Queues n'expose ni picker d'extensions ni write-back vers FusionPBX |

## Phase 1 — IVR Menus complets (audio + options + sync)

- Lancer `sync-ivrs` + `sync-ivr-options` automatiquement si la table sélectionnée est vide (déjà côté proxy, à brancher dans `LemtelIVR.tsx`).
- Ajouter une action proxy `download-ivr-audio` qui télécharge le `greet_long`/`greet_short` du PBX (`v_ivr_menus.ivr_menu_greet_long`) vers le bucket `lemtel-ivr-audio` et upsert dans `pbx_ivr_audio` (organization, ivr_id, type, storage_path, url, durée).
- Panneau IVR détaillé:
  - Sous-onglet **Audio** : liste les fichiers existants (greet long/short + custom), bouton Play (signed URL), Upload nouveau .wav/.mp3 → enregistre via `upload-ivr-audio`, puis push au PBX via `update-ivr` (champ `ivr_menu_greet_long`).
  - Sous-onglet **Options** : table digit/destination/description, déjà câblée via `create-ivr-option`/`update-ivr-option` — ajouter delete et un picker visuel pour `destination` (extension, queue, ring-group, voicemail, hangup, autre IVR).
  - Sous-onglet **TTS** : génère un audio via ElevenLabs et le pousse au PBX en un clic (déjà partiel, à finaliser).
- Bouton "Resync IVR from PBX" qui appelle `sync-ivrs` + `sync-ivr-options` + `sync-ivr-audio` séquentiellement.

## Phase 2 — Ring Groups réellement connectés

- Resync auto au premier rendu si `pbx_ring_groups` vide (mêmes patterns que Phase 1 sur Extensions).
- Dans le `RingGroupDialog`:
  - Remplacer le `Textarea` de destinations par un **multi-select avec recherche** alimenté par `usePbxExtensions()`: badges sélectionnés, avec icône statut SIP, possibilité d'ajouter aussi un **ring group**, un **queue**, ou un numéro externe libre.
  - Ajouter Drag-handle pour réordonner (l'ordre = ordre d'appel en stratégie "sequence").
  - Champ **timeout par destination** (suffixe `@30`), supporté par FusionPBX.
  - Onglet "Avancé": Caller ID prefix, distinctive ring, music on hold (dropdown des MOH du PBX), follow-me, missed call alert email.
  - Aperçu visuel du flux (extension principale → membres → fallback) en haut du dialog.
- Bouton "Test Ring Group" qui appelle le numéro pilote via le proxy (`originate` vers `extension`).
- Realtime déjà branché — ajouter toasts différentiels.

## Phase 3 — Call Forwarding lue depuis le PBX

- Nouvelle action proxy `sync-call-forwarding` qui parcourt `v_extensions` (champs `forward_all_*`, `forward_busy_*`, `forward_no_answer_*`, `do_not_disturb`, `follow_me_*`) et upsert dans une nouvelle table `pbx_extension_forwarding` (org, extension_id, always/busy/no_answer/dnd/follow_me) — distincte de la table per-portal-user existante.
- Refondre `AdminCallForwarding.tsx`:
  - Onglet "Extensions PBX" : liste toutes les extensions Lemtel, montre les règles actuelles, dialog d'édition qui écrit via `update-extension` (nouveaux params `forward_all_destination`, etc.) puis re-sync.
  - Onglet "Utilisateurs portail" : la table actuelle `pbx_call_forwarding` (DND, no-answer, allow_from).
  - Bouton "New Rule" qui ouvre un wizard : extension cible → condition (always/busy/no-answer/dnd) → destination (picker extension/RG/queue/numéro).
- Affichage clair de la source de vérité (PBX vs portail) avec badge.

## Phase 4 — Queue Agents full management

- Migration: ajouter `organization_id uuid` à `pbx_queue_agents` + index, le populer via `queue_id` → `pbx_call_queues.organization_id`. Étendre RLS Lemtel.
- Compléter `sync-queue-agents` pour qu'il remplisse `organization_id`, `extension_id` (lookup par numéro), `tier_level`, `tier_position`, `wrap_up_time`, `agent_name`, `status`.
- Sous-onglet "Agents & Supervisors" du `LemtelQueues.tsx`:
  - Liste agents actuels avec extension, tier, statut (Available/On break/On call), wrap-up timer.
  - Bouton "Add Agent" → dialog avec picker d'extensions disponibles (filtre les déjà-membres), tier, position, wrap-up.
  - Inline edit tier/position + drag pour réordonner; bouton remove.
  - Toggle pause/unpause par agent (déjà supporté par `toggle_queue_pause` RPC, ajouter UI).
  - Section "Supervisors" séparée (agent role `supervisor`) avec mêmes actions.
- Toutes les écritures passent par `create-queue-agent`/`update-queue-agent`/`delete-queue-agent` du proxy puis re-sync queue + agents pour réafficher la vérité PBX.
- Onglet "Live" : table temps réel (`pbx_queue_agent_state` + Realtime déjà actif) montrant statut/calls handled/avg-wrap, plus boutons "Force logout" et "Listen-in" (proxy `monitor-call`).

## Détails techniques (refs)

- Front: 4 fichiers principalement (`LemtelIVR.tsx`, `TelephonyRingGroups.tsx`, `AdminCallForwarding.tsx`, `LemtelQueues.tsx`) + 2 hooks (`usePbxIvrAudio`, `usePbxQueueAgents`).
- Backend: 5 nouvelles actions dans `fusionpbx-proxy`: `download-ivr-audio`, `upload-ivr-audio`, `sync-call-forwarding`, `delete-queue-agent`, `originate-test`.
- Migrations: 1 colonne (`organization_id` sur `pbx_queue_agents`), 1 nouvelle table (`pbx_extension_forwarding`), GRANTs + policies Lemtel.
- Realtime: ajouter `pbx_ivr_audio` et `pbx_extension_forwarding` à la publication.
- Aucune modif aux pages d'agents vocaux IA, ni au design system, ni au landing.

## Hors scope
- Refonte visuelle, agents vocaux IA, traduction de tout le portail.
- Édition du SIP/RTP, des passwords PBX, ou de la config FreeSWITCH bas-niveau.

## Ordre de livraison proposé
Phase 1 (IVR) → 2 (Ring Groups) → 4 (Queue Agents) → 3 (Call Forwarding).
Raison : 1+2+4 utilisent des patterns proches (sync → table → dialog avec picker → write-back via proxy). Phase 3 nécessite la nouvelle table + colonnes PBX, plus longue, livrée en dernier.

Confirme l'ordre (ou demande un ordre différent) et je commence Phase 1.
