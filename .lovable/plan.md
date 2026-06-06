## Redesign desktop softphone — Noir & Or premium

### 1. Logo — full Lemtel wordmark
- Generate a new wordmark image: "LEMTEL" in elegant uppercase letterforms, refined gold (#FFD700 → #F0C75A gradient) on transparent background, optional thin "COMMUNICATIONS" tracking-wide subtitle below. Save to `apps/ava-softphone-desktop/src/assets/lemtel-wordmark.png` (transparent PNG, premium quality).
- Update `LemtelLogo.tsx` to use the new wordmark with proper heights: `xs` 22px, `sm` 32px, `md` 56px, `lg` 110px. Remove halo conic-blob (too noisy); replace with subtle gold drop-shadow only.
- **AuthScreen (SetupWizard)**: full wordmark `size="lg"`, centered, no halo background — just clean spotlight.
- **TitleBar**: wordmark `size="xs"` on the left, replaces current cropped logo.
- **Softphone footer**: keep AVA Statistic + assistantvirtualai.com link, add a small Lemtel wordmark above it.

### 2. Palette lock — Noir & Or premium
Update `lib/theme.tsx` design tokens to:
```
bg.base        #050510  (near-black blue-tinted)
bg.surface     #0F0F1E  (cards)
bg.elev        #16162B  (raised)
border.subtle  rgba(255,215,0,0.08)
border.gold    rgba(255,215,0,0.25)
text.primary   #F5F5F7
text.muted     #8A8A99
gold           #FFD700
gold.soft      #F0C75A
blue           #003DA6  (kept as secondary accent for SIP status / links)
glow.gold      0 0 24px rgba(255,215,0,0.35)
```
Remove the purple AI color from primary surfaces (kept only as small AI-tab accent). No more rgba(0,90,255) radial blobs on auth.

### 3. Bottom tabs — Lucide outline raffinés
Standardize to **stroke 1.5, size 20**, label 11px tracking-wider underneath. Active state = gold icon + gold label + 1px gold top-border + soft gold underglow. Inactive = `text.muted`.

Map per tab:
- Phone → `Phone`
- History → `Clock3`
- Contacts → `Users`
- Voicemail → `Voicemail`
- SMS → `MessageSquare`
- Recordings → `Disc3`
- AI → `Sparkles` (only tab keeping a hint of purple accent on active)

Bar: 64px tall, `bg.surface` + 1px top `border.subtle`, equal-flex items, no pill background per tab.

### 4. Spacious & aéré layout
- Increase global padding: panes get 28px horizontal / 24px vertical (was ~16).
- Dialer display: 36px monospace, letter-spacing 2px, 32px vertical breathing room.
- Dialpad keys: 64×64 (was 56), gap 16px, subtle inner gradient + 1px gold border on press.
- Call button: 72px circle, green→emerald gradient kept, larger glow.
- Lists (Recents/Contacts/Recordings/etc.): 64px row height, 16px gap between avatar/icon and text, divider = 1px `border.subtle`.
- Remove the animated background orbs everywhere except auth — keep auth with ONE single soft gold radial behind the wordmark, nothing more.

### 5. TitleBar polish
- 44px height, full-bleed `bg.base`, 1px gold under-glow line replaced by a subtle 1px `border.subtle`.
- Center status pill: smaller (12px text), pill bg `bg.elev`, dot uses gold when connected, muted when offline.

### 6. SetupWizard (Auth) polish
- Single centered card 420px wide, 32px padding, `bg.surface` with 1px `border.subtle`, 24px radius, soft gold glow on focus only.
- Full Lemtel wordmark above title, then thin uppercase tracking-wide caption "BUSINESS PHONE SYSTEM".
- Inputs: 48px tall, `bg.elev`, gold focus ring (1px), no purple.
- Submit button: gold gradient, black text, bold.

### 7. Files to change
- Create: `apps/ava-softphone-desktop/src/assets/lemtel-wordmark.png` (via imagegen premium, transparent)
- Edit: `LemtelLogo.tsx`, `TitleBar.tsx`, `SetupWizard.tsx`, `SoftphonePane.tsx` (tabs + dialer spacing + remove orbs + footer), `lib/theme.tsx` (tokens), `styles/animations.css` (remove orb keyframes, keep status pulse + ripple)
- Light pass on list components (`RecentsList`, `ContactsList`, `VoicemailList`, `RecordingsList`, `AIInsights`, `SmsThreads`) only to apply new spacing/typography tokens — no logic changes.
- Bump `package.json` to `1.0.5`.

### Out of scope
No changes to business logic, edge function calls, SIP layer, or sidebar config. Mobile app (`apps/ava-softphone-mobile/`) untouched.
