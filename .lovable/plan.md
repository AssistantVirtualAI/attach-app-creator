# Plan — Mobile App Roadmap + In‑Browser Mobile Preview Page

## Part 1 — New "Mobile Preview" page (visual)

Goal: a page in the main web app where you can see the mobile app rendered inside a realistic phone frame, switch devices/orientation, and navigate its tabs without installing anything on a device.

### 1.1 Route + entry
- New route `/mobile-preview` registered in `src/App.tsx`.
- Add a "Mobile preview" entry in the admin/dev nav (next to existing internal tools) so it's reachable from the dashboard.

### 1.2 Page: `src/pages/MobilePreview.tsx`
Layout:
- Header: title "AVA Softphone — Live Mobile Preview" + small description.
- Toolbar:
  - Device selector: iPhone 15 Pro (390×844), iPhone SE (375×667), Pixel 8 (412×915), iPad mini (768×1024).
  - Orientation toggle (portrait/landscape).
  - Theme toggle (light/dark) — passed as URL query to the iframe.
  - "Reload" button.
  - "Open in new tab" link.
- Main: centered phone frame component (`PhoneFrame`) wrapping an `<iframe>` of the mobile app dev URL.
- Right panel (desktop only): quick links that send `postMessage` to the iframe to jump to a tab (home / calls / ava / queues / more) and to specific subpages (Recordings, Voicemail, AI Audit, Data Safety, Privacy, Permissions).

### 1.3 Components
- `src/components/mobile-preview/PhoneFrame.tsx` — pure CSS phone bezel (notch/dynamic island, rounded corners, speaker, side buttons, drop shadow). Accepts `width`, `height`, `variant: 'ios' | 'android'`.
- `src/components/mobile-preview/DeviceToolbar.tsx` — toolbar controls.
- `src/components/mobile-preview/MobileIframe.tsx` — iframe wrapper that:
  - Loads `import.meta.env.VITE_MOBILE_PREVIEW_URL` (fallback to `http://localhost:5180` in dev and to the deployed mobile preview URL in prod).
  - Forwards device pixel ratio + safe‑area CSS vars via query string.
  - Listens for `message` events from the iframe (for "current tab" sync) and posts navigation commands.

### 1.4 Mobile app side (tiny additions)
- `apps/ava-softphone-mobile/src/MobileApp.tsx`: on mount, read `?tab=…` and `?theme=…` from URL and set initial tab; add `window.addEventListener('message', …)` to switch tabs/subpages on command.
- `apps/ava-softphone-mobile/index.html`: add `<meta name="viewport" content="viewport-fit=cover">` if missing so safe-area vars work inside the frame.

### 1.5 Out of scope for Part 1
- No native device emulation (touch events use mouse fallback — that is enough for visual review).
- No screen recording / video capture.

---

## Part 2 — Mobile app roadmap (next milestones)

Grouped by theme. Each item is a self‑contained task we can ship one at a time.

### A. Core telephony UX
1. **In‑call quality HUD** — small badge on `ActiveCallSheet` showing MOS, jitter, packet loss from the SIP stats; tap to expand.
2. **Call transfer UI** — attended + blind transfer sheet wired to `sp.transfer`.
3. **Conference call** — add a 2nd party to an active call (DTMF + REFER flow already in `useSoftphone`).
4. **Park / pickup** — UI on the call sheet + a "Parked calls" list in `MoreScreen`.
5. **Bluetooth / speaker switcher** — audio output picker using Capacitor `WebView` + `navigator.mediaDevices`.

### B. Calls screen
6. **Smart filters** — All / Missed / Recorded / Voicemail chips on `CallsScreen`.
7. **Bulk actions** — multi‑select to delete, export, mark as reviewed.
8. **Sticky day separators** — "Today / Yesterday / Mon Jun 16".
9. **Caller name enrichment** — match against device contacts + workspace CRM.

### C. AI & analytics on mobile
10. **Per‑call AI panel** on `CallDetailScreen` — transcript, sentiment chip, summary, action items (uses existing `ai-transcribe-call` + `ai-analyze-call`).
11. **AI insights tab inside `AVAChatScreen`** — "Ask AVA about my last 10 calls".
12. **Weekly digest push** — Monday 9 am local: top metrics + 1 coaching tip.

### D. Notifications & background
13. **Rich push** — caller avatar + Answer/Decline actions on iOS/Android.
14. **VoIP push (CallKit / ConnectionService)** — true native incoming call screen.
15. **Background CDR sync** — every 15 min via Capacitor Background Runner.
16. **Do Not Disturb schedules** — per‑weekday quiet hours.

### E. Privacy / data controls (continuation)
17. **Data export download** — wire the existing "Export my data" button to `mobile-data-export` edge function (JSON + recordings zip).
18. **Per‑contact recording opt‑out** — list of numbers that will never be recorded for me.
19. **Retention enforcement job** — server cron that actually applies the user‑chosen retention windows from `DataSafetyScreen`.

### F. Polish & accessibility
20. **Dynamic Type / large text** support across all screens.
21. **VoiceOver / TalkBack labels** audit on dialer, call sheet, tabs.
22. **Haptic palette** — light/medium/heavy mapped consistently to actions.
23. **Empty‑state illustrations** for Voicemail, Messages, Recordings, AI Audit.
24. **i18n: French** completed on every screen (some new screens are EN‑only).

### G. Distribution
25. **Store metadata refresh** (`store-metadata/ios|android/metadata*.txt`) for the new features.
26. **Release checklist update** in `apps/ava-softphone-mobile/RELEASE.md`.

---

## Suggested order
1. Part 1 (Mobile Preview page) — small, gives a visual workspace for everything else.
2. A1, A2, B6, B8 — visible quick wins.
3. C10, C11 — AI on mobile.
4. D13, D14 — push/CallKit.
5. E17, E19 — privacy follow‑through.
6. F + G — polish & ship.

---

## Files (Part 1)
**New**
- `src/pages/MobilePreview.tsx`
- `src/components/mobile-preview/PhoneFrame.tsx`
- `src/components/mobile-preview/DeviceToolbar.tsx`
- `src/components/mobile-preview/MobileIframe.tsx`

**Edited**
- `src/App.tsx` (route)
- Nav component that lists internal tools (add link)
- `apps/ava-softphone-mobile/src/MobileApp.tsx` (read `?tab` + accept `postMessage`)
- `apps/ava-softphone-mobile/index.html` (viewport-fit if missing)

## Out of scope
- Landing page changes.
- Backend/RLS changes for Part 1.
- Real device emulation (touch/gestures) inside the preview.
