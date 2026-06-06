import React, { useEffect, useRef, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
// Re-use battle-tested SIP hook from the desktop app
import { useSoftphone } from '@desktop/hooks/useSoftphone';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import CallsScreen from './screens/CallsScreen';
import MessagesScreen from './screens/MessagesScreen';
import AIScreen from './screens/AIScreen';
import SettingsScreen from './screens/SettingsScreen';
import BottomTabs, { Tab } from './components/BottomTabs';
import ActiveCallSheet from './components/ActiveCallSheet';
import SplashAva from './components/SplashAva';
import PermissionGate from './components/PermissionGate';
import { useStoredCreds, Creds } from './lib/creds';
import { gradients, colors } from './lib/theme';
import { requestAllPermissions, checkAllPermissions } from './lib/permissions';
import { registerPush, sendPushTokenToBackend } from './lib/pushNotifications';
import { syncDeviceContacts } from './lib/contacts';
import { bootNative, onAppStateChange } from './lib/nativeBoot';
import { configureMobileApi } from './lib/mobileApi';

export default function MobileApp() {
  const { creds, setCreds, clearCreds, loading } = useStoredCreds();
  const [tab, setTab] = useState<Tab>('home');
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    bootNative().finally(() => {
      // Keep the AVA splash visible briefly for brand polish.
      setTimeout(() => setBooting(false), 700);
    });
  }, []);

  if (loading || booting) return <SplashAva />;
  if (!creds) return <AuthScreen onAuthenticated={setCreds} />;

  return <AuthenticatedShell creds={creds} tab={tab} setTab={setTab} onSignOut={clearCreds} />;
}

function AuthenticatedShell({
  creds, tab, setTab, onSignOut,
}: { creds: Creds; tab: Tab; setTab: (t: Tab) => void; onSignOut: () => void }) {
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

  // Configure the mobile API client with the signed-in portal + access token.
  useEffect(() => {
    configureMobileApi({
      portalUrl: (creds as any).portalUrl || 'https://avastatistic.ca',
      accessToken: creds.accessToken || null,
    });
  }, [creds]);

  // Request mic / speaker / contacts / notifications once the user is in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const perms = await requestAllPermissions();
      if (cancelled) return;

      // Push notifications — register token with backend.
      registerPush({
        onToken: async (token, platform) => {
          await sendPushTokenToBackend({
            token, platform,
            portalUrl: (creds as any).portalUrl || 'https://avastatistic.ca',
            accessToken: creds.accessToken || '',
            extension: creds.extension,
          });
        },
        onAction: (p) => {
          // Deep-link: tap a push to open the right tab.
          const kind = p.data?.kind;
          if (kind === 'sms') setTab('messages');
          else if (kind === 'voicemail' || kind === 'missed') setTab('calls');
        },
      });

      // Contacts sync — for dialer autocomplete.
      if (perms.contacts === 'granted') {
        syncDeviceContacts().catch(() => {});
      }
    })();

    // Re-register SIP when app comes back to foreground.
    let unsub: () => void = () => {};
    onAppStateChange((active) => { if (active) sp.reconnect?.(); }).then((u) => { unsub = u; });

    return () => { cancelled = true; unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds.extension]);

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
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: gradients.app,
      paddingTop: 'var(--safe-top)',
      paddingBottom: 'var(--safe-bottom)',
      color: colors.textIce,
    }}>
      <audio ref={audioRef} autoPlay playsInline />

      <div key={tab} className="lemtel-page-enter" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'home'     && <HomeScreen onNavigate={setTab} haptic={haptic} />}
        {tab === 'calls'    && <CallsScreen sp={sp} haptic={haptic} />}
        {tab === 'messages' && <MessagesScreen haptic={haptic} />}
        {tab === 'ai'       && <AIScreen />}
        {tab === 'settings' && <SettingsScreen creds={creds} sp={sp} onSignOut={onSignOut} />}
      </div>

      <BottomTabs active={tab} onChange={(t) => { haptic(ImpactStyle.Light); setTab(t); }} />

      {inCall && <ActiveCallSheet sp={sp} haptic={haptic} />}
    </div>
  );
}
