# Mobile app `/m` — Pre-launch data sync + new bottom navigation

Two goals:
1. Make sure CDRs, recordings, voicemail, and contacts always show real, fresh data for the signed-in extension — so beta testers on App Store / Play Store don't see empty screens.
2. Add dedicated **Contacts**, **Voicemail**, and **Recordings** buttons to the bottom tab bar (instead of being buried in "More").

No changes to `vite.config.ts`, `electron-builder.yml`, or `.github/workflows/`.

---

## Part A — Auto-sync correctness (so `/m` is never empty)

### A1. Resolve extension → organization on sign-in
- On successful sign-in (`AuthScreen`), call a small `mobile-bootstrap` edge function that:
  - Looks up the user in `pbx_softphone_users` by `portal_user_id` (or `extension` for ext-login).
  - Returns `{ organization_id, extension, displayName, sipDomain }`.
  - Persists the resolved IDs into `creds` so every screen uses the same scope.
- Today some screens silently return `[]` when no softphone link is found — we'll surface a clear "Extension not linked" banner with a "Retry sync" button instead of an empty list.

### A2. Real-time CDRs for the signed-in extension
- `useRealtimeCDR` already subscribes to `pbx_call_records`, but the filter is too loose. Tighten it to `organization_id = <org>` AND (`extension = <ext>` OR `caller_number = <ext>` OR `destination_number = <ext>`).
- Verify `pbx_call_records` is in `supabase_realtime` publication; if not, add it via migration.
- On Realtime reconnect, re-fetch the last 50 rows via `mobile-recents` to fill any gap.

### A3. Recordings auto-sync
- `mobile-recordings` edge function already filters by org but not by extension. Add extension filter and order by `start_at desc`.
- Subscribe to Realtime updates on `pbx_call_records` where `has_recording = true` and update the recordings list live.
- On row click, fetch a signed URL via existing recording storage helper.

### A4. Voicemail auto-sync
- Hook `useMyVoicemail` (web) works via Realtime on `pbx_voicemails`. Port the same pattern into the mobile app as `useMobileVoicemail` that filters by `extension`.
- Trigger `voicemail-sync` edge function on app foreground + every 60s via existing `useAutoSync`.

### A5. Device contacts
- `syncDeviceContacts()` exists but is only called from `MobileApp` once. We'll:
  - Re-run on app foreground.
  - Merge device contacts with `org_contacts` (org directory) via a new `mobile-contacts` edge function.
  - Show empty-state with an "Allow contacts access" CTA when permission is denied (web preview shows a stub message).

### A6. Sync health indicator
- Small dot in the header (green / amber / red) showing last successful sync time per data source (CDR, voicemail, recordings, contacts). Tap → opens a Sync Status sheet with "Retry all".

### A7. Pre-launch verification checklist (added to `apps/ava-softphone-mobile/RELEASE.md`)
- Sign in as a test extension → CDRs appear within 3s.
- Place a test call → new row appears live without refresh.
- Recording finishes → appears in Recordings tab within 5s.
- Leave a voicemail → appears in Voicemail tab.
- Contacts permission granted → device contacts searchable in dialer + Contacts tab.

---

## Part B — New bottom tab bar

Replace the current 5-tab layout (`Home / Calls / AVA / Messages / More`) with a 6-button bar that keeps the centered AVA orb:

```text
[ Home ]  [ Calls ]  [ Recordings ]  ( AVA )  [ Voicemail ]  [ Contacts ]  [ More ]
```

Because 6 + AVA is too cramped on small screens, we go with this final layout:

```text
[ Calls ]  [ Recordings ]  [ Voicemail ]  ( AVA )  [ Contacts ]  [ Messages ]  [ More ]
```

- Home moves into the AVA tab's dashboard header (already shows domain stats).
- `BottomTabs.tsx` grid becomes `1fr 1fr 1fr 88px 1fr 1fr 1fr`.
- Tab IDs extended: `'calls' | 'recordings' | 'voicemail' | 'ava' | 'contacts' | 'messages' | 'more'`.
- `MobileApp` routes each tab to the existing screen (`RecordingsScreen`, `VoicemailScreen`, `ContactsScreen` are already implemented under `screens/`).
- "More" keeps Settings, Queues, Features, AI audit, Privacy, Support, Delete account, Sign out — items promoted to the bar are removed from More.
- On very narrow widths (<360px) labels hide and only icons show (already supported pattern).

---

## Technical notes

- Files touched:
  - `apps/ava-softphone-mobile/src/components/BottomTabs.tsx` — new layout + icons.
  - `apps/ava-softphone-mobile/src/MobileApp.tsx` — tab routing + bootstrap call.
  - `apps/ava-softphone-mobile/src/hooks/useRealtimeCDR.ts` — tighter filter, reconnect refresh.
  - `apps/ava-softphone-mobile/src/hooks/useMobileVoicemail.ts` *(new)*.
  - `apps/ava-softphone-mobile/src/hooks/useMobileRecordings.ts` *(new)* with Realtime.
  - `apps/ava-softphone-mobile/src/screens/{RecordingsScreen,VoicemailScreen,ContactsScreen}.tsx` — use new hooks.
  - `apps/ava-softphone-mobile/src/screens/MoreScreen.tsx` — remove promoted entries.
  - `apps/ava-softphone-mobile/src/lib/contacts.ts` — foreground re-sync.
  - `apps/ava-softphone-mobile/RELEASE.md` — verification checklist.
- New edge functions: `mobile-bootstrap`, `mobile-contacts` (`mobile-recordings` updated).
- Migration: ensure `pbx_call_records`, `pbx_voicemails` are in `supabase_realtime` publication (no-op if already added).
- No changes to desktop, portal, or AVA org pages.
- No build-system files touched.

---

## What I will NOT do (unless you ask)
- No PWA / service worker changes.
- No changes to AVA org pages or the landing page.
- No changes to billing / RLS beyond verifying mobile reads use existing safe scopes.
