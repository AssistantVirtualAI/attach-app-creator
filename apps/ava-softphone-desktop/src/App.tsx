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
  const [creds, setCreds] = useState<Creds>(null);
  const [loading, setLoading] = useState(true);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 980);

  useEffect(() => {
    window.electronAPI?.getCredentials().then((c: any) => {
      setCreds(c);
      setLoading(false);
    });
    window.electronAPI?.onSetStatus?.((s: any) => {
      window.dispatchEvent(new CustomEvent('lemtel:set-status', { detail: s }));
    });
    const onResize = () => setWide(window.innerWidth >= 980);
    window.addEventListener('resize', onResize);

    // Proactively request microphone (required), camera (optional), and
    // verify speaker enumeration so the OS prompts surface at app launch.
    import('./lib/mediaPermissions').then(({ requestMediaPermissions }) => {
      requestMediaPermissions().catch(() => { /* noop */ });
    });

    return () => window.removeEventListener('resize', onResize);
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
      <TitleBar />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {wide ? (
          <ConsoleLayout creds={creds} onOpenSettings={openSettingsMobile} />
        ) : (
          <SoftphonePane creds={creds} onOpenSettings={openSettingsMobile} />
        )}
      </div>
      <UpdateBanner />
    </div>
  );
}

