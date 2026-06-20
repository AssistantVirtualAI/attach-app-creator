## Goal
Light theme currently uses pure white surfaces (#FFF) with low-contrast borders and washed-out muted text. Goal: warmer tinted background, clear surface separation, stronger borders/inputs, darker muted text — without touching dark theme or component code.

## Changes (single file: `src/index.css`, `:root` block only)

**Surfaces — add depth instead of pure white**
- `--background`: `0 0% 100%` → `220 20% 97%` (soft cool off-white)
- `--card` / `--popover`: `0 0% 100%` → `0 0% 100%` kept, but cards now visibly lift against tinted bg
- `--sidebar-background`: `0 0% 98%` → `220 18% 95%`
- `--sidebar-accent`: `220 13% 95%` → `220 15% 90%`

**Text — stronger reading contrast**
- `--foreground`: `0 0% 0%` → `222 25% 12%` (near-black, not harsh pure black)
- `--card-foreground` / `--popover-foreground`: same as foreground
- `--muted-foreground`: `220 9% 46%` → `220 12% 32%` (much darker for secondary text/labels/placeholders)
- `--sidebar-foreground`: `240 5.3% 26.1%` → `222 25% 18%`

**Borders & inputs — visible field outlines**
- `--border`: `220 13% 91%` → `220 15% 80%`
- `--input`: `220 13% 91%` → `220 15% 75%` (input borders pop against background)
- `--sidebar-border`: same bump

**Muted surface**
- `--muted`: `220 13% 96%` → `220 16% 92%` (badges/secondary buttons read clearly)

**Hero gradient** retune to match new bg:
- `--gradient-hero`: end stop `hsl(231,100%,98%)` → `hsl(220,20%,97%)`

## Out of scope
- Dark theme (`.dark` block) untouched.
- No component edits — all changes flow through semantic tokens.
- Primary/accent/destructive hues unchanged.

## Verification
After change: scan home, dashboard, settings, forms — confirm input borders visible, placeholder text readable, cards lift from background, sidebar separates from main content.
