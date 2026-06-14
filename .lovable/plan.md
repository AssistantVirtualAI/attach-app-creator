# Phase 1 — Real data only in production, real auth scoping (desktop + mobile)

Scope: `apps/ava-softphone-desktop` and `apps/ava-softphone-mobile`. No UI redesign, no audio proxy, no realtime — those are later phases.

## Goal

After this pass, neither app can silently show fictional data in a production build, both apps authenticate the same user against the same Supabase project as the portal, and every PBX query is scoped server-side to that user's organization and extension via existing DB functions (`has_role`, `is_lemtel_admin`, `current_user_org_ids`, `get_my_extension_summary`).

## Current problems found

- `apps/ava-softphone-desktop/src/lib/avaApi.ts`: `MOCK` defaults to `false`, but mock arrays are bundled into the production build and `call()` falls back to them on any non-OK response — masking real failures.
- `apps/ava-softphone-mobile/src/lib/mobileApi.ts`: `call()` *silently* returns mock data when (a) no portal URL / access token, or (b) any thrown error. A user logged out, or backend down, sees fake calls/threads.
- Both apps trust a client-provided `extension` from creds storage instead of resolving it server-side from the authenticated user.
- No visible indicator when mocks are active.

## Deliverables

### 1. Hard gate against mocks in production builds

- Add `apps/ava-softphone-desktop/src/lib/buildGuard.ts` and `apps/ava-softphone-mobile/src/lib/buildGuard.ts` that, at module import, throw if `import.meta.env.PROD && import.meta.env.VITE_AVA_MOCK === 'true'`. Import it from each app's `index.tsx` so any production build with mocks enabled fails to boot loudly.
- Replace the silent fallback in `mobileApi.ts:call()` and `avaApi.ts:call()` with: throw on error, never return mock data unless `isMockMode()` is true. `isMockMode()` returns `import.meta.env.DEV && import.meta.env.VITE_AVA_MOCK === 'true'`.

### 2. Visible demo banner when mocks are active

- New `<DemoModeBanner />` rendered at the top of each app shell when `isMockMode()` is true. Yellow strip, text "Mode démonstration — données fictives", non-dismissible.
- Files: `apps/ava-softphone-desktop/src/components/DemoModeBanner.tsx`, `apps/ava-softphone-mobile/src/components/DemoModeBanner.tsx`. Mounted in each app root.

### 3. Single source of truth for user scope

- New shared helper inside each app (`src/lib/avaScope.ts`) that calls the existing `get_my_extension_summary()` RPC once after login and caches `{ orgId, extension, displayName, sipDomain, role }`. Hook `useAvaScope()` exposes it.
- Replace every place that reads `extension` from creds/localStorage for *data queries* with `useAvaScope().extension`. Creds storage still drives SIP registration (no change to that path).

### 4. Real Supabase Auth on both apps

- Desktop & mobile already use `setAuthToken` / `configureMobileApi` to attach a bearer to PostgREST requests. Verify and fix that the bearer is always the live Supabase session token (`supabase.auth.getSession()`), refreshed via `onAuthStateChange`. No manual JWT pasting paths remain.
- Auth screens (`AuthScreen.tsx` on mobile, equivalent on desktop) sign in directly via `supabase.auth.signInWithPassword` — no separate edge-function login path that returns a long-lived token.
- On sign-out, clear creds AND call `supabase.auth.signOut()`.

### 5. Error states instead of empty arrays

- Replace silent `[]` / mock fallbacks with thrown errors propagated to the calling React Query hook.
- Add a small `<DataError />` component reused by Calls / Voicemail / SMS / Recordings lists: shows a short message + retry button. No technical stack trace.

### 6. Mobile-specific: remove the "fallback to mock" branch

- `mobileApi.ts` line ~46 (`catch (e) { ...return mockData; }`): remove the catch's mock fallback. Errors must bubble.
- `mobileApi.ts` line ~199 (`{ token: 'mock', ... }`): remove the synthetic SIP creds path. If `softphone-credentials` fails, surface the error.

### 7. No backend / schema changes

This phase reuses existing RPCs (`get_my_extension_summary`, `current_user_org_ids`) and existing RLS. No migrations.

## Files touched

```
apps/ava-softphone-desktop/src/lib/avaApi.ts            (remove silent mock fallback)
apps/ava-softphone-desktop/src/lib/buildGuard.ts        (new)
apps/ava-softphone-desktop/src/lib/avaScope.ts          (new)
apps/ava-softphone-desktop/src/components/DemoModeBanner.tsx  (new)
apps/ava-softphone-desktop/src/components/DataError.tsx (new)
apps/ava-softphone-desktop/src/index.tsx / App.tsx      (import guard, mount banner)

apps/ava-softphone-mobile/src/lib/mobileApi.ts          (remove silent mock fallback + 'mock' token)
apps/ava-softphone-mobile/src/lib/buildGuard.ts         (new)
apps/ava-softphone-mobile/src/lib/avaScope.ts           (new)
apps/ava-softphone-mobile/src/components/DemoModeBanner.tsx  (new)
apps/ava-softphone-mobile/src/components/DataError.tsx  (new)
apps/ava-softphone-mobile/src/MobileApp.tsx             (import guard, mount banner)
apps/ava-softphone-mobile/src/screens/AuthScreen.tsx    (route signin through supabase.auth)
```

No portal (`src/**`) files change. No edge functions change. No DB migrations.

## Acceptance

- A production build of either app with `VITE_AVA_MOCK=true` refuses to boot (clear error overlay).
- A dev build with mocks active shows the yellow "Mode démonstration" strip on every screen.
- Logging out, then opening Calls / Voicemail / SMS shows the `<DataError />` with retry, never fake records.
- Two different test users in the same org see only their own extension's data; switching account immediately reflects in the lists (no stale cache from previous session).
- The desktop and mobile call lists show the same `pbx_call_records` rows for the same extension as the portal's `/org/lemtel/telephony/calls`.

## Out of scope (later phases)

Audio proxy & signed URLs, UI redesign, compact mode rebuild, realtime sync & notifications, E2E tests / packaging hardening.
