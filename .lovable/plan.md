# Desktop App: Bug fixes + UI changes (Keeny)

Scope: `apps/ava-softphone-desktop/` only. No changes to mobile app, portal, or native iOS files.

---

## Bug 1 — Dashboard doesn't refresh

**File:** `apps/ava-softphone-desktop/src/components/console/HomeDashboard.tsx` + `src/hooks/useDashboardStats.ts`

- Expose a `refetch` callback from `useDashboardStats` (currently only auto-runs on args change).
- In `HomeDashboard`, add:
  - `window.addEventListener('focus', refetch)`
  - `setInterval(refetch, 60_000)`
  - `window.addEventListener('ava:callEnded', refetch)`
  - `document.addEventListener('visibilitychange', () => !document.hidden && refetch())`
  - `window.addEventListener('lemtel:sync', refetch)` (already-broadcasted realtime event from `useRealtimeSync`)
- Verify existing realtime subscription in `useRealtimeSync.ts` chains all `.on()` before `.subscribe()` (confirmed correct) — no change needed there.
- Add try/catch + auto-reconnect log around the subscribe status handler (already has backoff — just add a `console.info` when reconnected for debug).

## Bug 2 — Dashboard stays English on FR switch

**Files:** `HomeDashboard.tsx`, `src/lib/i18n.ts`

- Replace hardcoded strings in `HomeDashboard`: greeting ("Good morning/afternoon/evening"), "Command Center", range labels ("Today / 7 days / 30 days / Custom"), tile titles/hints in `METRIC_TITLES`, "Live Phone-System Brief", "Ext {n} · Live CDR…", "Loading the live PBX picture…", "call/calls answered/missed/recording", "Range", "no activity", "trend unavailable", "Could not load · click to retry", etc.
- Add matching keys to both `en` and `fr` in `src/lib/i18n.ts` under a `home.*` namespace.
- Wrap the component body with `useTranslation()` so it re-renders when language changes (the hook subscribes to a lang state — verify; if not, add a lightweight event listener on a `lemtel:lang-changed` custom event dispatched by the switcher).
- Language already persists in localStorage under `lemtel:lang` — keep.

## Bug 3 — App flickers when clicking a call detail

**File:** `src/components/console/CallsView.tsx`

Root cause: `load()` at line 83 replaces `sel` with a new object reference on every 20s poll + realtime tick, which re-triggers `useEffect([sel])` (line 132) that clears/refetches AI insight, and the audio effect (line 136) that revokes/rebuilds the blob URL → flicker.

Fix:
- Guard the insight effect with `useRef<string | null>(prevSelIdRef)`; only refetch when `sel?.id` actually changes:
  ```ts
  useEffect(() => {
    if (!sel) { setInsight(null); return; }
    if (prevSelIdRef.current === sel.id) return;
    prevSelIdRef.current = sel.id;
    ava.callDetail(sel.id).then(setInsight).catch(...);
  }, [sel?.id]);
  ```
- Apply the same id-guard to the audio-load effect so the blob isn't rebuilt when the underlying row is merely refreshed.
- In `load()` (line 83), keep the *existing* `sel` object reference when the id matches instead of swapping in the new row:
  ```ts
  setSel((current) => current ? (scopedCalls.find(c => c.id === current.id) ?? current) : current);
  ```
  → change to only replace if a meaningful field changed, or drop the swap entirely (detail panel keeps its cached copy until closed).
- Add a `retryLimit` (max 2) to audio-load failure retries.

## Change 1 — Physical keyboard numpad for dialing

**File:** `src/components/DialerKeypad.tsx` (+ consumers)

- Add a `useEffect` inside `DialerKeypad` that listens to `keydown` on `window` while the keypad is mounted/visible:
  - `0-9`, `*`, `#`, `+` → simulate the key press (visual highlight + call `onKey(digit)`).
  - `Backspace` → dispatch a new `onBackspace` prop.
  - `Enter` → dispatch `onDial` if number length > 0.
  - `e.preventDefault()` only when the event target is not an `<input>/<textarea>/[contenteditable]` and the dialer view is active.
- Visual feedback: set a transient `data-pressed` attribute on the matching button ref for ~120ms.
- Wire the new `onBackspace` / `onDial` callbacks through `SoftphonePane` and the console dialer view. Also apply to any floating mini-dialpad if present.

## Change 2 — Minimize / Maximize / Close buttons

**File:** `src/components/TitleBar.tsx`

- IPC bridge already exists in `electron/preload.ts` (`window.electronAPI.minimize/maximize/close`).
- Add three buttons on the right side of TitleBar (before `ProfileMenu`), styled to match dark theme:
  - `—` minimize, `⬜/❐` maximize/restore, `✕` close (close = red hover).
  - Wrap them in a container with `WebkitAppRegion: 'no-drag'`.
  - Platform detection: `window.electronAPI?.platform === 'darwin'` → hide (macOS uses native traffic lights already spaced by the 70px left spacer).
  - If `!window.electronAPI` (web/dev browser) → don't render.
- Track maximized state via `window.electronAPI.onWindowStateChange` (add a new IPC event in `electron/main.ts` that emits on `maximize`/`unmaximize` so the icon flips). Update `preload.ts` to expose `onWindowStateChange`.

## Change 3 — Rename nav items

**Files:** `src/lib/i18n.ts`

- `nav.dialer`: EN "Dialer" → "Phone", FR "Composeur/Clavier" → "Téléphone"
- `nav.calls`: EN "Calls" → "Call History", FR "Appels" → "Historique d'appels"
- `nav.messages`: keep "Messages" EN → "SMS"; FR → "SMS"
- No icon or route changes.

## Change 4 — Remove Call Queue and Telecom from desktop nav

**Files:** `src/components/console/LeftRail.tsx`, `src/components/console/ConsoleLayout.tsx`

- Remove `'queues'` and `'telecom'` from the `USER_ITEMS` array in `LeftRail.tsx`.
- In `ConsoleLayout.tsx`, if a stored/legacy `view === 'queues' | 'telecom'` is loaded, redirect to `'home'`.
- Leave the view components (`QueuesView.tsx`, `TelecomSettingsView.tsx`) in the codebase (still referenced by admin flows / mobile / portal) — only the sidebar entries are removed.

---

## Technical notes

- Language switcher already dispatches state via `useTranslation` hook; if the hook uses module-level state, add a `window.dispatchEvent(new Event('lemtel:lang-changed'))` on set and subscribe in `HomeDashboard` (verify by reading full `i18n.ts` before editing).
- Files touched (final list): `HomeDashboard.tsx`, `useDashboardStats.ts`, `CallsView.tsx`, `DialerKeypad.tsx`, `SoftphonePane.tsx`, `TitleBar.tsx`, `electron/main.ts`, `electron/preload.ts`, `LeftRail.tsx`, `ConsoleLayout.tsx`, `i18n.ts`.
- No changes to `apps/ava-softphone-mobile/**`, native iOS Swift, or portal pages.
