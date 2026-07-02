## Scope

Desktop app only (`apps/ava-softphone-desktop/`). No changes to `apps/ava-softphone-mobile/` or any iOS native files.

## Root causes found

- `src/App.tsx` swaps between `ConsoleLayout` and `SoftphonePane` at the 980px width breakpoint. That swap unmounts the pane holding the `<audio>` element and the call UI — this is what actually kills audio and forces the dialer → dashboard jump.
- `electron/main.ts` `BrowserWindow` has no `backgroundThrottling: false`, so audio can be throttled during resize.
- Some dialer/call-control surfaces use hardcoded light colors instead of `useTheme()` tokens.
- Dialer/call components render hardcoded English strings; `useTranslation()` from `src/lib/i18n.ts` already exists but is not wired into the dialer.

## Fixes

### Bug 1 — Audio dropped on resize

- `electron/main.ts`: add `backgroundThrottling: false` to `webPreferences`.
- `src/App.tsx`:
  - Track `callActive` from `SipKeepAlive` via the existing `sipProvider` snapshot (call states `ringing-in`, `ringing-out`, `active`, `held`).
  - In the resize handler, do not update `wide` while a call is active — freeze the current layout for the duration of the call.
- Keep `SipKeepAlive` at root (already the case) so SIP itself never remounts.

### Bug 2 — Resize navigates to dashboard + flicker

- Same `callActive` guard from Bug 1 prevents the `wide`/pane swap during ringing or active calls, which removes the dashboard jump and the remount flicker.
- Additionally, render both `ConsoleLayout` and `SoftphonePane` conditionally by `wide` but keep the active one mounted; the guard already prevents mid-call swaps, so no `display:none` shadow tree is needed.
- Confirm `SoftphonePane` isn't unmounted mid-call by any child breakpoint logic (spot check only — no rewrite).

### Bug 3 — Dialer flips to light mode during call

- Audit `DialerKeypad.tsx`, `CallControlGrid.tsx`, and `console/ActiveCallDock.tsx` for hardcoded `#fff`/`#000`/`white`/`black` and replace with `useTheme()` tokens (`t.bg`, `t.text`, `t.textMuted`, etc.) that already exist in `src/lib/theme.tsx`.
- No portal target is currently used; nothing to patch there.

### Bug 4 — Dialer stays in English

- Add missing keys to the `en` and `fr` maps in `src/lib/i18n.ts`:
  `dialer.calling`, `dialer.hangup`, `dialer.enterNumber`, `dialer.mute`, `dialer.unmute`, `dialer.hold`, `dialer.resume`, `dialer.transfer`, `dialer.keypad`, `dialer.speaker`, `dialer.active`, `dialer.ringing`, `dialer.ended`.
- Wire `useTranslation()` into `DialerKeypad.tsx`, `CallControlGrid.tsx`, and `console/ActiveCallDock.tsx`, replacing hardcoded English strings (button labels, placeholders, status text).
- `useTranslation` already re-renders on the `lemtel:lang` event, so no memo dependency changes are needed.

## Files to edit

- `apps/ava-softphone-desktop/electron/main.ts`
- `apps/ava-softphone-desktop/src/App.tsx`
- `apps/ava-softphone-desktop/src/lib/i18n.ts`
- `apps/ava-softphone-desktop/src/components/DialerKeypad.tsx`
- `apps/ava-softphone-desktop/src/components/CallControlGrid.tsx`
- `apps/ava-softphone-desktop/src/components/console/ActiveCallDock.tsx`

## Verification

- Typecheck the desktop app.
- Manual QA cases the user listed: resize during a call (audio stays, layout frozen), theme = dark during a call (dialer stays dark), language = fr during a call (all dialer labels in French).
