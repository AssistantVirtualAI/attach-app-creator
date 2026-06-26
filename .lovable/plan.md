# Plan — Softphone timeline, ringback early-media, Planipret header & freeze fix

## 1. Call state timeline (mobile softphone)

Add a compact visual timeline at the top of `ActiveCallSheet.tsx` (and outgoing pre-answer view) showing the SIP progression with live status dots:

```
● Composition → ● Sonnerie → ● Connecté
                ↘ Occupé / Refusé / Indisponible / Échec
```

- New component `apps/ava-softphone-mobile/src/components/CallTimeline.tsx`
  - Steps: `dialing` → `ringing` → `early-media` → `active` → `ended(reason)`
  - Glass pills with pulse animation on the active step, red glow on failure
  - French labels + sub-text (e.g. "Sonnerie chez le destinataire", "Ligne occupée")
- Wire from `useSoftphoneNative.ts` exposing a new `callPhase` + `callEndReason` already captured from native `callEnded`
- Map SIP/native reason codes → phase:
  - 100 Trying → `dialing`
  - 180 Ringing (no SDP) → `ringing`
  - 183 Session Progress (SDP) → `early-media`
  - 200 OK → `active`
  - 486/600 → `busy`, 603 → `declined`, 480/408 → `unavailable`, 487 → `cancelled`

## 2. Early-media ringback handling

In `CapacitorSip.swift`:
- Distinguish 180 without SDP (play local ringback) vs 183 with SDP (start RTP, stop local ringback)
- Emit new native events: `provisional` with `{ code, hasSdp }`
- On 183: call `prewarmAudio` + open RTP session immediately so PBX tones (announcements/queues) are audible
- Stop local ringback as soon as RTP packets arrive OR on 200 OK

In `useSoftphoneNative.ts` + `src/lib/sip/ringback.ts`:
- Start local ringback only when phase = `ringing` AND no early-media
- Stop on `early-media`, `active`, or `ended`
- Guarantee single instance (existing `ringback.ts` already uses Web Audio)

## 3. Planipret portal — top-right profile menu + bell

Target: `/planipret` desktop (PlanipretDashboard layout).

- Mount `WorkspaceHeaderExtras` (reused) in the Planipret top bar, positioned **above** the existing bell button (right column, stacked: profile menu on top, bell below)
- Enhance bell (`NotificationsSheet` or current bell trigger):
  - Realtime subscription to `planipret_phone_calls` (missed), `planipret_phone_messages` (inbound SMS), `planipret_voicemails`
  - Unread badge count, sound ping on new event, list with deep-links to MCalls/MMessages/MVoicemail
  - RLS already exists; use `supabase.channel` subscriptions in `useEffect` with cleanup

## 4. Auto page-switch freeze (desktop /planipret)

Symptom: portal flips between login ↔ dashboard by itself. Root cause investigation:
- `[AVA] build-version poll failed` in console + `vite server connection lost` suggests `buildVersionPoller.ts` triggers a reload loop
- Likely culprits to inspect & fix:
  - `src/lib/buildVersionPoller.ts` — JSON parse SyntaxError causes silent reload trigger
  - `PlanipretDashboard.tsx` / `PostLoginRedirect.tsx` auth guard re-evaluating on token refresh and bouncing user
  - `usePresencePing` / realtime subscription resubscribing on each render causing remount

Fix:
- Harden `buildVersionPoller`: try/catch JSON, ignore non-JSON responses, back-off on failure, never reload in preview origin
- Stabilize Planipret auth guard: wait for `loading === false` before redirecting; memoize redirect decision; guard against repeated `navigate()` on same path
- Audit `useEffect` deps in Planipret layout for missing cleanup causing re-subscribe loops

## Technical notes

- All native changes require `npx cap sync ios` + Xcode rebuild after `git pull`
- No backend schema changes; only new realtime subscriptions on existing tables
- No edits to Lemtel components or edge functions

## Files touched

- `apps/ava-softphone-mobile/src/components/CallTimeline.tsx` *(new)*
- `apps/ava-softphone-mobile/src/components/ActiveCallSheet.tsx`
- `apps/ava-softphone-mobile/src/hooks/useSoftphoneNative.ts`
- `apps/ava-softphone-mobile/src/lib/sip/ringback.ts`
- `apps/ava-softphone-mobile/ios/App/App/CapacitorSip.swift`
- `src/pages/planipret/PlanipretDashboard.tsx` (header slot)
- `src/pages/planipret/mobile/MHome.tsx` (bell wiring if shared)
- New `src/components/planipret/PlanipretBell.tsx` with realtime hooks
- `src/lib/buildVersionPoller.ts` (harden)
- Planipret auth guard file (TBD after inspection)
