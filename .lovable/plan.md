
# Plan — Portail ↔ FusionPBX 100% éditable, sync bi-directionnelle temps réel

## Objectif
Tout objet FusionPBX (extensions, devices, DIDs, IVR, queues, ring groups, time conditions, voicemail, recordings, CDR, dialplan AI) modifiable depuis le portail. Chaque écriture portail = appel API FusionPBX immédiat. FusionPBX renvoie en temps réel (webhooks + polling court) vers Supabase. Les agents AI clients peuvent être branchés simultanément par DID dédié, extension SIP, option IVR ou overflow de queue.

## État actuel (audit)

**Edge functions existantes** (`supabase/functions/fusionpbx-proxy/index.ts`, 821 lignes) couvrent déjà :
- ping, create/delete-domain, get-registrations
- get/create/update/delete extension, device
- create/update/delete ivr, queue, ring-group, destination
- list/add/remove queue-tier, queue-agent
- list-cdrs / sync-cdrs, sync-all, get-recording, test-cdr-endpoint

**Manquant côté proxy** : list-extensions/devices/ivr/queues/ring-groups/dids, voicemail (list/listen/delete/greeting), recordings list/delete, time-conditions, feature-codes, dialplan (lecture/écriture), gateways, SIP profiles status, hot-desk, callflows, conference, fax, hold-music, sounds upload.

**UI portail** (`src/pages/lemtel/*`) : pages liste pour Customers, DIDs, Devices, Extensions, IVR, Queues, SoftphoneUsers, VoiceAgents, Messages, BusinessHours. Aucune édition complète — surtout lecture + actions ciblées.

**Tables Supabase** : `pbx_extensions, pbx_devices, pbx_ivrs, pbx_ivr_options, pbx_call_queues, pbx_queue_agents, pbx_ring_groups, pbx_call_records, pbx_call_recordings, pbx_voicemails, pbx_voicemail_settings, pbx_call_forwarding, pbx_call_recording_rules, pbx_call_transcripts, pbx_feature_codes, pbx_phone_number_assignments, pbx_sync_jobs, pbx_softphone_users`. Manquants : `pbx_domains, pbx_time_conditions, pbx_dialplans, pbx_destinations, pbx_gateways, pbx_sip_profiles, pbx_conferences, pbx_hold_music, pbx_voice_agent_bindings`.

## Architecture cible

```text
Portail UI  ──write──▶  Edge fn `pbx-write` ──FusionPBX REST──▶  FusionPBX
    ▲                                                                │
    │                                                                ▼
Supabase Realtime ◀── `pbx-webhook` (events FreeSWITCH/FusionPBX) ◀──┘
    ▲
    └── poll court (5s registrations, 10s active calls) `pbx-poll`
```

Règles :
- Toute mutation portail passe par une edge function, jamais Supabase direct sur les tables `pbx_*` (sauf champs UX locaux non SIP). L'edge function : (1) écrit FusionPBX, (2) upsert Supabase miroir, (3) émet `pg_notify` realtime.
- FusionPBX → portail via webhook FreeSWITCH (`mod_event_socket` ou `xml_curl` hook) frappant `pbx-webhook` qui upsert et émet realtime.
- Conflit : last-write-wins avec `updated_at` + champ `pbx_etag`. Edge fn refuse l'écriture si etag dépassé et renvoie diff.

## Modules & mapping endpoints FusionPBX

Chaque module = page d'édition complète + edge action create/update/delete + miroir Supabase + binding webhook.

