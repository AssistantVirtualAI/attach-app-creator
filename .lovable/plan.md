

# Fix Non-Functional Landing Page Navigation Links

## Problem

When you're on a sub-page (`/features`, `/demo-request`, `/privacy`, `/legal`), clicking Navbar links like **Full list**, **Portals**, **Integrations**, **Analytics**, **Testimonials**, or **Agent Creation** does nothing.

This is because the `scrollToSection` function in both the Navbar and Footer tries to find HTML elements (e.g., `#portals`, `#integrations`) on the **current page**, but those elements only exist on the Landing page (`/`). When you're on `/features`, there's no `<div id="portals">` so nothing happens.

## Solution

Two changes are needed:

### 1. Smart navigation in Navbar and Footer
When clicking a hash link (e.g., `#portals`):
- If the user is already on the landing page (`/`): scroll to the section as usual
- If the user is on any other page (e.g., `/features`): navigate back to `/` with the hash in the URL, so the landing page knows where to scroll

### 2. Landing page listens for hash on mount
When the Landing page loads, it checks the URL hash (e.g., `/#portals`) and automatically scrolls to that section after a short delay (to let the page render first).

## Files to Modify

| File | Change |
|------|--------|
| `src/components/landing/Navbar.tsx` | Import `useLocation`; update `scrollToSection` to check `location.pathname === '/'` before scrolling -- if not on landing, navigate to `/{hash}` instead |
| `src/components/landing/FooterSection.tsx` | Import `useLocation` and `useNavigate`; update `scrollToSection` to check if on landing page -- if not, navigate to `/#sectionId` |
| `src/pages/Landing.tsx` | Add a `useEffect` that reads `window.location.hash` on mount, scrolls to the matching section with a small delay, then clears the hash |

## Technical Details

**Navbar.tsx** -- Updated `scrollToSection`:
```typescript
import { useNavigate, useLocation } from 'react-router-dom';

const location = useLocation();

const scrollToSection = (href: string) => {
  setIsMobileMenuOpen(false);
  if (href.startsWith('#')) {
    if (location.pathname === '/') {
      // Already on landing -- scroll directly
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      // On a sub-page -- navigate to landing with hash
      navigate('/' + href);
    }
    return;
  }
  navigate(href);
};
```

**FooterSection.tsx** -- same logic applied to its scroll handler:
```typescript
import { useNavigate, useLocation } from 'react-router-dom';

const navigate = useNavigate();
const location = useLocation();

const scrollToSection = (id: string) => {
  if (location.pathname === '/') {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  } else {
    navigate('/#' + id);
  }
};
```

**Landing.tsx** -- Hash scroll on mount:
```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const location = useLocation();

useEffect(() => {
  if (location.hash) {
    const id = location.hash.substring(1);
    // Small delay to let the page render
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
    return () => clearTimeout(timer);
  }
}, [location.hash]);
```

This ensures all navigation links work correctly from any page, in any language, since the content on the landing page is already translated.
