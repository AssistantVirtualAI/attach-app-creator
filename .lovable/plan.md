**Plan**

1. **SIP provider + WebRTC capability**
   - Export a WebRTC capability helper from `jssipProvider.ts`.
   - On app start, detect missing `RTCPeerConnection` and pass a detailed user-facing error into the softphone state immediately.
   - Keep JsSIP loading guarded so unsupported browsers fail with the detailed WebRTC message, not a generic library error.

2. **WSS SSL/handshake warning + retry**
   - Improve SIP failure classification to distinguish:
     - WSS/transport/SSL certificate handshake failure
     - timeout
     - auth
     - DNS
   - Add a real reconnect/retry method in `useSoftphone` that restarts registration immediately.
   - Show a warning with a retry button when the WSS failure likely comes from browser TLS/certificate rejection.

3. **DialerScreen registration banner**
   - Add a clear banner at the top of the dialer showing `Registered`, `Connecting/Retrying`, or `Failed`.
   - Include the exact failure reason from the SIP hook.
   - Remove any remaining click-to-call fallback from the in-history keypad; outbound calls will only use `sp.call()` + informational `mobile-calls-start` logging with `mode: "webrtc"`.

4. **Restore Recordings beside History**
   - Recreate `RecordingsScreen.tsx` and add a `Recordings` segment beside `History` inside the Calls page.
   - Use the existing `mobile-recordings` edge function + `fusionpbx-proxy` signed URL flow for playback.
   - Add extension filtering for recordings.
   - Admins see all domain recordings; non-admins see only their own extension recordings.

5. **Backend recording scoping**
   - Update `mobile-recordings` so admin detection matches `mobile-calls`.
   - For admins: return domain-wide recordings scoped to organization/domain.
   - For non-admins: restrict to their own extension only.
   - Support optional extension filter query param.

6. **End-to-end-style test coverage**
   - Add a Vitest flow that simulates JsSIP loading, registration success, outbound `sp.call()`, and verifies no FusionPBX originate/click-to-call mode is used.
   - Add/adjust tests for WebRTC missing, WSS/SSL failure messaging, retry behavior, and recordings tab/filter visibility.

**Files expected to change**
- `apps/ava-softphone-mobile/src/lib/sip/jssipProvider.ts`
- `apps/ava-softphone-mobile/src/hooks/useSoftphone.ts`
- `apps/ava-softphone-mobile/src/MobileApp.tsx`
- `apps/ava-softphone-mobile/src/screens/DialerScreen.tsx`
- `apps/ava-softphone-mobile/src/screens/CallsScreen.tsx`
- `apps/ava-softphone-mobile/src/screens/RecordingsScreen.tsx`
- `apps/ava-softphone-mobile/src/lib/mobileApi.ts`
- `supabase/functions/mobile-recordings/index.ts`
- focused mobile tests under `apps/ava-softphone-mobile/src/**`