| Module | Page portail | Edge actions | Endpoint FusionPBX | Table miroir |
|---|---|---|---|---|
| Tenants/Domains | `/admin/pbx/domains` | list/create/update/delete-domain | `/app/domains/domain_edit.php` + API `domains` | `pbx_domains` (nouvelle) |
| Extensions SIP | `LemtelExtensions` (édition complète) | list/get/create/update/delete-extension, set-voicemail, set-call-forward, set-do-not-disturb, set-follow-me, set-call-screen, set-recording, regenerate-password | `/app/extensions/*` + `xml_handler` | `pbx_extensions` |
| Devices/Provisioning | `LemtelDevices` | list/create/update/delete-device, assign-line, generate-config, reboot | `/app/devices/*`, `device_provision` | `pbx_devices` |
| DIDs/Numbers | `LemtelDIDs` | list/create/update/delete-did, set-destination, set-cnam, set-failover | `/app/destinations/*` (inbound) | `pbx_phone_number_assignments` |
| IVR / Auto-att | `LemtelIVR` (builder visuel) | list/create/update/delete-ivr, add/update/delete-option, upload-greeting | `/app/ivr_menus/*`, `recordings` | `pbx_ivrs`, `pbx_ivr_options` |
| Call Queues | `LemtelQueues` | list/create/update/delete-queue, add/remove-tier, add/remove-agent, set-strategy, set-moh | `/app/call_centers/*` | `pbx_call_queues`, `pbx_queue_agents` |
| Ring Groups | nouvelle page | list/create/update/delete-ring-group, add/remove-destination | `/app/ring_groups/*` | `pbx_ring_groups` |
| Time Conditions | nouvelle page | list/create/update/delete-time-condition, add/remove-rule | `/app/time_conditions/*` | `pbx_time_conditions` (nouvelle) |
| Dialplan / Destinations | nouvelle page avancée | list/create/update/delete-dialplan, reorder | `/app/dialplans/*` | `pbx_dialplans` (nouvelle) |
| Feature codes | `LemtelSettings → Codes` | list/update-feature-code | `/app/dialplans/dialplan_edit.php?context=*+*+*` | `pbx_feature_codes` |
| Recordings | nouvelle page (existing `RecordingsList` desktop) | list/get/delete-recording | `/app/call_recordings/*` ; `/recordings/` filesystem | `pbx_call_recordings` |
| Voicemails | existante + édition greetings | list/get/delete-voicemail, upload-greeting (unavail/name/busy/temp), set-pin, set-email-notify | `/app/voicemails/*` | `pbx_voicemails`, `pbx_voicemail_settings` |
| CDR | `LemtelPortalCalls` | list/get-cdr, get-recording, set-notes/tags | `cdr.json` ou DB FusionPBX | `pbx_call_records` |
| Conférences | nouvelle | list/create/update/delete-conference | `/app/conference_*` | `pbx_conferences` (nouvelle) |
| Hold music | nouvelle | list/upload/delete-moh | `/app/music_on_hold/*` | `pbx_hold_music` (nouvelle) |
| Sounds/Recordings library | nouvelle | list/upload/delete-sound | `/app/recordings/*` | partage bucket `lemtel-ivr-audio` |
| Gateways / Trunks | `/admin/pbx/gateways` | list/create/update/delete-gateway, restart | `/app/gateways/*` | `pbx_gateways` (nouvelle) |
| SIP profiles | `/admin/pbx/sip-profiles` | get/restart-profile, set-codecs, set-NAT | `mod_sofia` API | `pbx_sip_profiles` (nouvelle) |
| Registrations live | widget temps réel | get-registrations (poll 5s) | `sofia status profile X reg` | `telecom_live_calls` étendu |
| Active calls live | widget temps réel | get-active-calls (poll 5s) | `show calls` | `telecom_live_calls` |

## Clients & utilisateurs (multi-tenant)

- Page `ClientDetail` étendue avec onglets **Téléphonie** :
  - Extensions assignées (créer/éditer/supprimer = appelle edge `pbx-write` + crée `pbx_softphone_users` lié au `client_member`).
  - DIDs assignés.
  - Voicemail box partagée.
  - Voice agents AI (voir ci-dessous).
- Rôles client :
  - `client_admin` : CRUD extensions/devices/IVR/queues/agents du client.
  - `client_member` : édition de sa propre extension, voicemail, forward, DND.
- Une migration ajoute `pbx_object_owner (object_type, object_pbx_uuid, client_id, organization_id)` pour scoper les RLS et la visibilité.

## Agents vocaux AI sous client — binding multiple

Nouvelle table `voice_agent_bindings` :
```text
id, voice_agent_id (→ agents), client_id, organization_id,
binding_type ENUM('did','extension','ivr_option','queue_overflow'),
target_ref (DID e164 | extension number | ivr_uuid+digit | queue_uuid),
priority int, active bool, after_hours_only bool, business_hours_id
```
Un même agent AI peut avoir N bindings actifs en parallèle. Page `ClientDetail → Voice Agents` :
1. Sélection du moteur (ElevenLabs/Retell/Vapi/Lovable AI).
2. Pour chaque binding, dropdown sur DID disponible / extension libre / option IVR existante / queue.
3. Edge `pbx-bind-voice-agent` génère le dialplan FusionPBX correspondant (TwiML/`bridge sofia/external/sip:agent@...` ou redirection vers webhook agent) et crée l'entrée FusionPBX (extension AI, destination DID, IVR option, queue failover dialplan).
4. Mises à jour propagées via le même flux pbx-write.

## Sync temps réel

1. **Webhooks entrants** : nouvelle edge `pbx-webhook` (URL configurée côté FreeSWITCH via `xml_curl` + `mod_event_socket` bridge) reçoit events : `CHANNEL_CREATE/ANSWER/HANGUP`, `REGISTER`, `UNREGISTER`, `VOICEMAIL_LEAVE`, `RECORD_STOP`, `CONFIG_RELOAD`. Upsert Supabase + `pg_notify`.
2. **Poll court** : edge `pbx-poll` (cron 5s pour registrations & active calls, 60s pour CDR diff, 5min pour config drift).
3. **Drift detector** : edge `pbx-reconcile` (cron 15min) compare hash config FusionPBX vs Supabase, signale dans `pbx_sync_jobs` avec status `drift`.
4. **Realtime client** : abonnement `supabase.channel('pbx:*')` sur tables miroir, l'UI rafraîchit sans reload.

