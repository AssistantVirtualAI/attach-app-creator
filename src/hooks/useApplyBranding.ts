import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

function hexToHsl(hex: string): string | null {
  const m = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function setFavicon(url: string) {
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

/**
 * Applies an organization's white-label branding (primary color, favicon, title)
 * to the current document. Reverts to defaults on unmount or org change.
 */
export function useApplyBranding(organizationId: string | null | undefined) {
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    const root = document.documentElement;
    const originalPrimary = root.style.getPropertyValue('--primary');
    const originalTitle = document.title;
    const originalFavicon = (document.querySelector("link[rel='icon']") as HTMLLinkElement | null)?.href;

    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('primary_color, favicon_url, website_title, name')
        .eq('id', organizationId)
        .maybeSingle();
      if (cancelled || !data) return;

      if (data.primary_color) {
        const hsl = hexToHsl(data.primary_color);
        if (hsl) root.style.setProperty('--primary', hsl);
      }
      if (data.favicon_url) setFavicon(data.favicon_url);
      const title = data.website_title || data.name;
      if (title) document.title = title;
    })();

    return () => {
      cancelled = true;
      if (originalPrimary) root.style.setProperty('--primary', originalPrimary);
      else root.style.removeProperty('--primary');
      if (originalTitle) document.title = originalTitle;
      if (originalFavicon) setFavicon(originalFavicon);
    };
  }, [organizationId]);
}
