import React, { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar';
import SetupWizard from './components/SetupWizard';
import SettingsPage from './components/SettingsPage';
import UpdateBanner from './components/UpdateBanner';
import SoftphonePane from './components/SoftphonePane';
import { useTheme } from './lib/theme';

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
  const [creds, setCreds] = useState<Creds>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'phone' | 'settings'>('phone');

  useEffect(() => {
    window.electronAPI?.getCredentials().then((c: any) => {
      setCreds(c);
      setLoading(false);
    });
    window.electronAPI?.onSetStatus?.((s: any) => {
      window.dispatchEvent(new CustomEvent('lemtel:set-status', { detail: s }));
    });
  }, []);

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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: t.bg }}>
        <TitleBar />
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <SetupWizard onComplete={(c: any) => setCreds(c)} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: t.bg }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {view === 'settings' ? (
          <SettingsPage
            creds={creds}
            onSignOut={async () => {
              await window.electronAPI.clearCredentials();
              setCreds(null);
            }}
            onBack={() => setView('phone')}
          />
        ) : (
          <SoftphonePane creds={creds} onOpenSettings={() => setView('settings')} />
        )}
      </div>
      <UpdateBanner />
    </div>
  );
}