## RLS & sécurité

- Toutes les tables `pbx_*` : RLS via `can_view_org` + `can_manage_org_members` ; `client_admin` autorisé via nouvelle fn `can_manage_pbx_for_client(_user_id, _client_id)`.
- Frontend lit uniquement les vues `_safe` (pas de mot de passe SIP, ni clés API gateway).
- Mots de passe SIP : chiffrés avec `PBX_ENCRYPTION_KEY`, jamais renvoyés ; rotation via action dédiée.
- Toute edge action audite dans `audit_logs` + `telecom_audit_logs`.

## Migrations à créer

1. Nouvelles tables : `pbx_domains, pbx_time_conditions, pbx_dialplans, pbx_destinations, pbx_gateways, pbx_sip_profiles, pbx_conferences, pbx_hold_music, pbx_object_owner, voice_agent_bindings`. Pour chacune : GRANT authenticated/service_role, RLS, policies via helpers existants.
2. Vues `_safe` pour chacune.
3. Fonctions SECURITY DEFINER : `can_manage_pbx_for_client`, `assign_pbx_object_to_client`, `pbx_bind_voice_agent`.
4. Realtime : `ALTER PUBLICATION supabase_realtime ADD TABLE ...` pour chaque nouvelle table + tables existantes non encore publiées.

## Edge functions à créer / étendre

- **Étendre** `fusionpbx-proxy` : ajouter list-* manquants, time-conditions, dialplan CRUD, feature-codes, voicemail full, gateways, sip-profiles, conferences, hold-music, sounds.
- **Nouveau** `pbx-write` : router unifié auth/RBAC + appel proxy + miroir Supabase + audit + emit realtime.
- **Nouveau** `pbx-webhook` : ingestion events FreeSWITCH.
- **Nouveau** `pbx-poll` : cron registrations/active calls/CDR diff.
- **Nouveau** `pbx-reconcile` : drift detector.
- **Nouveau** `pbx-bind-voice-agent` : génère dialplan FusionPBX pour binding agent AI.
- Test edge functions via `supabase--test_edge_functions`.

## UI portail à construire

- Layout admin PBX commun (sidebar modules ci-dessus) sous `/admin/pbx/*`.
- Chaque module : table list + drawer édition + dialog création + actions bulk + indicateur sync (badge "synced" vs "drift").
- `ClientDetail` : nouvel onglet **Téléphonie** avec sous-onglets Extensions / DIDs / Voicemail / Voice Agents.
- Composant réutilisable `<PbxSyncBadge objectType uuid />` qui affiche état dernier sync, dernier event reçu.
- Builder visuel IVR (drag & drop options) déjà ébauché — compléter avec upload greetings + lien time conditions.

## Ordre d'implémentation (phases)

1. **Phase 1 — Foundation** : migrations nouvelles tables + RLS + vues safe + `pbx-write` router + audit. Étendre proxy avec list-* manquants.
2. **Phase 2 — Édition extensions/devices/voicemail full** + onglet Téléphonie dans ClientDetail. Webhook REGISTER/UNREGISTER + poll registrations.
3. **Phase 3 — DIDs, IVR builder complet, time conditions, ring groups, queues full** + webhook CHANNEL_*.
4. **Phase 4 — Recordings/CDR/voicemail audio + transcripts** (lecture inline via signed URLs storage).
5. **Phase 5 — Voice agent bindings multi-cibles** (DID + extension SIP AI + option IVR + queue overflow) + dialplan generator.
6. **Phase 6 — Gateways, SIP profiles, conferences, hold music, sounds, dialplan brut** (mode avancé super_admin).
7. **Phase 7 — Reconcile drift detector + dashboard sync santé**.

## Vérifications de fin

- `supabase--linter` : 0 warning RLS sur nouvelles tables.
- `supabase--test_edge_functions` : tests par module (mock FusionPBX).
- Smoke E2E : créer extension portail → vérifier registration possible → passer un appel → CDR + recording remontent en <30s sans refresh.
- Test binding agent AI : DID + extension + IVR option simultanés appelés → tous routent vers l'agent.

## Notes
- FusionPBX REST n'est pas uniforme : certains endpoints exigent `xml_handler` ou écriture directe DB FusionPBX via `fusionpbx-proxy.writeCollection` (déjà en place). On garde cette stratégie et on documente par module quelle voie est utilisée.
- `electron-builder.yml`, `vite.config.ts`, workflows GitHub : non touchés (constraint mémoire).
- Landing : non touchée.
