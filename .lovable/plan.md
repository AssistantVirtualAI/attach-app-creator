# Polish pass: edit dialogs, recordings, desktop super-admin, white theme, logo & mascot

## 1. Edit sheets/dialogs render properly

All Lemtel edit sheets (Extension, Gateway, IVR, Queue, Ring Group) use shadcn `Sheet`/`Dialog` which on small viewports clip and lose their footer button.

- Apply a shared pattern to every edit surface:
  - `SheetContent`: `flex flex-col h-full max-h-screen w-full sm:max-w-xl`
  - Wrap body fields in a scrollable middle: `flex-1 overflow-y-auto px-1 space-y-3`
  - Pin footer (Save / Cancel) in a `flex-shrink-0 border-t pt-3` block so it's always visible
- Make form labels and helper text use semantic tokens (`text-foreground` / `text-muted-foreground`) so they remain legible in white theme.
- Files: `LemtelGateways.tsx`, `LemtelExtensions.tsx`, `LemtelIvrs.tsx`, `LemtelQueues.tsx`, `LemtelRingGroups.tsx`, plus the matching `*EditSheet` / `*Dialog` components.

## 2. Recording playback

Rows load but Play does nothing — `fetchRecording()` resolves a URL but `RecordingWavePlayer` never starts. Fix:

- In `CustomerDetail.tsx` (and the global `RecordingsPage`), after `recUrls[r.id]` is set, mount `RecordingWavePlayer` with `autoPlay` and a fresh `key={r.id}`.
- In `RecordingWavePlayer.tsx`: support `autoPlay` prop, recreate the WaveSurfer instance on URL change, add an `<audio>` fallback when WaveSurfer fails to decode (current symptom), and surface load/play errors via toast.
- Edge function `fusionpbx-proxy` `get-recording` already returns a signed URL; add a small `Content-Type: audio/wav` enforcement and CORS `Range` header so seeking works.

## 3. Super-admin sees everything in desktop app, regular admin only their org

Console shows `Role: super_admin isSuperAdmin: false` — `useDesktopRole` is reading `role` but not flipping the `isSuperAdmin` flag. Fix:

- `useDesktopRole.ts`: compute `isSuperAdmin = userRole?.role === 'super_admin'` and export it.
- Wire the desktop sidebar/route guards to `isSuperAdmin`: when true, show **all** Lemtel domains + global admin nav (Users, Domains, Gateways, Billing, Webhooks, System). When false, scope queries by `organization_id` and hide global admin entries.
- For data queries used by desktop pages, branch the Supabase calls: super_admin → no `organization_id` filter; otherwise → `.eq('organization_id', currentOrgId)`. Touch points: extensions, recordings, voicemails, queues, IVRs, gateways, sms, conversations.

## 4. White theme for desktop app + light/dark toggle

- Extend `index.css` with a `:root[data-theme="light"]` block: white background, near-black foreground, soft gray muted, keep `--primary` at #0023e6 (already AA on white). Map card / popover / sidebar tokens accordingly so existing components recolor automatically — no per-component hex.
- Add `useDesktopTheme()` hook persisting `light | dark | system` in `localStorage` and applying `data-theme` on `<html>`. Default = `light` for Electron, `dark` for web (detect via `window.electronAPI` flag already set by `electron/main.cjs`).
- Add a Theme toggle in Desktop Settings (`/desktop/settings`) with three options.
- Audit hard-coded `text-white` / `bg-black` in desktop pages and replace with `text-foreground` / `bg-background`.

## 5. AVA logo + favicon consistency

- Replace every `<img src="/ava-logo.png">` / hard-coded logo path in desktop with a shared `<AvaLogo />` component that swaps to a white-theme-aware variant (`/lemtel-icon.png` for the "L" mark in tight spots, full `/ava-logo.png` for headers).
- Update `electron/main.cjs` `icon:` and `BrowserWindow.setIcon()` to `public/lemtel-icon.png`.
- Update desktop Auth screen (`/desktop/auth`) to use the same `<AvaLogo />` + the L favicon as the window icon.
- Copy `public/lemtel-icon.png` → `public/favicon.png` and ensure `index.html` references `/favicon.png`. Update `manifest.webmanifest` icons too.

## 6. Mascot — full body, funny 3D robot, repositioned

- Move launcher to **top-right**, above the softphone: `fixed top-6 right-6 z-[60]`. Softphone (`fixed bottom-6 right-6 z-[55]`) stays unobstructed.
- Replace the cropped `MascotFox` with a new `MascotRobot.tsx` (React Three Fiber): chunky boxy body, oversized round head, dish-antenna, glowing cyan eyes, jointed arms doing idle wave, breathing bob, blinking, mouth opens during streaming tokens. Camera framed so the **whole body** is visible — adjust `fov`, camera Z, and `<group position-y={-0.4}>` to fit.
- Launcher avatar shows the same robot but framed full-body in a 96×96 capsule (not cropped to a circle that hides legs).
- Expanded `MascotPanel`: dock as a 360×520 floating card to the **left** of the launcher so it doesn't cover the softphone.
- Keep the existing tool-calling agent and gather→propose→confirm flow untouched.

## Out of scope

- New backend tables or RLS changes.
- Voice TTS for the mascot.
- Mobile / public landing page edits.

## Validation

- Open each edit sheet → footer button visible, fields scroll.
- Recordings → click play → audio plays, seek bar works.
- Log in as super_admin → all 137 domains visible; demote and verify org-scoping.
- Toggle theme in Desktop Settings → instant white/dark swap, text remains readable everywhere.
- Mascot visible in full, doesn't overlap softphone; opening the panel doesn't cover incoming-call UI.
