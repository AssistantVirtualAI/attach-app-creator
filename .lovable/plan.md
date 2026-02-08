
# Fix Landing Page Links and Language Consistency

## Issues Found

### 1. Hardcoded strings not translated (language not respected)

**Navbar (Navbar.tsx):**
- Line 26: `'Full list'` -- hardcoded English, should use `t('nav.fullList')`
- Line 82: `'Plus'` -- hardcoded French for the "More" dropdown, should use `t('nav.more')`
- Lines 122, 188: `'Book a demo'` -- hardcoded English, should use `t('nav.bookDemo')`

**Footer (FooterSection.tsx):**
- Line 142: `'All systems operational'` -- hardcoded English, should use `t('footer.systemStatus')`

**PortalPreviewSection.tsx (mini-previews inside the interactive portal):**
- Multiple hardcoded English labels in skeleton UI: "Active", "Ready", "Live monitoring -- 3 active calls", "FAQ", "Products", "Policies", "Scripts", "Organization", "Branding", "API Keys", "Permissions", "ElevenLabs" badge labels, "White-label", "agents" text, sentiment labels ("positive", "neutral", "negative"), analytics labels ("Satisfaction", "Resolution", "Volume")

**ProductShowcaseSection.tsx:**
- Several hardcoded badge texts: "Wizard", "Sync", "Live", "stability", "style", "similarity", "Push config", "Test call", "Open agent"

### 2. Footer links pointing to non-existent sections/pages

The footer uses `<Link to="#changelog">`, `<Link to="#about">`, `<Link to="#blog">`, `<Link to="#careers">`, `<Link to="#contact">`, `<Link to="#cookies">`. None of these sections exist on the landing page, so they lead nowhere.

Additionally, all footer hash links use `<Link to="#features">` (React Router), which navigates to `/#features` but doesn't smoothly scroll. They should either use anchor-click scrolling or be replaced with real page routes.

**Fix approach:**
- Remove links to pages/sections that don't exist yet (changelog, about, blog, careers, contact, cookies) or replace them with placeholder page routes
- Convert footer hash links (`#features`, `#pricing`, `#integrations`) to use `onClick` scroll handlers like the Navbar does, instead of `<Link to=>`

### 3. Footer social links are placeholders
- Twitter, GitHub, LinkedIn all point to `#` (broken)
- Email points to `mailto:contact@example.com` (placeholder)

**Fix:** Remove placeholder `#` hrefs or replace with real links. For now, we'll make them non-clickable or remove them.

### 4. Pages not translated (show both languages simultaneously)

These pages show bilingual text ("EN / FR") side-by-side instead of switching based on language:

**Features.tsx (/features page):**
- Title: `"Full feature list"` with subtitle `"Liste complete des fonctionnalites"`
- Buttons: `"Book a demo / Demander une demo"`, `"Back to landing / Retour"`
- Accordion shows both `s.title.en` AND `s.title.fr` simultaneously, and items show both `it.en` and `it.fr`
- Should use `useTranslation()` and `language` to show only the active language

**DemoRequest.tsx (/demo-request page):**
- Title: `"Book a demo"` with `"Demander une demo"` below
- Labels: `"Name / Nom"`, `"Email"`, `"Company / Societe"`, etc.
- Buttons: `"Submit / Envoyer"`, `"Back / Retour"`
- Toast messages: bilingual
- Should use `useTranslation()` to show only the active language

**PrivacyPolicy.tsx (/privacy):**
- Entirely in French with no language toggle or English version

**Legal.tsx (/legal):**
- Entirely in French with no language toggle or English version
- Uses `<AppLayout>` wrapper (admin layout) instead of public landing layout (Navbar + Footer)

### 5. Navigation consistency issues
- Pricing section CTA buttons navigate to `/auth` (line 156 in PricingSection.tsx) which redirects to `/login` -- fine but could navigate directly to `/login`
- Hero CTA2 "Start free trial" navigates to `/auth` -- same redirect concern

