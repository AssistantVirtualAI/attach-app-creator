
# Plan: Complete Portal Endpoints + Fix Admin Auto-Login

## Problem 1: Portal Settings Missing Vapi & Full ElevenLabs Endpoints

The Agent Portal (accessed via `/:agentSlug/settings`) currently has incomplete platform coverage:

- **ElevenLabs**: Only has Voice, Turn, ASR, Prompt, and Members tabs. Missing: LLM settings, Conversation settings (max duration, client events), Language/Advanced settings, and the extended `ElevenLabsAPISections` (user info, usage stats, pronunciation dictionaries, history, TTS generation).
- **Vapi**: Not handled at all -- if the agent platform is Vapi, the page falls through to the ElevenLabs-specific UI.
- **Retell**: Already handled correctly via `RetellFullConfigTab`.

By contrast, the Client Portal (`ClientAgentSettings.tsx`) already supports all 3 platforms with full configuration parity.

### Solution

Update `src/pages/PortalSettings.tsx` to add platform routing similar to `ClientAgentSettings.tsx`:

1. **Add Vapi branch**: When `session.platform === 'vapi'`, render the `VapiAPISections` component with `organizationId` and `platformAgentId` from the portal session.

2. **Add missing ElevenLabs sections**:
   - Add LLM settings tab (temperature, max tokens)
   - Add Conversation settings tab (max duration, client events)
   - Add Language & Advanced tab (language selector, first message interruption toggle)
   - Add the `ElevenLabsAPISections` component below the tabs for extended API features (user info, usage, pronunciation, history, TTS generation)
   - Import the missing hooks: `useUpdateConversationSettings`, `useUpdateAgentAdvancedSettings`, `useUpdateLLMSettings`
   - Import missing types: `ConversationSettings`, `LLMSettings`, `ELEVENLABS_LANGUAGES`, `ELEVENLABS_CLIENT_EVENTS`

### Files to modify
- `src/pages/PortalSettings.tsx` -- Add Vapi platform handling, add missing ElevenLabs configuration sections

---

## Problem 2: Admin-to-Portal Auto-Login Broken

When clicking "Ouvrir le portail" from the Agents page, a new tab opens at `/portal/:slug`. The `PortalLogin` page should detect the admin's Supabase session and auto-redirect to the dashboard. Instead, it shows the login form.

### Root Cause

There is a race condition in `usePortalAuth.tsx`:

1. On mount, `supabaseUser` starts as `undefined`, `isSuperAdminUser` starts as `false`
2. `onAuthStateChange` fires first and sets `supabaseUser` to the logged-in user
3. The `checkIsSuperAdmin` RPC runs in a `setTimeout(0)`, so `isSuperAdminUser` is still `false`
4. `PortalLogin`'s effect triggers because `supabaseUser` changed from `undefined` to a user object
5. At this point, `isSuperAdmin()` returns `false`, so the super admin path is skipped
6. `loginAsOrgAdmin()` is tried next -- if the admin is not in `organization_members`, it returns `null`
7. `setCheckingSuperAdmin(false)` is called, showing the login form
8. Later, `isSuperAdminUser` becomes `true`, the effect re-runs and should work...

However, `loginAsSuperAdmin` has an internal guard: `if (!supabaseUser?.id || !isSuperAdminUser) return null`. There is a timing issue where the callback closure may capture stale values, and the re-run may not trigger reliably due to React batching.

### Solution

Add a `isSuperAdminChecked` boolean state to `usePortalAuth.tsx` that tracks whether the super admin check has completed. The `PortalLogin` page should wait for this flag before making any login decisions.

Changes to `src/hooks/usePortalAuth.tsx`:
- Add `isSuperAdminChecked` state (starts `false`, set to `true` after `checkIsSuperAdmin` resolves)
- Expose it in the hook return and context type
- Both the initial `checkAuth` and the `onAuthStateChange` handler should set this flag after the RPC call

Changes to `src/pages/PortalLogin.tsx`:
- Add `isSuperAdminChecked` to dependencies from `usePortal()`
- Wait for `supabaseUser !== undefined` AND `isSuperAdminChecked === true` before running the admin login logic
- This eliminates the race condition where the effect runs before the admin status is known

### Files to modify
- `src/hooks/usePortalAuth.tsx` -- Add `isSuperAdminChecked` state and expose it
- `src/pages/PortalLogin.tsx` -- Wait for `isSuperAdminChecked` before deciding login flow

---

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/PortalSettings.tsx` | Add Vapi platform branch with `VapiAPISections`, add missing ElevenLabs tabs (LLM, Conversation, Language/Advanced), add `ElevenLabsAPISections` extended component |
| `src/hooks/usePortalAuth.tsx` | Add `isSuperAdminChecked` state to eliminate race condition |
| `src/pages/PortalLogin.tsx` | Use `isSuperAdminChecked` to wait for admin status before auto-login logic |
