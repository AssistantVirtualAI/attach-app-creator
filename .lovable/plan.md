## Goal
Make Call Queues work reliably like a real call-center control system: sync agents from PBX, show existing queue members, add/remove users, assign supervisors, configure routing, music on hold, recording, and make the Edit experience visually clear on both portal and desktop app.

## Confirmed root cause
The sync fails because `fusionpbx-proxy` writes agent-registry fields to `pbx_queue_agents` (`organization_id`, `pbx_uuid`, `name`, `extension`, `contact`, `type`) but the real table only contains queue-tier fields (`queue_id`, `extension_id`, `agent_name`, `agent_id`, tier fields, status, raw_data). This causes:

```text
Could not find the 'contact' column of 'pbx_queue_agents' in the schema cache
```

It also means the app mixes two different concepts in one table:
- PBX agent registry: all possible call-center agents/extensions.
- Queue tier membership: which agents are assigned to a queue and supervisor/agent priority.

## Phase 1 — Stop the sync failure
- Add a safe database migration for `pbx_queue_agents` so the current PBX sync payload no longer crashes.
- Add missing columns used by the sync path: `organization_id`, `pbx_uuid`, `name`, `extension`, `contact`, `type`, timestamps as needed.
- Add unique constraints/indexes needed for `upsert`:
  - `organization_id, pbx_uuid` for PBX agent registry sync.
  - keep queue membership working by `queue_id`.
- Preserve existing queue-tier rows; no destructive data changes.
- Keep RLS secure so only Lemtel staff, super admins, or tenant admins/supervisors can see/manage queue agents.

## Phase 2 — Correct PBX sync behavior
- Update `fusionpbx-proxy` so `sync-queue-agents` maps PBX agent registry data without breaking queue-tier assignments.
- Make `sync-all` support `queue-agents` properly when requested from Call Queues.
- Ensure “Resync from PBX” runs in the correct order:
  1. sync queues
  2. sync agent registry
  3. fetch queue tiers
  4. upsert queue memberships
- Improve failure messages so the UI shows which step failed and the exact PBX/database reason.

## Phase 3 — Fix queue member visibility and management
- In `LemtelQueues.tsx`, load queue members from `pbx_queue_agents` and enrich them with matching extension/user information.
- Show existing supervisors and agents immediately when opening a queue.
- Add/remove queue members using PBX tier actions and update local state after success.
- Allow assigning supervisor vs agent using tier level:
  - Supervisor = priority/tier 1
  - Agent = normal queue member/tier 2+
- Add edit controls for tier level, tier position, wrap-up time, and status where PBX supports it.
- Prevent duplicate assignment of the same extension to the same queue.

## Phase 4 — Upgrade the Edit Queue modal visually and functionally
- Replace the basic edit dialog with a structured control-center modal using tabs/sections:
  - Overview: name, extension, enabled, description.
  - Routing: strategy, max wait, timeout/failover action, no-agent behavior, tier rules.
  - Agents: supervisors, agents, add/remove, reorder/priority.
  - Audio: music on hold dropdown from real `pbx_hold_music` rows, announcements.
  - Recording: queue-level recording toggle, template/mode, announcement, retention.
  - Live: waiting calls, available/on-call/paused agents, quick supervisor controls.
- Improve action buttons so they are visible and readable at small widths:
  - Replace tiny ghost-only icons with labeled buttons or dropdown action menu.
  - Add tooltips/labels for Edit, Agents, Delete, Sync.
  - Make table actions responsive instead of disappearing/cramping.

## Phase 5 — Music on hold dropdown
- Load `pbx_hold_music` for the active Lemtel/tenant org.
- Add a “Sync music on hold” fallback if the list is empty.
- Use a dropdown instead of free text for `queue_moh_sound`, while keeping a custom/manual value option for advanced PBX paths.

## Phase 6 — Recording rules for call queues
- Keep the existing per-user `pbx_call_recording_rules` table untouched for user-level rules.
- Add queue-level recording management through `pbx_call_queues.record_enabled` and PBX `queue_record_template`.
- If needed, add a new secure queue recording rules table for richer scope:
  - organization
  - queue
  - enabled
  - mode: all / inbound / outbound
  - announce
  - retention days
- Show recording status on each queue row and inside Edit.
- Allow enabling recording for all queues or only selected queues.

## Phase 7 — Desktop app parity
- Upgrade `apps/ava-softphone-desktop/src/components/console/QueuesView.tsx` and desktop admin queue editor to use the same real queue membership data.
- Let admins/supervisors add/remove users, assign supervisors, move agents between queues, and control live status from desktop.
- Make the desktop queue edit screen visually consistent with the portal control-center modal.

## Phase 8 — Validation
- Verify the reported sync error is gone.
- Test:
  - Resync from PBX.
  - Open Edit on a queue.
  - See current agents/supervisors.
  - Add an extension as agent.
  - Add an extension as supervisor.
  - Remove an agent.
  - Select music on hold.
  - Enable/disable queue recording.
  - Confirm desktop app shows the same queue membership.
- Check console/network errors and recent sync job logs after implementation.

## Technical notes
- Main files to change:
  - `src/pages/lemtel/LemtelQueues.tsx`
  - `apps/ava-softphone-desktop/src/components/console/QueuesView.tsx`
  - `apps/ava-softphone-desktop/src/components/console/AdminView.tsx`
  - `supabase/functions/fusionpbx-proxy/index.ts`
  - database migration for `pbx_queue_agents` and possibly queue recording rules
- No landing page changes.
- Keep all sensitive PBX operations behind Edge Functions.