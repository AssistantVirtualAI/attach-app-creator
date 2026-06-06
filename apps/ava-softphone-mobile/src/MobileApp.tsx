import React, { useEffect, useRef, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
// Re-use battle-tested SIP hook from the desktop app
import { useSoftphone } from '@desktop/hooks/useSoftphone';
import AuthScreen from './screens/AuthScreen';
import DialerScreen from './screens/DialerScreen';
import RecentsScreen from './screens/RecentsScreen';
import ContactsScreen from './screens/ContactsScreen';
import VoicemailScreen from './screens/VoicemailScreen';
import SettingsScreen from './screens/SettingsScreen';
import BottomTabs, { Tab } from './components/BottomTabs';
import ActiveCallSheet from './components/ActiveCallSheet';
import { useStoredCreds, Creds } from './lib/creds';

export default function MobileApp() {
  const { creds, setCreds, clearCreds, loading } = useStoredCreds();
  const [tab, setTab] = useState<Tab>('dial');

  if (loading) {
    return (
      <div style={loadingStyle}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    );
  }

  if (!creds) {
    return <AuthScreen onAuthenticated={setCreds} />;
  }

  return <AuthenticatedShell creds={creds} tab={tab} setTab={setTab} onSignOut={clearCreds} />;
}

function AuthenticatedShell({
  creds,
  tab,
  setTab,
  onSignOut,
}: {
  creds: Creds;
  tab: Tab;
  setTab: (t: Tab) => void;
  onSignOut: () => void;
}) {
  const sp = useSoftphone({
    extension: creds.extension,
    displayName: creds.displayName,
    sipDomain: creds.sipDomain,
    wssUrl: creds.wssUrl,
    accessToken: creds.accessToken,
    refreshToken: creds.refreshToken,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { sp.setAudioEl(audioRef.current); }, [sp]);

  const inCall =
    sp.snap.callState === 'active' ||
    sp.snap.callState === 'held' ||
    sp.snap.callState === 'ringing-in' ||
    sp.snap.callState === 'ringing-out';

  const haptic = async (style: ImpactStyle = ImpactStyle.Light) => {
    if (Capacitor.isNativePlatform()) {
      try { await Haptics.impact({ style }); } catch {}
    }
  };

  return (
    <div style={shellStyle}>
      <audio ref={audioRef} autoPlay playsInline />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'dial' && <DialerScreen sp={sp} haptic={haptic} />}
        {tab === 'recents' && <RecentsScreen sp={sp} />}
        {tab === 'contacts' && <ContactsScreen sp={sp} />}
        {tab === 'voicemail' && <VoicemailScreen />}
        {tab === 'settings' && <SettingsScreen creds={creds} sp={sp} onSignOut={onSignOut} />}
      </div>

      <BottomTabs active={tab} onChange={(t) => { haptic(ImpactStyle.Light); setTab(t); }} />

      {inCall && <ActiveCallSheet sp={sp} haptic={haptic} />}
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: 'linear-gradient(180deg, #07091a 0%, #0f1330 40%, #161b3f 100%)',
  paddingTop: 'var(--safe-top)',
  paddingBottom: 'var(--safe-bottom)',
};

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  background: 'var(--bg-0)',
};
