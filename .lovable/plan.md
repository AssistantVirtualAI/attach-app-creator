
# Plan — Desktop PBX Stabilization & UX Audit

Six phases. Each phase is independently shippable and ends with verification.

---

## Phase 1 — Theme contrast & gray audit (Dark + Light)

**Goal:** Eliminate unreadable gray text/fields across all desktop pages, in both dark and light modes. Replace flat gray with semantic tokens that hold contrast.

- Extend `apps/ava-softphone-desktop/src/lib/theme.ts`:
  - Replace `mutedSilver` usage on critical text with new tokens: `textPrimary`, `textSecondary`, `textTertiary`, `placeholder`.
  - Add `inputBg`, `inputBorder`, `inputText`, `inputPlaceholder` — guaranteed AA contrast in both themes.
  - Dark: replace muted #777-ish grays with a cooler ice tone (e.g. `#A8B4D0` for secondary, `#E6EDFB` for primary).
  - Light: replace pale grays with deeper slate (e.g. `#1B2540` primary, `#475677` secondary).
- Sweep every page/component in `apps/ava-softphone-desktop/src/components/**` and `src/components/console/**`:
  - Calls & Recordings list, right CDR pane, Recordings detail (transcript, summary, tags), Voicemails, Messages, Customers table, Sync & Diag, Ring Group / Call Queue / IVR / Extension modals, dialer composed-number display.
  - Replace hardcoded `#fff`, `#000`, `#0a1430`, `c.textIce` placeholders, and `c.mutedSilver` on body text with the new tokens.
- Verify with screenshots in dark + light, including the four screens the user attached.

---

## Phase 2 — CDR realtime + right-pane "Pick a call" UX

**Goal:** New calls appear immediately; right pane only renders when a row is selected; AI analysis runs reliably or the pane is hidden.

- Realtime CDRs:
  - Subscribe to `pbx_call_records` postgres_changes in `useCdrs` (or equivalent desktop hook), filtered by current org + extension.
  - On INSERT, prepend to the list and bump TOTAL CDRS / RECORDED / MISSED counters.
  - Trigger `realtime-sync { kind: 'cdr' }` immediately after a hangup event (mobile/desktop softphone hook).
- Right pane behavior:
  - Hide the entire right column when `selectedCallId == null` (no empty "Pick a call" card when there is nothing meaningful — only show empty state when user has the pane open intentionally; otherwise collapse).
  - Make every row click set `selectedCallId` and load: recording (signed URL), transcript, AVA summary, topics, tags.
  - Loading skeleton → content → empty state with explicit "No AI analysis available" message instead of stuck spinner.
- AI analysis reliability:
  - In `analyze-recording` (or equivalent) edge function, fix the non-2xx by: validating recording URL presence, returning structured `{ ok: false, reason }` instead of throwing, and switching to background processing (`EdgeRuntime.waitUntil`) for >10s jobs.
  - Client polls `pbx_call_recordings.analysis_status` and renders accordingly.
  - If `analysis_status = 'unavailable'`, hide right-pane AI sections (Quality, Summary, Topics, Tags) and only show transcript + playback.

---

## Phase 3 — Recordings page Edge Function fix + Retry UX

**Goal:** Eliminate "Edge Function returned a non-2xx status code" on Recordings; ensure Retry works and is informative.

- Debug `analyze-recording` / `transcribe-recording` via `supabase--edge_function_logs`.
- Add input validation, friendly error envelope, and surface the real reason in the red banner (instead of a generic message).
- Wire Retry button to re-invoke the function with the same recording id and refresh the row on success.

---

## Phase 4 — Customers (Domains) CRUD

**Goal:** From the Admin → Customers page, add/edit/delete FusionPBX domains (tenants).

- Add `+ New customer` button (admin-gated) that opens a modal: domain, friendly name, link to org (optional), enabled toggle.
- Row actions: Edit (same modal pre-filled), Disable/Enable, Delete (with confirmation).
- All writes go through `pbx-write` with `objectType: 'domain'` + audit log. Mirror to `pbx_domains`.
- After success, reload via the existing `ava:pbx-resource-saved` event and toast.

---

## Phase 5 — Voicemail admin scope + Sync & Diag visibility

**Goal:** Remove direct voicemail inbox access for admins (keep call recordings); fix Sync & Diag empty state when a job is running/failed.

- Voicemails:
  - Hide the `Admin → Media → Voicemails` route entry from admins (keep `Call Recordings`).
  - If a voicemail was recorded (i.e. file exists in `pbx_voicemails`), expose it under the corresponding recording row so admins can listen there — not via a separate inbox.
- Sync & Diag:
  - Page currently shows "Running…" but renders no rows. Bind to `pbx_sync_jobs` realtime, group by `job_type`, and always render the last 5 jobs per type with status pill (running / success / failed) + `error` text + `Last success` timestamp computed from history.
  - Add per-job "View error" disclosure that shows the raw error from the function.

---

## Phase 6 — Ring Group schema parity + Call Queue agent/supervisor selection

**Goal:** Eliminate ring group schema mismatch banner; allow selecting agents/supervisors on call queues.

- Ring Group:
  - Update the proxy mapping in `fusionpbx-proxy` (ring-group read path) to return `ring_group_destinations` and `ring_group_moh_sound` (these are the FusionPBX field names — fix the rename done on portal side).
  - Or, if portal must keep the new names, map them in the edge function response.
- Call Queue agents/supervisors:
  - Implement multi-select pickers backed by `pbx_extensions` (or `pbx_queue_agents`) for the current domain.
  - Persist via `pbx-write` with `objectType: 'call_queue'` and a `members` payload that FusionPBX accepts (`call_center_agents` join).
  - Show currently assigned agents/supervisors on edit; allow add/remove with optimistic UI + reload.

---

## Cross-cutting

- All admin gating uses existing `is_lemtel_admin` / `org_admin` checks.
- Every mutation goes through `pbx-write` → audit log → mirror → `ava:pbx-resource-saved` dispatch → toast (sequence already enforced in `pbxCreateFlow.ts`; reuse it).
- After each phase: screenshot dark + light, run vitest suite, hit `supabase--edge_function_logs` for the touched functions.

---

## Suggested execution order

1. Phase 1 (theme) — unblocks visual verification of everything else.
2. Phase 6 (ring groups + queue agents) — blocking PBX edits today.
3. Phase 2 (CDR realtime + right pane).
4. Phase 3 (analyze-recording reliability).
5. Phase 5 (voicemail scope + sync diag).
6. Phase 4 (Customers CRUD).

Tell me to start with Phase 1, or reorder, and I'll execute one phase at a time.
