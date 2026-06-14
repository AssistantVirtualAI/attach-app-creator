## Root cause

1. **"SIP Not Configured / Failed to load SIP credentials"**
   Edge function logs show:
   ```
   lookup by portal_user_id error: column pbx_softphone_users.sip_password_encrypted does not exist
   ```
   `supabase/functions/softphone-credentials/index.ts` selects `sip_password_encrypted`, but that column was never created in the DB. The whole SELECT fails → no row → `NO_SOFTPHONE_ACCOUNT` → desktop shows "Failed to load SIP credentials".
   Extension 300 actually has a valid `sip_password` (14 chars) on file.

2. **"Audio file not reachable on PBX"**
   `fusionpbx-proxy get-recording` already tries ~15 URL patterns on portal + pbxnode hosts. For the two CDRs shown the recording file genuinely isn't published to FusionPBX storage yet (typical post-call delay or recording disabled at queue). Not a code bug — but the UX message + retry can be improved.

3. **Data not separated by extension**
   The connected user (`mhassoun@…`) is **`super_admin` on the org** in `user_roles`, so RLS lets them see every CDR. Desktop `avaApi.recordings()` does add the extension-scope filter on the REST URL, so once it runs with `me.extension = "300"` the list should be filtered to ext 300 only. The visible mixed list means either:
   - the running desktop binary predates the scoping commit, or
   - `getMeContext()` returned empty (no portal_user_id row for that JWT at call time) and the call fell back / cached an empty scope.

## Fix

### A. Edge function — remove dead column reference
`supabase/functions/softphone-credentials/index.ts`
- Drop `sip_password_encrypted` from the SELECT list.
- Drop the `decryptSecret((sp as any).sip_password_encrypted)` branch; keep `decryptSecret(sp.sip_password)` (handles legacy `aesgcm:` values) and the plain-string path.
- In the fallback that persists the password back to the DB, write only to `sip_password` (no `sip_password_encrypted`).
- Redeploy `softphone-credentials`.

### B. Desktop scope hardening (defensive)
`apps/ava-softphone-desktop/src/lib/avaApi.ts`
- In `getMeContext()`, if the JWT has `sub` but no softphone row is returned, do NOT cache `EMPTY_ME` — return it without caching so the next call retries. This prevents an early-mount empty result from sticking for the session.
- In `scopedCdrFilter()` / `scopedThreadFilter()`, when there is no extension, return a filter that yields **zero rows** (already done) — keep that, plus log a `console.warn` so we can see it in the field.
- Bump the bundled desktop build version so a fresh installer picks up the scoping commit (`apps/ava-softphone-desktop/package.json` patch bump).

### C. Recording UX (small)
`apps/ava-softphone-desktop/src/components/RecordingsList.tsx`
- When `get-recording-signed-url` returns `RECORDING_NOT_FOUND`, show: *"Recording not yet available on PBX — retry in a few minutes."* with a Retry button, instead of the red "Audio file not reachable on PBX" error styling. No backend change.

## Out of scope (will mention to user)
- The audio-not-reachable issue for the two specific CDRs (12 June 16:12 and 09:36) is a FusionPBX storage delay / missing file on the PBX, not something the app can synthesize. If it persists more than a few hours, the PBX recording dialplan needs to be checked.
- Once Fix A is deployed and the desktop app is restarted/reinstalled, SIP registration for ext 300 will succeed and the recordings list will scope correctly to ext 300.
