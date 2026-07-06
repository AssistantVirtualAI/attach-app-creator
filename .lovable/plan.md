## Goal

Bring the `/mplanipret` native flow up to the VoIP standard used by production iOS/Android softphones (Zoiom/Bria/Grandstream Wave): a proper post‑sign‑in permissions sequence for **microphone, contacts, and notifications**, with a rationale screen, real push‑token registration, and incoming‑call notifications.

## What exists today

- `src/lib/native/requestPermissionsAfterLogin.ts` fires the 3 native dialogs back‑to‑back with **no rationale UI** and only once per install (`permissions_requested_v1` flag).
- It is invoked from `PlanipretMobile.tsx` and `MobileAuthScreen.tsx` after sign‑in.
- `@capacitor/push-notifications`, `@capacitor-community/contacts`, `@capacitor/local-notifications`, `@capacitor/preferences` are already in `package.json`.
- No `capacitor.config.ts` exists in the repo.
- `supabase/functions/mobile-register-push` only writes an audit row — the token is not persisted for delivery.
- `MicDeniedBanner.tsx` already handles the "denied → open Settings" recovery for mic.

## What VoIP apps do (target behavior)

```text
sign-in success
   │
   ▼
[Rationale screen]  ── "Skip" ──► app home (state = skipped)
   │  "Continue"
   ▼
1. Notifications  (push + local, critical alerts hint on iOS)
2. Microphone     (required to place/receive calls)
3. Contacts       (optional, for caller ID + dialer autocomplete)
   │
   ▼
Register FCM/APNs token → backend
Register push + local-notification listeners → route incoming call
   │
   ▼
Home; per-permission inline banners if any were denied
```

## Plan

### 1. Capacitor project config
- Add `capacitor.config.ts` with `appId app.lovable.d91c259879a6408e9f0352317572ea4c`, `appName attach-app-creator`, dev `server.url` for hot‑reload, and plugin config for `PushNotifications` (`presentationOptions: ["badge","sound","alert"]`) and `LocalNotifications` (default sound/smallIcon).
- Document (in the closing message, not code) the iOS `Info.plist` strings the user must add after `npx cap add ios`: `NSMicrophoneUsageDescription`, `NSContactsUsageDescription`, plus `UIBackgroundModes = voip, audio, remote-notification`. For Android, note the `POST_NOTIFICATIONS`, `READ_CONTACTS`, `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE` permissions to be added in `AndroidManifest.xml` after `npx cap add android`.

### 2. New permissions module `src/lib/native/permissions/`
Split the current one file into a focused module:

- `platform.ts` — `isNative()`, `getPlatform()` wrappers around `@capacitor/core`.
- `notifications.ts` — request push perm, register with APNs/FCM, wire `PushNotifications` listeners (`registration`, `registrationError`, `pushNotificationReceived`, `pushNotificationActionPerformed`). On `registration`, POST to `mobile-register-push` with `{ token, platform, extension }`. On action `answer`/`decline`, route to `/mplanipret/calls?incoming=<ns_callid>&action=<answer|decline>`.
- `microphone.ts` — probe permission via `navigator.permissions.query({ name: "microphone" })` when available, else `getUserMedia({ audio: true })`; expose `ensureMic()` that returns granted/denied/prompt.
- `contacts.ts` — `checkPermissions` → `requestPermissions`; expose `ensureContacts()`.
- `localCallNotifications.ts` — helper `showIncomingCallNotification({ callId, from })` using `@capacitor/local-notifications` with `actionTypeId "INCOMING_CALL"` (Answer / Decline). Register the action type once on app start.
- `orchestrator.ts` — replaces `requestPermissionsAfterLogin.ts`. Sequentially runs notifications → microphone → contacts, honoring per‑permission "already requested" flags (`perm_notif_v1`, `perm_mic_v1`, `perm_contacts_v1`) stored in `@capacitor/preferences`. Records the final status (`granted | denied | skipped`) per permission for the banners to read.

Keep `requestPermissionsAfterLogin.ts` as a thin re‑export so existing callers keep working.

### 3. Rationale screen
- New component `src/components/planipret/mobile/PermissionsPrimer.tsx` with 3 rows (icon + title + one‑line reason + status pill) and two buttons: **Continue** (runs orchestrator) and **Skip for now**.
- Render it as a fullscreen overlay inside `PlanipretMobile.tsx` when `isNative()` and no `permissions_primer_seen_v1` flag exists, instead of firing the dialogs from a `useEffect`. On completion, set the flag and unmount.
- Do not show it on web/PWA (`isNative()` false) — web already works via inline `getUserMedia` prompts.

### 4. Push listener bootstrap
- New `src/lib/native/pushBootstrap.ts` invoked once on app start (from `PlanipretMobile.tsx` mount, native only) that:
  - Registers listeners even if permission was granted on a previous launch.
  - Creates the `INCOMING_CALL` local‑notification action type.
  - On `pushNotificationReceived` with `data.type === "incoming_call"`, calls `showIncomingCallNotification` and posts to the existing softphone incoming‑call handler.
- Guard with `Capacitor.isNativePlatform()` so it is a no‑op on web.

### 5. Backend
- Extend `supabase/functions/mobile-register-push` to upsert into `mobile_push_tokens` (the table already referenced by `mobile-delete-account`) with `{ user_id, platform, token, extension, updated_at }` on conflict `(user_id, token)`. If the table does not exist, add a migration creating it with RLS `user_id = auth.uid()` and the four required GRANT statements (`authenticated` + `service_role`).

### 6. Inline denial banners
- Extend `MicDeniedBanner.tsx` pattern into `PermissionBanners.tsx` covering all three permissions. Read status from Preferences written by the orchestrator; each row deep‑links to system Settings (`Capacitor.App.openSettings()` on iOS shim, `@capacitor/app` intent on Android).
- Mount it on `MHome` above the tabs.

### 7. Wiring cleanup
- `PlanipretMobile.tsx` and `MobileAuthScreen.tsx`: replace the current `void import(...requestPermissionsAfterLogin)` calls with the new primer mount logic; keep a fallback call to the orchestrator for the web PWA path (which will short‑circuit on non‑native).

## Out of scope

- Full CallKit / ConnectionService integration (requires `@capacitor-community/callkit` or a custom plugin — not installed).
- Firebase project creation / APNs key upload — user must configure these in their Apple Developer + Firebase console before push works in production; noted in the closing message.
- iOS PushKit / VoIP push certificates — these need a native plugin and Apple entitlements outside Lovable's control.

## Technical notes

- All new native code paths are lazy‑imported and guarded by `Capacitor.isNativePlatform()` so the web build and Lovable preview remain unaffected.
- Preference keys are versioned (`_v1`) so future updates can force a re‑prompt by bumping the suffix.
- The orchestrator waits ~400 ms between dialogs — required on iOS 17+ so the second sheet is not dropped when the first is dismissed programmatically.
- Push token registration is idempotent: the edge function upserts on `(user_id, token)`; stale tokens are cleaned by `mobile-delete-account`.