---

## Implementation Plan

### Step 1: Add missing translation keys to en.ts and fr.ts

Add keys for:
- `nav.fullList`, `nav.more`, `nav.bookDemo`
- `footer.systemStatus`
- `features.page.*` keys (title, subtitle, buttons, back)
- `demoRequest.*` keys (title, subtitle, labels, buttons, toasts)
- `privacy.*` keys (all privacy policy content in English)
- `legal.*` keys (all legal content in English)

### Step 2: Fix Navbar.tsx
- Replace `'Full list'` with `t('nav.fullList')`
- Replace `'Plus'` with `t('nav.more')`
- Replace `'Book a demo'` with `t('nav.bookDemo')`

### Step 3: Fix FooterSection.tsx
- Replace all `<Link to="#section">` with `<button onClick={scroll}>` handlers for existing landing page sections (features, pricing, integrations)
- Remove or replace links to non-existent pages (changelog, about, blog, careers, contact, cookies) -- either remove them or point to a generic anchor
- Translate `'All systems operational'`
- Update social links: remove broken `#` hrefs

### Step 4: Fix Features.tsx (/features page)
- Import `useTranslation` and `useLanguage`
- Replace all bilingual strings with `language === 'fr' ? ... : ...` or `t()` calls
- Show accordion content in a single language based on context

### Step 5: Fix DemoRequest.tsx (/demo-request page)
- Import `useTranslation` and `useLanguage`
- Replace all bilingual label/button strings with proper translations
- Update toast messages to use current language

### Step 6: Fix PrivacyPolicy.tsx and Legal.tsx
- Add English translations for both pages
- Use `useTranslation`/`useLanguage` to render in the active language
- Fix Legal.tsx to use public layout (Navbar + FooterSection) instead of `<AppLayout>`

### Step 7: Fix PortalPreviewSection.tsx hardcoded labels
- Add translation keys for the skeleton UI labels (sentiment badges, categories, etc.)
- Replace hardcoded strings with `t()` calls

### Step 8: Fix ProductShowcaseSection.tsx hardcoded labels
- Add translation keys for badge texts
- Replace hardcoded strings with `t()` calls

### Step 9: Navigation cleanup
- Change `/auth` navigations to `/login` directly (Hero, CTA, Pricing, AgentCreation, Integrations)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/locales/en.ts` | Add nav.fullList, nav.more, nav.bookDemo, footer.systemStatus, features page keys, demo request keys, privacy keys, legal keys, portal preview labels, showcase labels |
| `src/locales/fr.ts` | Add matching French keys |
| `src/components/landing/Navbar.tsx` | Replace 3 hardcoded strings with t() calls |
| `src/components/landing/FooterSection.tsx` | Fix broken links, add scroll handlers, translate hardcoded text, clean up social links |
| `src/pages/Features.tsx` | Use useTranslation/useLanguage, show single language |
| `src/pages/DemoRequest.tsx` | Use useTranslation/useLanguage, show single language |
| `src/pages/PrivacyPolicy.tsx` | Add English content, use language context, add Navbar+Footer |
| `src/pages/Legal.tsx` | Add English content, switch from AppLayout to public layout, use language context |
| `src/components/landing/PortalPreviewSection.tsx` | Translate hardcoded skeleton labels |
| `src/components/landing/ProductShowcaseSection.tsx` | Translate hardcoded badge texts |
| `src/components/landing/HeroSection.tsx` | Change `/auth` to `/login` |
| `src/components/landing/CTASection.tsx` | Change `/auth` to `/login` |
| `src/components/landing/PricingSection.tsx` | Change `/auth` to `/login` |
| `src/components/landing/AgentCreationSection.tsx` | Change `/auth` to `/login` |
| `src/components/landing/IntegrationsSection.tsx` | Change `/auth?next=/integrations` to `/login` |
