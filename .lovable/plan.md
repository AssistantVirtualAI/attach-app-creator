
# Desktop App Visual Refresh — Light & Clear

Goal: replace the dark navy/violet glass aesthetic with a **light, airy, high‑clarity** UI that keeps the AVA Statistic brand (primary `#0023e6`) but feels closer to Linear / Notion / modern Apple apps.

Scope: **only** `apps/ava-softphone-desktop/` (no changes to the web portal, mobile app, or landing).

---

## 1. New light theme tokens (single source of truth)

Rewrite `apps/ava-softphone-desktop/src/lib/theme.tsx`:

- Make **light mode the default** (`ThemeProvider` initial = `'light'`).
- Rebuild the `theme` export (used everywhere as `theme.colors.*`) on a light palette so legacy screens auto‑pick it up without a rewrite.

Proposed palette:

```text
bg            #f6f8fc   app background (cool off‑white)
surface       #ffffff   cards, panels
surfaceElev   #ffffff + shadow
surfaceHover  #eef2f9
border        #e3e8f1   hairlines
borderStrong  #c9d2e3
text          #0f172a   primary text
textMuted     #475569
textSubtle   #94a3b8
primary       #0023e6   brand (unchanged)
primarySoft   #e6ebff   chips, hovers, selection
accentGrad    linear-gradient(135deg,#0023e6,#6680ff)
success       #16a34a
warning       #d97706
danger        #dc2626
gold          #b8860b   (kept for "signal" highlights, darker for contrast on white)
```

Replace the dark `bgGradient`, glass cards, and heavy shadows with:
- subtle radial tint top‑left (`rgba(0,35,230,0.06)`) on a near‑white base,
- card style: white + `1px solid border` + soft shadow `0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.08)`,
- remove backdrop blur where it muddies legibility.

## 2. Title bar, left rail, AI panel

Files: `TitleBar.tsx`, `BrightnessOverlay.tsx`, `console/LeftRail.tsx`, `console/AIPanel.tsx`, `console/ConsoleLayout.tsx`.

- Title bar: white with a 1px bottom border (no translucent navy).
- Disable / soften `BrightnessOverlay` in light mode (return `null` when `mode === 'light'`).
- Left rail: white surface, icons in `textMuted`, active item = `primarySoft` background + `primary` icon + 2px left accent bar.
- AI panel: white card with a thin violet accent header instead of full violet glow.
- Compact top bar (mobile width): white + border instead of dark glass.

## 3. Softphone widget & dial pad

File: `SoftphoneWidget.tsx` (+ shared dial pad).

- Dial pad keys: white with `border`, hover = `primarySoft`, press = `primary` text.
- Status pills (Registered / 403 / Busy): solid light chips (`bg-success/10 text-success`, etc.) — no neon glow.
- "SIP credential inspector" panel: light card, monospace values in `#0f172a`, source badge uses semantic chip colors.
- Incoming call toast & ActiveCallDock: white card, colored left border (green = incoming, blue = active).

## 4. Dashboards & list views

Files: `HomeDashboard.tsx`, `CallsView.tsx`, `RecordingsView.tsx`, `VoicemailView.tsx`, `MessagesView.tsx`, `ContactsView.tsx`, `AdminView.tsx`, `ReportsView.tsx`, `PBXLiveView.tsx`, `QueuesView.tsx`, `AuditView.tsx`.

- Unified `Card` look from new tokens (no per‑view custom dark gradients).
- Tables: white rows, `#f6f8fc` zebra, sticky header in `surfaceHover`, row hover `primarySoft`.
- Replace gold/violet headings with `text-primary` for section titles and `textMuted` for labels.
- Empty states: light illustration tone, single CTA in primary.

## 5. Typography & density

- Keep Inter, but bump base to **14px / 1.5** with `-0.005em` tracking for clarity on light bg.
- Headings: `#0f172a`, weight 600 (not 800) — lighter feel.
- Increase row padding in lists by 2px for breathing room.

## 6. Theme toggle stays

`ThemeProvider` keeps a dark variant (also re‑tuned to be a *soft* dark, not pitch black) so users who prefer dark can switch from Settings. Default = light.

## 7. QA pass

- Walk every left‑rail view at 1280×800 and at compact (<640px) and confirm: no black panels, no unreadable gold‑on‑white, no leftover `rgba(11,16,30,…)` literals.
- Grep for hard‑coded dark hexes (`#05060d`, `#0a1530`, `rgba(11,16,30`, `rgba(140,170,255`) inside `apps/ava-softphone-desktop/src` and replace with tokens.

---

### Technical notes

- All color changes flow through `theme` in `lib/theme.tsx` — most components read `theme.colors.*` already, so the refresh is mostly token work + targeted overrides in ~10 view files.
- No backend, no SIP logic, no routing changes.
- Estimated touch: ~15–20 files, all under `apps/ava-softphone-desktop/src/`.

Reply **"go"** to implement, or tell me which sections to drop/adjust.
