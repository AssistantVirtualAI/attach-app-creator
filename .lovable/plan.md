# AVA Desktop + Admin + AI Copilot — Phased Implementation Plan

Goal: turn the Electron desktop from a softphone wrapper into a full Command Center, normalize PBX data as the single source of truth, gate everything by role/platform, and connect a data-aware AI copilot to every page.

---

## Phase 0 — Foundations (1 sprint)

- **Source-of-truth registry**: one TS module `src/lib/pbx/sources.ts` mapping each entity (extensions, devices, DIDs, IVRs, ring groups, queues, recordings, registrations, EL agents) to its canonical source: Supabase table, FusionPBX endpoint, ElevenLabs, Telnyx, or live socket. Each query returns `{ data, source, syncedAt, status: 'live'|'synced'|'stale'|'unavailable' }`.
- **Badges + sync chips**: shared `<SourceBadge>`, `<SyncStatus>`, `<WriteScopeButton>` components (`Save in AVA` / `Push to PBX` / `Sync from PBX`).
- **Platform/role guard**: `usePlatformAccess()` hook reading `app_access_enabled`, `desktop_access_enabled`, `mobile_access_enabled` + role. Wrap router and sidebar with it.
- **Audit log**: `pbx_admin_actions` table (actor, org, domain, entity, before_json, after_json, source, confirmed_at, rollback_of). Helper `logAdminAction()`.

## Phase 1 — Desktop shell (Command Center layout)

- New Electron layout: **Sidebar (modules) / Main workspace / Right context panel (compact softphone + selected-call details + AI summary)**.
- Global **Command Palette** (cmd-k): search extension, DID, user, device, IVR, queue, EL agent.
- Sidebar items gated by role: Dashboard, Softphone, Contacts/Extensions, Calls, Voicemail, SMS, AI Insights, Admin PBX, Monitoring, Settings.
- Mobile (Capacitor): keep simplified shell — Softphone, Calls, Voicemail, Status, Settings. Admin hidden unless explicit flag.

## Phase 2 — Softphone reliability + permissions (P0)

- Harden `useSoftphone`: register/unregister, inbound/outbound, hold, mute, DTMF, blind+attended transfer, history, SIP/WSS diagnostic panel.
- Backend: `get-sip-credentials` edge function refuses to issue desktop creds when `desktop_access_enabled=false` (same for mobile).
- UI: clear "Desktop access disabled by admin" state instead of silent failure.

## Phase 3 — Personal workspace

- Pages: My Calls, My Voicemail, My Recordings (authorized only), My Transcriptions, Audio Settings, Presence/Status.
- Resolve current user's extension via `pbx_softphone_users.portal_user_id` → filter all queries by domain + extension.
- Fix recordings empty state (use Phase 0 source registry; show source/sync chip).

## Phase 4 — Admin PBX modules (P1)

For each: list, create, edit, delete, Simple/Advanced toggle, preview-diff before push, audit + rollback.

1. **Extensions** — backfill 19 real SIP extensions for resolved `domain_uuid`; split UI: PBX Users vs SIP Extensions vs App Users.
2. **Devices** — real PBX devices only; device↔extension link; last sync.
3. **DIDs / Inbound Routes (unified)** — single Phone Numbers page joining `phone_numbers` + `pbx_destinations` by DID; route to extension / IVR / ring group / EL agent.
4. **IVR** — menus, options, audio (upload or ElevenLabs TTS), publish-to-PBX with confirmation.
5. **Ring Groups** — members, strategy, timeout, activation.

## Phase 5 — Business Hours, Queues, Voice Agents (P2)

- Time conditions, holidays, routing preview.
- Call queues + agents + supervisors + wallboard (gated by PBX call-center module availability).
- Voice Agents page: ElevenLabs agents per client/domain, DIDs routed, conversations, transcripts, audio, prompt editor.

## Phase 6 — AI Dashboard with traceable widgets (P3)

Each widget has a header chip naming its source and last sync; "Not available" instead of silent zero.

| Widget | Source | AI layer |
|---|---|---|
| Live Registrations | FusionPBX live by `domain_uuid` | offline/anomaly detection |
| Active Calls | FusionPBX live / FreeSWITCH proxy | live summary |
| Recent / Missed Calls | `pbx_call_records` (CDR sync) | classification, sentiment, callback hints |
| Recordings | PBX recordings + RLS | transcription + summary |
| ElevenLabs Conversations | ElevenLabs API per agent | intent, next action |
| Queues | CC endpoints if module on | SLA, wait, agent perf |
| System Health | PBX status proxy | anomalies/alerts |

Add "Analysis coverage" KPI even when no AI runs yet.

## Phase 7 — AI Copilot (data-aware, page-aware, action-safe)

- Server: edge function `ai-copilot` using Lovable AI Gateway (`google/gemini-3-flash-preview`) with a tool registry — one tool per entity in Phase 0 registry (read tools always; write tools behind `needsApproval`).
- Every answer **must cite source** (table/endpoint + syncedAt). If unknown → "non disponible" + offer resync.
- Inherits caller's role + selected domain; write actions show before/after diff and require explicit confirm in UI.
- Logs prompt, proposed action, confirmation, result, rollback id in `pbx_admin_actions`.
- Available from right context panel on every authorized page.

## Phase 8 — Acceptance & QA

Automated + manual checks matching the user's acceptance grid:
- 19 extensions visible after sync (desktop + portal).
- PBX Users / SIP Extensions / App Users split correctly.
- Live registrations non-zero when PBX reports any.
- Phone Numbers and Inbound Routes counts reconcile.
- Edit flow: confirm → write PBX → audit row created → rollback works.
- Desktop-blocked user receives no SIP creds.
- AI Insights shows coverage metric.
- Copilot answers "montre-moi l'extension 300" with real row + source + confirmable action.

---

## Technical notes

- **No hard-coded `organization_id` / `domain_uuid`** — always from `OrganizationContext` + resolved domain.
- **Schema additions**: `pbx_admin_actions` (audit + rollback), extend `pbx_extensions` / `pbx_devices` with `last_synced_at`, `sync_status`, `pbx_source`.
- **Edge functions to add/extend**: `fusionpbx-proxy` (live registrations + live calls + push writes with diff), `elevenlabs-sync` (agents, conversations, audio), `sync-pbx-extensions` (backfill 19), `ai-copilot` (tool registry).
- **Frontend**: `src/lib/pbx/sources.ts`, `src/components/pbx/SourceBadge.tsx`, `src/components/pbx/WriteScopeButton.tsx`, `src/components/desktop/CommandCenterLayout.tsx`, `src/components/desktop/CommandPalette.tsx`, `src/components/ai/CopilotPanel.tsx`.
- **RLS**: extend recordings/extensions policies so a user reads rows where they are caller/callee or their extension matches resolved domain.
- **Mobile parity**: same guards, reduced sidebar.

## Suggested delivery order

Phase 0 → 1 → 2 → 3 → 4 (extensions, then DIDs, then IVR/RG) → 6 (dashboards become real) → 7 (copilot) → 5 → 8.

Tell me to proceed and I'll start with Phase 0 + Phase 1 in the first build.
