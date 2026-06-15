## Phase 3 — Call Forwarding (admin) + Phase 4 — Queue Agents auto-sync

### Phase 3 — `src/pages/lemtel/admin/AdminCallForwarding.tsx`
- Resolve `user_id` → email / display_name / extension via batched lookups (`profiles` + `pbx_softphone_users`); show readable name + extension instead of `user_id.slice(0,8)`.
- Add search input filtering on name / email / extension.
- For each `*_to` field, add a small destination picker (Combobox-like Select) listing:
  - Voicemail of the user (`*97`)
  - Extensions (`pbx_extensions`)
  - Ring groups (`pbx_ring_groups`)
  - Queues (`pbx_call_queues`)
  - "Custom" → free-form input (current behaviour).
- After save, invoke `fusionpbx-proxy` `update-forwarding` with the full forwarding payload (already partly wired in `useCallForwarding`); wrap in try/catch and toast on PBX failure but keep local row saved.

### Phase 4 — `src/pages/lemtel/LemtelQueues.tsx` (QueueAgentsPanel)
- On mount, if `pbx_queue_agents` is empty for the selected queue, auto-invoke:
  1. `sync-queue-agents` (existing) — pulls agents into local table.
  2. `list-queue-tiers` (existing) — fetches tiers from FusionPBX and upserts rows mapped to current queue (`tier_level`, `tier_position`, `agent_id`, `extension_id` resolved from `pbx_extensions.extension`).
- Add explicit "Resync from PBX" button on the panel header.
- Show a banner "X tiers pulled from FusionPBX" after auto-sync.

### Files touched
- Edit `src/pages/lemtel/admin/AdminCallForwarding.tsx`
- Edit `src/pages/lemtel/LemtelQueues.tsx` (QueueAgentsPanel only)

### Out of scope
- No SQL migrations.
- No proxy edge function changes (all actions already exist).
- No refonte of the live stats panel.
