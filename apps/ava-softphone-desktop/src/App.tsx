import React, { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar';
import SetupWizard from './components/SetupWizard';
import UpdateBanner from './components/UpdateBanner';
import SoftphonePane from './components/SoftphonePane';
import ConsoleLayout from './components/console/ConsoleLayout';
import BrightnessOverlay from './components/BrightnessOverlay';
import ResponsiveLab from './components/ResponsiveLab';
import { useTheme } from './lib/theme';
import { useContrast } from './hooks/useContrast';
import { supabase } from './lib/supabaseClient';
import { sipProvider } from './lib/sip/jssipProvider';

const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const IS_LAB = qs?.get('lab') === 'responsive';
const IS_EMBED = qs?.get('embed') === '1';


type Creds = {
  portalUrl: string;
  email: string;
  extension: string;
  displayName?: string;
  sipDomain?: string;
  wssUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
} | null;

export default function App() {
  const { t } = useTheme();
  useContrast(); // applies low/med/high contrast preset on mount

  // Responsive testing utility — visit ?lab=responsive to open it.
  if (IS_LAB) return <ResponsiveLab />;

  const [creds, setCreds] = useState<Creds>(null);
  const [loading, setLoading] = useState(true);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 980);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const saved = await window.electronAPI?.getCredentials?.().catch(() => null);

      // Restore session from saved tokens BEFORE checking session
      if (saved?.accessToken && saved?.refreshToken) {
        await supabase.auth.setSession({
          access_token: saved.accessToken,
          refresh_token: saved.refreshToken,
        }).catch(() => { /* token expired — fall through */ });
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        // No valid session → force login wizard
        if (saved) await window.electronAPI?.saveCredentials?.(null).catch(() => {});
        setCreds(null);
      } else if (saved) {
        // Refresh stored tokens in case they rotated
        setCreds({
          ...saved,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        });
      } else {
        setCreds(null);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        try { await sipProvider.stop?.(); } catch { /* noop */ }
        await window.electronAPI?.saveCredentials?.(null).catch(() => {});
        setCreds(null);
        return;
      }
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setCreds((prev) => prev ? {
          ...prev,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        } : prev);
      }
    });

    window.electronAPI?.onSetStatus?.((s: any) => {
      window.dispatchEvent(new CustomEvent('lemtel:set-status', { detail: s }));
    });
    const onResize = () => setWide(window.innerWidth >= 980);
    window.addEventListener('resize', onResize);

    import('./lib/mediaPermissions').then(({ requestMediaPermissions }) => {
      requestMediaPermissions().catch(() => { /* noop */ });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const openSettingsMobile = () => {
    // On narrow viewports the console layout is hidden; just reload after clearing.
    // The SoftphonePane keeps its own simpler settings affordance.
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: t.bgGradient, color: t.textMuted, fontSize: 13,
      }}>
        Loading…
      </div>
    );
  }

  if (!creds) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: t.bg, position: 'relative' }}>
        <BrightnessOverlay />
        <TitleBar />
        <div style={{ flex: 1, overflow: 'auto', position: 'relative', zIndex: 1 }}>
          <SetupWizard onComplete={(c: any) => setCreds(c)} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: t.bg, position: 'relative' }}>
      <BrightnessOverlay />
      {!IS_EMBED && <TitleBar />}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {wide && !IS_EMBED ? (
          <ConsoleLayout creds={creds} onOpenSettings={openSettingsMobile} />
        ) : (
          <SoftphonePane creds={creds} onOpenSettings={openSettingsMobile} />
        )}
      </div>
      {!IS_EMBED && <UpdateBanner />}
    </div>
  );
}

