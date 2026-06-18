# Plan: Desktop Dialer Freeze + Mobile Parity + Provider Credentials Page

## 1. P3 — Desktop Dialer Freeze (wide window)

**Target:** `apps/ava-softphone-desktop/src/components/SoftphonePane.tsx` (the main dialer pane — what's mounted in the desktop window's "Dialer" tab). The freeze reproduces at wide widths when pressing Call.

**Root cause hypothesis:** at ≥1024px the pane renders a 3-column layout (keypad + recents + contacts). Pressing Call re-renders the parent on every SIP session event (`progress`, `accepted`, `confirmed`, `peerconnection`, `icecandidate`), and the heavy side panels (`RecentsList`, `ContactsList`) re-render synchronously with the parent — blocking the main thread for several seconds on big lists.

**Fix:**
- Memoize `RecentsList` and `ContactsList` with `React.memo` and stable prop refs (already done for `DialerKeypad`).
- Move active-call state (`session`, `callState`, `remoteIdentity`, timers) into a dedicated context/store so the side panels don't re-render on SIP events.
- Throttle the call-duration ticker to 1Hz via `useRef` + single `setInterval`, not state updates per event.
- Wrap the call button handler in `startTransition` so `session.connect()` doesn't block paint.
- Add a `useDeferredValue` on the search/filter input fed to `ContactsList`.

**Verify:** open desktop preview at 1440px, dial, click Call → UI stays responsive, no >100ms long task in Performance profile.

## 2. Mobile (/m) Dark Theme

**Target:** `apps/ava-softphone-mobile/src/styles.css` + screen inline styles.

- Add CSS variables for dark + light in `:root` and `[data-theme="light"]`; default to dark to match the existing `#0A1429` background already used in `MobileEmbed.tsx`.
- Replace remaining hardcoded `white` / `var(--text-muted)` with semantic tokens (`--surface`, `--surface-2`, `--text`, `--text-muted`, `--border`, `--primary`, `--success`, `--warning`, `--danger`).
- Add a theme toggle in `SettingsScreen.tsx` (persist to `localStorage` key `ava.theme`).
- Apply token to status bar in `index.tsx` based on saved theme.

## 3. Mobile Real-Time CDR per Extension

**Target:** `apps/ava-softphone-mobile/src/screens/CallsScreen.tsx` + `RecentsScreen.tsx` + a new hook `useExtensionCDR.ts`.

- Edge function `mobile-domain-stats` already returns aggregates; add a new edge function `mobile-extension-cdr` that returns `pbx_call_records` filtered to the signed-in user's extension (resolved via `pbx_softphone_users.extension_id`), ordered desc, paginated.
- Enable Realtime on `pbx_call_records` (migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.pbx_call_records;` — only if not already added).
- Hook subscribes to `postgres_changes` filtered by `extension = <my_ext>` and prepends new rows; teardown on unmount.
- Wire into `CallsScreen` and `HomeScreen` (today counter).

## 4. Mobile — Surface All Calling Features

Currently mobile shows dial / answer / hangup / mute / hold. Bring it up to parity with desktop `CallControlGrid`:

- Add to `ActiveCallSheet.tsx`: **DTMF keypad, Transfer (blind + attended), Conference (3-way), Hold, Mute, Speaker, Record toggle, Add call**.
- Add to `MoreScreen.tsx` entries: **Call Forwarding** (existing hook `useCallForwarding`), **Do Not Disturb**, **Voicemail Greetings**, **Pause Reasons** (queue agents), **Queues login/logout**, **Presence status picker**.
- Wire each to the existing edge functions (`pbx-call-transfer`, `pbx-call-conference`, `pbx-call-record-toggle`, `pbx-set-forwarding`, `pbx-queue-agent-state`). Create thin wrappers in `useSoftphone.ts`.

## 5. Provider Credentials Integration Page (Lemtel Portal)

New page `src/pages/lemtel/ProviderCredentials.tsx` accessible to Lemtel admins under `/lemtel/integrations/providers`.

**Providers:** Twilio, Telnyx, Skyetel, VoIP.ms.

**UI per provider card:**
- Form fields (all secret values masked, show/hide toggle):
  - **Twilio:** Account SID, Auth Token, API Key SID, API Key Secret, Default From Number.
  - **Telnyx:** API Key (v2), Messaging Profile ID, Connection ID, Default From Number.
  - **Skyetel:** SID, Secret, Tenant ID, Outbound Trunk Group.
  - **VoIP.ms:** API Username, API Password, Sub-account, Allowed IP note.
- "Test Connection" button → edge function `provider-credentials-test` runs a cheap auth probe per provider.
- "Save" → upserts into existing `lemtel_config` (rows tagged `is_secret=true`, keys prefixed `TWILIO_`, `TELNYX_`, `SKYETEL_`, `VOIPMS_`).
- Status badge: Not configured / Configured / Verified / Error (last test result + timestamp).
- Collapsible **"How to get these credentials"** guide per provider with step-by-step + deep links:
  - Twilio: console.twilio.com → Account → API keys & tokens.
  - Telnyx: portal.telnyx.com → API Keys + Messaging → Messaging Profiles.
  - Skyetel: my.skyetel.com → Settings → API + SIP → Endpoint Groups.
  - VoIP.ms: voip.ms → SOAP/REST API → Enable + set IP allowlist.

**Backend:**
- New edge function `provider-credentials-test/index.ts` with per-provider verify routine (Twilio `/Accounts.json`, Telnyx `/whoami`, Skyetel `/sip/endpoint_groups`, VoIP.ms `getServerInfo`).
- Stored values readable only via `lemtel_config` RLS (admin-only, already in place).
- Add nav entry in Lemtel sidebar.

## Out of Scope

- No changes to `vite.config.ts`, `electron-builder.yml`, `.github/workflows/*`.
- No P10 welcome email work (blocked on `notify.avastatistic.ca` sender subdomain setup).

## Technical Notes

- New files: `apps/ava-softphone-mobile/src/hooks/useExtensionCDR.ts`, `apps/ava-softphone-mobile/src/hooks/useTheme.ts`, `src/pages/lemtel/ProviderCredentials.tsx`, `src/components/lemtel/ProviderCredentialCard.tsx`, `supabase/functions/mobile-extension-cdr/index.ts`, `supabase/functions/provider-credentials-test/index.ts`.
- Edits: `SoftphonePane.tsx`, `ActiveCallSheet.tsx`, `MoreScreen.tsx`, `SettingsScreen.tsx`, `CallsScreen.tsx`, `RecentsScreen.tsx`, mobile `styles.css`, mobile `index.tsx`, Lemtel sidebar/router.
- Migration: enable Realtime on `pbx_call_records` if needed; no schema changes required (reuse `lemtel_config`).
