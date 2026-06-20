## Goal
Eliminate "unauthorized" failures and blank screens in the mobile app by persisting the Supabase session natively, restoring it on launch, auto-refreshing tokens, and surfacing a clear error state instead of blanking out.

## Changes

### 1. `apps/ava-softphone-mobile/src/lib/mobileSupabase.ts`
Add a properly configured Supabase client (separate from the generated one in `@/integrations/supabase/client`) so the mobile app can persist its session via Capacitor `Preferences`:
- New `getMobileSupabaseClient()` (and `export const supabase`) using `createClient` with:
  - `auth.persistSession: true`, `auth.autoRefreshToken: true`
  - `auth.storage` backed by `@capacitor/preferences` on native, `localStorage` fallback on web
  - `auth.storageKey: 'lemtel-mobile-auth'` (so it does not collide with the desktop client)
  - `realtime.params.eventsPerSecond: 2`
- Keep `authedRealtime`, `restGet`, `restPost`, `edgeCall`, recordings helpers untouched (already token-aware).

### 2. `apps/ava-softphone-mobile/src/lib/mobileApi.ts`
- Switch the `supabase` import from `@/integrations/supabase/client` to the new `./mobileSupabase` client so `getFreshToken()` reads the persisted mobile session.
- In `call()`, when `getFreshToken()` returns null, return the supplied `mockData` (treated as an empty placeholder) **only for GETs**, and throw an `AUTH_REQUIRED` error for mutations. This stops cascading blank screens during a brief token gap while still surfacing real auth failures on user actions.
- Tag the thrown error with `code: 'AUTH_REQUIRED'` so the UI can detect it.

### 3. `apps/ava-softphone-mobile/src/MobileApp.tsx`
- Import the new mobile `supabase` client.
- New effect (after creds load) that calls `supabase.auth.setSession({ access_token, refresh_token })` whenever `creds.accessToken` / `creds.refreshToken` change, logging success/failure.
- Subscribe to `supabase.auth.onAuthStateChange`:
  - `TOKEN_REFRESHED` → `setCreds({ ...creds, accessToken, refreshToken })` so storage stays current.
  - `SIGNED_OUT` → call existing `clearCreds()` so the app returns to `AuthScreen`.
- Add a top-level `authError` state. When `mobileApi` throws `AUTH_REQUIRED` (caught via a new window-level event emitted from `mobileApi.ts`), render a `<SessionExpired />` banner with "Log out" button instead of a blank screen.

### 4. `apps/ava-softphone-mobile/src/hooks/useRealtimeCDR.ts`
- Replace the locally-created `createClient(...)` with the shared `supabase` from `./lib/mobileSupabase` (still call `realtime.setAuth(token)` on token change so subscriptions are authenticated).
- Drop the unused `ANON_KEY`/`SUPABASE_URL` constants where possible; keep them only for the `cron-pbx-sync` fetch.

### 5. `apps/ava-softphone-mobile/src/lib/creds.ts` (small touch)
- Ensure `Creds` already has `refreshToken`; if not, add it and persist via existing creds storage (read-only check — only edit if missing).

### 6. New component `apps/ava-softphone-mobile/src/components/SessionExpired.tsx`
- Simple full-screen card: title "Session expirée", subtitle "Veuillez vous reconnecter pour continuer.", primary action button → `onSignOut()`.

## Non-goals
- No changes to vite.config.ts, electron-builder.yml, `.github/workflows/`, or generated `src/integrations/supabase/*`.
- No SIP / WebRTC / SDP changes.
- No edge-function changes.

## Validation
- Boot app cold → splash → dashboard loads with stored session (no blank, no 401 spam in console).
- Force expire token (set `accessToken=''` in storage) → see `SessionExpired` card with "Log out" instead of blank screen.
- Idle 1h → `TOKEN_REFRESHED` event fires, `creds` updated, no re-auth required.
- Realtime CDR keeps streaming after token refresh.