## Why you can't manage queues today

`LemtelQueues.tsx` already has every feature you asked for — create/edit/delete queues, add/remove agents and supervisors, CSV import/export, live stats, resync from PBX. The reason none of the buttons work for you is the permission gate:

```
src/pages/lemtel/LemtelQueues.tsx → usePerms() → useCallCenterRole()
```

`useCallCenterRole` only returns `isAdmin=true` when the logged-in user has a `pbx_softphone_users` row with `cc_role = 'admin'`. Lemtel super_admins / org_admins / `is_lemtel_admin` users usually have **no softphone row** (or `cc_role='none'`), so the page renders read-only ("Only call-center admins can create or edit queues…") and the Create / Edit / Delete / Add buttons disappear.

## What to change

### 1. Fix the permission resolver (the actual bug)
- Update `useCallCenterRole` (or wrap it in a new `useQueuePerms`) so `canManage` is also true when the user is:
  - `is_super_admin(auth.uid())`, or
  - `is_lemtel_admin(auth.uid())`, or
  - `has_role(auth.uid(), LEMTEL_ORG, 'org_admin')`.
- Keep `cc_role='supervisor'` → `canAssign=true`, `cc_role='admin'` → `canManage=true`.
- Source: a single `supabase.rpc` call (`is_super_admin` / `is_lemtel_admin` already exist) plus the existing `pbx_softphone_users` lookup, merged into one return value.

### 2. Make supervisor & admin promotion a first-class action
On the Agents & Supervisors tab, add a small "Role" dropdown next to each member (Agent / Supervisor / Call-center admin) that:
- For the tier (1=supervisor, 2=agent): calls `update-queue-tier` on FusionPBX and updates `pbx_queue_agents.tier_level`.
- For the call-center role on the softphone user: writes `pbx_softphone_users.cc_role` (`agent` | `supervisor` | `admin`) — that's how the call-center wallboard / monitoring already gates access.
- Show current `cc_role` as a badge next to each agent name.

### 3. Surface "how the call is routed" on the queue editor
The fields exist on `pbx_call_queues` but the dialog only edits 8 of them. Extend `QueueDialog` with the routing controls FusionPBX exposes:
- Tier rules: `tier_rules_apply`, `tier_rule_wait_second`, `tier_rule_wait_multiply_level`, `tier_rule_no_agent_no_wait`.
- Discard / abandoned: `discard_abandoned_after`, `abandoned_resume_allowed`.
- Timeouts & overflow: `max_wait_time_with_no_agent`, `max_wait_time_with_no_agent_time_reached`, `timeout_action` (hangup / transfer-to-extension / voicemail) with a target input.
- Announcements: `announce_sound`, `announce_frequency`.
- Caller ID prefix, wrap-up time, agent-no-answer-delay-time.
- Music on hold: replace the free-text field with a Select fed by `pbx_hold_music` for LEMTEL_ORG.

All push through the existing `create-queue` / `update-queue` actions on `fusionpbx-proxy` (already supported via `writeCollection("call_center_queues", …)`).

### 4. Inline agent state controls (supervisor power tools)
On each agent row, add:
- Pause / Unpause (call existing `toggle_queue_pause` RPC; FusionPBX-side use `update-queue-agent` with `agent_status`).
- Log in / Log out (FusionPBX `agent_status` = Available / Logged Out via `update-queue-agent`).
- "Listen / Whisper / Barge" buttons for supervisors when there's a live call on that agent (uses the existing `cc_monitor_sessions` table + the call-center monitoring already wired in).

### 5. UX polish on the list
- Always show the Actions column, but render a Lock icon with tooltip "Read-only: contact a Lemtel admin" when `!canManage`, instead of hiding the buttons (avoids the silent "nothing happens").
- Show a tiny "you are: super_admin / lemtel_admin / org_admin / supervisor / agent" chip in the header so it's obvious which permission tier is active.

## Technical notes

- All FusionPBX writes already go through `supabase/functions/fusionpbx-proxy` actions: `create-queue`, `update-queue`, `delete-queue`, `add-queue-tier`, `update-queue-tier`, `remove-queue-tier`, `update-queue-agent`. No new edge-function actions needed — only the dialog needs to pass the extra `params.*` fields.
- Permission check on the server side is already enforced by RLS on `pbx_call_queues` / `pbx_queue_agents` for org_admin + super_admin, so the client-side fix in step 1 just aligns the UI with what the DB already allows.
- No schema migration required. Optional: a `useQueuePerms` hook in `src/hooks/` to keep the new logic out of the page.

## Out of scope

- Per-customer queue management inside the impersonated customer view (separate from the Lemtel-domain queues page).
- Building a separate "Call Center Admin" RBAC surface — we reuse the existing `cc_role` column.
- Wallboard / historical reporting redesign.
