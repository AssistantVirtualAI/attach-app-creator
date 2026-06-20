## Goals
1. Remove the "Live" sync status pill from every screen of the mobile app.
2. Fully translate the mobile app (every tab + screen) to French, driven by the existing language toggle.
3. Make the app load faster and keep data fresh in near real time.

## 1. Hide the live status everywhere
- `MobileApp.tsx`: drop the `RealtimeHeader` render (line 320) and remove the helper component + `RealtimeStatusPill` import. No status pill on any tab.
- `QueuesScreen.tsx`: remove the `live sync · HH:MM:SS` footer line (line 106). Keep silent background refresh.
- Leave the underlying `useAutoSync` running so data stays fresh — just no UI chrome.

## 2. French translation for the whole app
Currently only `DashboardScreen` + `SettingsScreen` use `useT()`. All other screens are hardcoded English. Plan:

- Extend `src/lib/i18n.tsx` with a full dictionary covering: tabs/bottom-nav, Calls/Recents/Voicemail, Dialer, Messages hub + thread, Contacts, AVA chat, More, Auth, Permissions, Privacy, Data safety, Support, Features, Queues, Team chat, Call detail, Recordings, SIP config, AI screens, Delete account, error/empty states, button labels, toasts.
- Refactor every screen listed below to import `useT` and replace every visible English string with `t('…')`. No business-logic changes:
  - HomeScreen, CallsScreen, RecentsScreen, VoicemailScreen, DialerScreen, MessagesHubScreen, MessagesScreen, ContactsScreen, AVAChatScreen, MoreScreen, AuthScreen, PermissionsScreen, PrivacyScreen, DataSafetyScreen, SupportScreen, FeaturesScreen, QueuesScreen, TeamChatScreen, CallDetailScreen, RecordingsScreen, RecordingDebugScreen, SipConfigScreen, AIScreen, AIAuditScreen, DeleteAccountScreen, CallCenterAgentScreen, InboxScreen.
- Translate shared UI: `BottomTabs` labels, `ProfileSheet`, `NotificationsSheet`, `IncomingCallSheet`, `ActiveCallSheet`, `PermissionGate`, `DemoModeBanner`, `DataError`, `WssDiagnostics`, `Dialpad` hints.
- Language toggle already lives in Dashboard header + Settings — no UI change needed; it now flips the whole app.

## 3. Faster load + live data sync
- **Code-split heavy screens.** In `MobileApp.tsx`, convert every screen import (except `DashboardScreen` + `BottomTabs`) to `React.lazy` and wrap the active screen in `<Suspense fallback={<SplashAva mini />}>`. The home tab paints immediately; secondary tabs hydrate on demand.
- **Defer non-critical work on boot:**
  - Lazy-load Capacitor plugins inside `useAutoSync` (already done) — add the same pattern to `usePresencePing` and `useRealtimeCDR` so initial bundle stays small.
  - Move the realtime CDR + presence subscriptions into a `useEffect` that runs after first paint (`requestIdleCallback` fallback `setTimeout(0)`).
- **Cache last good payload** in `useAutoSync`:
  - Read/write `localStorage` per loader key (`ava.mobile.cache.<key>`) so screens render instantly with cached data and refresh in the background.
  - Add an optional `cacheKey` parameter; Dashboard passes `me` and `domainStats:<range>`.
- **Tighten live sync** without spamming the backend:
  - Dashboard `domainStats` interval drops from 60s → 20s while foregrounded; pauses when hidden (already supported).
  - Subscribe to Supabase Realtime `pbx_cdr` inserts (existing `useRealtimeCDR` hook) and call `refresh()` on new rows so the dashboard reacts within ~1s of a new call instead of waiting for the poll.
  - Calls/Recents/Voicemail screens follow the same Realtime-trigger pattern.
- **Network/runtime polish:**
  - Add `AbortController` to in-flight loader so tab switches cancel stale requests.
  - Preconnect to the Supabase endpoint via `<link rel="preconnect">` in the mobile `index.html` shell.
  - Wrap `DashboardScreen` metric grid in `React.memo` and memoize derived stats (`useMemo` on the heavy reduce blocks) to cut re-render cost on each tick.

## Technical notes
- No schema changes, no new edge functions.
- All edits are inside `apps/ava-softphone-mobile/src/**` plus the shared `i18n.tsx` dictionary.
- The existing language preference key (`ava.mobile.lang`) is reused; first launch picks FR automatically when the browser/device locale is French.
- No business-logic touched in any screen — only string extraction, lazy loading, and cache wiring.

## Out of scope
- Web/admin portal (only the mobile app).
- Login / billing / agent backend changes.
- Adding new analytics — the dashboard stats added previously are kept as-is.
