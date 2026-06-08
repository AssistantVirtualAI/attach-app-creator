# AVA Statistic — Visual Design Spec

Cyberpunk glassmorphism. Dark-first. Subtle motion. Neon accents used sparingly.

## 1. Color tokens (HSL, defined in `src/index.css`)

Use semantic tokens only. NEVER hardcode colors in components.

| Token | Dark value | Use |
|---|---|---|
| `--background` | `232 30% 6%` | App background |
| `--foreground` | `0 0% 98%` | Primary text |
| `--card` | `232 25% 10%` | Card base (combine with `/40-/60` opacity for glass) |
| `--muted` | `232 20% 16%` | Muted surfaces |
| `--muted-foreground` | `230 15% 72%` | Secondary text |
| `--border` | `232 20% 22%` | Default borders (prefer `white/10` for glass) |
| `--primary` | `231 100% 62%` | Brand actions, focus |
| `--primary-glow` | `231 100% 72%` | Glow halos |
| `--secondary` | `280 85% 62%` | Secondary highlights |
| `--accent` | `185 100% 55%` | Cyan accent (sparingly) |
| `--success` | `157 100% 48%` | Positive |
| `--destructive` | `3 89% 60%` | Danger |
| `--warning` | `45 100% 55%` | Warning |

Neon palette (use only for highlights, badges, sparklines): `--electric-blue`, `--vivid-purple`, `--hot-pink`, `--cyber-cyan`, `--neon-green`, `--sunset-orange`.

Gradients: `bg-gradient-primary`, `bg-gradient-secondary`, `bg-gradient-aurora`, `bg-gradient-hero`, `bg-gradient-glow`, `bg-gradient-card`.

Shadows: `shadow-sm/md/lg/xl`, `shadow-glass`, `shadow-glow`, `shadow-glow-primary`, `shadow-neon`, `shadow-cyan`.

## 2. Typography

- Body: **Inter** (`font-sans`)
- Code: **Fira Code** (`font-mono`)
- All headings `font-semibold` minimum.

Scale (Tailwind):
| Level | Class |
|---|---|
| Display | `text-4xl md:text-5xl font-bold tracking-tight` |
| H1 page title | `text-3xl font-bold tracking-tight` |
| H2 section | `text-2xl font-semibold` |
| H3 card title | `text-lg font-semibold` |
| Body | `text-sm` |
| Small / meta | `text-xs text-muted-foreground` |
| Table header | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` |

Gradient text: `.ai-text-gradient` for hero words; `.gradient-text` for inline.

## 3. Spacing & radius

- 4px base unit. Use Tailwind scale (`p-1` = 4px).
- Card padding: `p-6` (24px) standard, `p-4` compact.
- Section gap: `space-y-6` between cards, `space-y-4` inside.
- Page padding: `p-4 lg:p-6`.
- Radius: cards `rounded-xl`, inputs/buttons `rounded-md`, pills `rounded-full`.

## 4. Component styles

### Card
Default `Card` is glass: `bg-card/50 backdrop-blur-xl border border-white/10 shadow-glass rounded-xl`. Use as-is; add `glow-hover` for premium/interactive cards.

### Panel / section
Use `.glass-panel` for full-width sections, `.glass-surface` for nested panels.

### Button
- `default` — gradient primary + neon glow on hover
- `outline` — glass surface, primary border + glow on hover
- `secondary` — translucent secondary
- `ghost` — transparent, hover `bg-white/5`
- `neon` — glass + primary border, permanent soft glow
- `destructive`, `link` — standard

### Input / form fields
Glass background, `border-white/10`, focus ring primary with glow. Inherits across `Input`, `Textarea`, `Select`. Always pair `Label` (font-medium, `text-sm`).

### Table
- Header: uppercase tracking, `bg-white/[0.02]`, `border-white/10`
- Row hover: `bg-white/[0.04]`, dividers `border-white/5`
- Selected: `bg-primary/10`

### Sidebar / list items
- Active: `bg-primary/15 border border-primary/30`
- Hover: `bg-white/5`
- Glass surface (`bg-sidebar/70 backdrop-blur-2xl`)
- Active item left bar: `border-l-2 border-l-primary`

### Badges
- Default: muted glass
- Success/Warning/Destructive: tinted bg `/15` + colored text + matching border `/30`

## 5. Motion

- Transitions: `duration-200 ease-out` standard
- Hover lift: `-translate-y-px` on primary buttons & cards
- Stagger lists with framer-motion (50ms step)
- Aurora background: 24s slow drift, `prefers-reduced-motion` disables all decorative animation
- Loading: shimmer over skeleton (avoid flat gray)

## 6. Layout shell

- `AppLayout` wraps app in `.aurora-bg` (fixed mesh gradient, `z-index: -1`)
- Sidebar 288–320px, glass, right edge has vertical neon line
- Mobile header glass with backdrop-blur

## 7. Do / Don't

✅ Use semantic tokens (`bg-card`, `text-foreground`)
✅ Combine `bg-card/N + backdrop-blur-xl + border-white/10` for glass
✅ Reserve neon glow for primary CTAs / active states
✅ Test contrast in dark mode (WCAG AA)

❌ No hardcoded `bg-white`, `text-black`, hex colors in components
❌ No more than 1 neon glow per visible region
❌ No `backdrop-blur` larger than `2xl` (perf)
❌ No animated background without `prefers-reduced-motion` check
