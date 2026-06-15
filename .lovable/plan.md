
## What's actually happening

I verified the database directly:

- **21 Lemtel extensions exist** in `pbx_extensions` for org `71755d33…2029eb7`.
- The `sync-extensions` job has run 3 times in the last 2h — all `completed`, fetched 19 / upserted 19.
- In parallel, the cron is firing `sync-cdrs` every ~3 seconds and every single one fails with:
  `there is no unique or exclusion constraint matching the ON CONFLICT specification`.
  → 371 failed CDR job rows in 2h, completely burying extension/IVR/queue jobs in the diagnostics list.

So two things are broken:

1. The UI banner only looks at the **last 5 sync jobs**, and those 5 are always `sync-cdrs`. That's why it says *"No recent sync job found"*.
2. The empty extensions list itself is a **read-side RLS problem**: the SELECT policy on `pbx_extensions` requires either `is_super_admin(auth.uid())` or membership via `get_user_organization_ids` (which only checks `organization_members` + `org_members`). Lemtel operators logged in via the portal who aren't in those exact tables get an empty array even though the data is there — but they *can* still invoke the edge function (which uses the service role), which is exactly the contradiction you're seeing.

## Plan

### 1. Fix the CDR cron flood (root cause of banner noise)
- Add a unique index on `pbx_call_records(organization_id, pbx_uuid)` and on `(organization_id, pbx_dedup_key)` so the `sync-cdrs` upsert's `onConflict` actually matches.
- Until the index exists, change `sync-cdrs` in `fusionpbx-proxy` to fall back to insert-with-skip on conflict-name-missing instead of looping the same error.
- One-shot cleanup: delete the 300+ failed `sync-cdrs` job rows older than 1h so the diagnostics panel reflects real activity.

### 2. Make extensions readable for every Lemtel operator
- Extend the SELECT policy on `pbx_extensions`, `pbx_softphone_users`, `pbx_call_records`, `pbx_call_recordings`, `pbx_voicemails`, `pbx_call_queues`, `pbx_ring_groups`, `pbx_ivrs`, `pbx_devices`, `pbx_sync_jobs` to also allow `public.is_lemtel_admin(auth.uid())` and `public.is_lemtel_member(auth.uid())`. These helpers already exist and cover staff enrolled via `org_members` or via the global Lemtel org.
- No change to write policies — those stay scoped to org_admin / super_admin / lemtel_admin where they already are.

### 3. Make the empty-state banner honest
- In `LemtelExtensions.tsx`, change `usePbxSyncJobs(5)` → `usePbxSyncJobs(50)` and filter by `job_type ILIKE '%extensions%'` so the panel always finds the real last extension job.
- Show the actual job timestamp + fetched/upserted counts and a "View all jobs" link to Sync Health.
- If the SELECT returns rows but the banner condition was previously true, it disappears on its own.

### 4. Edits + desktop/mobile app access already wired — keep behavior, just refresh after write
- `ExtensionEditDialog` already calls `update-extension` and `set-app-access` through the proxy. Add a `queryClient.invalidateQueries(['pbx'])` + a follow-up `sync-extensions` after save so the row in the table reflects PBX truth within a couple seconds.
- Grant/revoke desktop & mobile access continues to seed `pbx_softphone_users` from the existing FusionPBX `v_extensions.password` (no password reset), so users keep their current PBX credentials on the desktop and mobile apps.

### Technical details
- Migration: add the two unique indexes on `pbx_call_records`, broaden 10 SELECT policies, leave write policies untouched.
- Edge function: in `sync-cdrs`, detect Postgres error code `42P10` ("no unique constraint") once and downgrade subsequent pages to plain `insert(..., { ignoreDuplicates: true })` for the remainder of that run; record the fallback in the job stats so we can see it.
- Frontend: only `src/pages/lemtel/LemtelExtensions.tsx` and `src/hooks/usePbxData.ts` change. No visual redesign, no AI-voice-agent changes.

### Out of scope
- Any UI redesign, AI-voice-agent edits, or password resets.
- Changing the FusionPBX schema — we only adjust how the portal reads/writes.

After this, the extensions page will list all 21 Lemtel extensions for any Lemtel admin/operator, the banner will only appear when truly empty and will show the real last `sync-extensions` job, and the CDR cron will stop spamming `pbx_sync_jobs` with conflict errors.
