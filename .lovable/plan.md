# Mobile Auth — Land on Auth + Mirror Desktop Look

## Goal
When opening the mobile app (especially in `/mobile-preview`), it must land **directly on the sign-in screen**, and that screen must visually match the desktop softphone's `SetupWizard` adapted to a phone width.

## Part 1 — Land on Auth immediately in preview

Today the mobile flow is: `SplashAva` (≈700 ms) → `PermissionGate` (if mic not granted) → `AuthScreen`. Inside the preview iframe this means we see the splash and the permission card first.

Change in `apps/ava-softphone-mobile/src/MobileApp.tsx`:
- Detect preview mode from `window.location.search` (`?preview=1`, already forwarded by `MobileIframe`).
- When in preview:
  - Skip the 700 ms splash delay (set `booting=false` immediately, still render `AuthScreen` if no creds).
  - Skip `PermissionGate` (mic prompts don't work cleanly inside an iframe anyway) — treat `permsGateDone` as `true` by default.
- No change to native/standalone behavior — splash and gate still run there.

No backend or auth logic changes.

## Part 2 — Redesign mobile `AuthScreen` to match desktop

Rewrite `apps/ava-softphone-mobile/src/screens/AuthScreen.tsx` to mirror desktop `SetupWizard.tsx`, adapted for narrow widths:

- **Theme**: dark navy background (`colors.bg` equivalent), ice-white text — replace today's light/blue gradient.
- **Backdrop**: soft gold radial glow behind the logo (same `authGlow` animation hook used on desktop; add the keyframe to `apps/ava-softphone-mobile/src/styles.css` if missing).
- **Brand block**: square Lemtel-style logo (reuse the existing `/ava-logo.png`, square 84 px with glow shadow) → "Lemtel" wordmark (22 px, weight 800) → small tagline line ("AI Business Phone System").
- **Card**: centered, max-width 360, dark `bgCard`, 1 px border, 24 px radius, large drop shadow, `fadeIn` entry.
- **Mode toggle**: same two-pill `Extension | Email` toggle; active pill uses the gold→cyan gradient with dark text, identical to desktop.
- **Fields**: uppercase 10-px labels with 1.6 letter-spacing, dark inputs (`lemtel-input` style), 48 px height, rounded 12.
- **Primary button**: gold/cyan gradient pill ("Sign in" / "Connecting…"), 50 px tall, identical to desktop primary.
- **Helper copy**: same hint text as desktop ("Use the same SIP password…" / "Sign in with the email and password…").
- **Manual SIP setup**: keep as a small ghost button below the primary (functionality unchanged).
- **Footer**: "Built by AVA Statistic · assistantvirtualai.com" with gold accent — same as desktop.

All existing logic stays:
- `submitEmail` → `softphone-auth` edge function.
- `submitExtension` → `extension-signin` edge function.
- Same `onAuthenticated(creds)` payload shape and error messages.
- `SipConfigScreen` route still reachable via the ghost button.

## Out of scope
- No changes to desktop app, edge functions, RLS, or landing page.
- No new design tokens beyond what's needed to reuse the desktop palette inside the mobile app's `styles.css`.
- No splash redesign — only its timing is bypassed in preview mode.

## Files touched
- `apps/ava-softphone-mobile/src/MobileApp.tsx` — preview-mode skip for splash + permission gate.
- `apps/ava-softphone-mobile/src/screens/AuthScreen.tsx` — full visual rewrite (logic preserved).
- `apps/ava-softphone-mobile/src/styles.css` — add `authGlow` keyframe and any missing `.lemtel-input` / `.lemtel-btn-primary` styles used by the new screen.
