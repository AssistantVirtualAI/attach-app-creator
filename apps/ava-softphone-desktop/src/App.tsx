import React, { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar';
import SetupWizard from './components/SetupWizard';
import SettingsPage from './components/SettingsPage';

type Creds = { portalUrl: string; email: string; extension: string } | null;

export default function App() {
  const [creds, setCreds] = useState<Creds>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'phone' | 'settings'>('phone');

  useEffect(() => {
    window.electronAPI?.getCredentials().then((c) => {
      setCreds(c);
      setLoading(false);
    });
    window.electronAPI?.onSetStatus((s) => {
      // forward status to softphone hook (shared with web app)
      window.dispatchEvent(new CustomEvent('ava:set-status', { detail: s }));
    });
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  if (!creds) {
    return (
      <>
        <TitleBar />
        <SetupWizard onComplete={(c) => setCreds(c)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: 'auto' }}>
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
          <SoftphonePane onOpenSettings={() => setView('settings')} creds={creds} />
        )}
      </div>
    </div>
  );
}

/**
 * Thin placeholder pane. In production, import the shared softphone
 * components from the web project (SoftphoneWidget / useSoftphone) so the
 * desktop app and the in-browser widget share a single implementation.
 */
function SoftphonePane({
  onOpenSettings,
  creds,
}: {
  onOpenSettings: () => void;
  creds: { extension: string; email: string };
}) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ opacity: 0.7, fontSize: 12 }}>Signed in as {creds.email}</div>
      <h2 style={{ margin: '8px 0' }}>Extension {creds.extension}</h2>
      <p style={{ opacity: 0.6, fontSize: 13 }}>
        Softphone UI mounts here (reuses SoftphoneWidget / useSoftphone from
        the web app — same JsSIP provider, same call states).
      </p>
      <button onClick={onOpenSettings} style={btn}>
        Settings
      </button>
    </div>
  );
}

const btn: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 14px',
  background: '#0023e6',
  color: '#fff',
  border: 0,
  borderRadius: 6,
  cursor: 'pointer',
};
