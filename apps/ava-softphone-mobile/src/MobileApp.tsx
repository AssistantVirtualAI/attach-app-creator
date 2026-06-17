import { useEffect, useMemo, useRef, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
// Re-use battle-tested SIP hook from the desktop app
import { useSoftphone } from './hooks/useSoftphone';
import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import CallsScreen from './screens/CallsScreen';
import AVAChatScreen from './screens/AVAChatScreen';
import QueuesScreen from './screens/QueuesScreen';
import MoreScreen from './screens/MoreScreen';
import BottomTabs, { Tab } from './components/BottomTabs';
import ActiveCallSheet from './components/ActiveCallSheet';
import SplashAva from './components/SplashAva';
import PermissionGate from './components/PermissionGate';
import DialerFab from './components/DialerFab';
import { initBackgroundSync } from './lib/backgroundSync';
import { useStoredCreds, Creds } from './lib/creds';
import { gradients, colors } from './lib/theme';
import { requestAllPermissions, checkAllPermissions } from './lib/permissions';
import { registerPush, sendPushTokenToBackend } from './lib/pushNotifications';
import { syncDeviceContacts } from './lib/contacts';
import { bootNative, onAppStateChange } from './lib/nativeBoot';
import { configureMobileApi } from './lib/mobileApi';
import { configureAudit, audit } from './lib/audit';

export default function MobileApp() {
  const { creds, setCreds, clearCreds, loading } = useStoredCreds();
  const [tab, setTab] = useState<Tab>('home');
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    bootNative().finally(() => {
      // Keep the AVA splash visible briefly for brand polish.
      setTimeout(() => setBooting(false), 700);
    });
    // Register native background sync (no-op on web / when plugin missing).
    initBackgroundSync().catch(() => {});
  }, []);

  if (loading || booting) return <SplashAva />;
  if (!creds) return <AuthScreen onAuthenticated={setCreds} />;

  return <AuthenticatedShell creds={creds} tab={tab} setTab={setTab} onSignOut={clearCreds} />;
}

function AuthenticatedShell({
  creds, tab, setTab, onSignOut,
}: { creds: Creds; tab: Tab; setTab: (t: Tab) => void; onSignOut: () => void }) {
  const [permsGateDone, setPermsGateDone] = useState<boolean | null>(null);

  // Decide whether to show the onboarding permission gate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = localStorage.getItem('lemtel-permissions-onboarded') === '1';
        const current = await checkAllPermissions();
        if (cancelled) return;
        if (seen || current.microphone === 'granted') setPermsGateDone(true);
        else setPermsGateDone(false);
      } catch {
        if (!cancelled) setPermsGateDone(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sipConfig = creds.extension && creds.wssUrl && creds.sipDomain && (creds as any).sipPassword
    ? {
        extension: creds.extension,
        displayName: creds.displayName,
        password: (creds as any).sipPassword,
        domain: creds.sipDomain,
        wssUrl: creds.wssUrl,
      }
    : null;
  const softphone = useSoftphone(sipConfig);

  const sp = useMemo(() => {
    const richCallState = softphone.callState === 'ringing' ? 'ringing-out' : softphone.callState;
    return {
      snap: {
        status: softphone.sipStatus,
        error: softphone.sipError,
        callState: richCallState,
        startedAt: softphone.callState === 'active' ? Date.now() - softphone.callTimer * 1000 : null,
        remoteParty: softphone.activeCallNumber,
        remoteUri: softphone.activeCallNumber,
        muted: softphone.isMuted,
        recording: false,
        contacts: [],
        recents: [],
      },
      call: softphone.call,
      addCall: softphone.call,
      hangup: softphone.hangup,
      answer: softphone.answer,
      mute: softphone.mute,
      unmute: softphone.unmute,
      hold: softphone.hold,
      unhold: softphone.unhold,
      sendDtmf: softphone.sendDTMF,
      sendDTMF: softphone.sendDTMF,
      setStatus: softphone.setStatus,
      reconnect: () => softphone.setStatus('reconnect'),
      setAudioEl: (_el: HTMLAudioElement | null) => {},
      transfer: (_target?: string) => {},
      park: () => {},
      startRecord: () => {},
      stopRecord: () => {},
    };
  }, [softphone]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { sp.setAudioEl(audioRef.current); }, [sp]);

  // Configure the mobile API client with the signed-in portal + access token.
  useEffect(() => {
    configureMobileApi({
      portalUrl: (creds as any).portalUrl || 'https://avastatistic.ca',
      accessToken: creds.accessToken || null,
    });
    configureAudit(async () => creds.accessToken || null);
    if (creds.accessToken) audit('softphone.signed_in', creds.userId, { extension: creds.extension });
  }, [creds]);

  // Once the permission gate is dismissed, finalize permissions + push.
  useEffect(() => {
    if (!permsGateDone) return;
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
          if (kind === 'voicemail' || kind === 'missed' || kind === 'call') setTab('calls');
          else if (kind === 'ava') setTab('ava');
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
  }, [creds.extension, permsGateDone]);


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
  if (permsGateDone === null) return <SplashAva />;
  if (permsGateDone === false) {
    return (
      <PermissionGate onComplete={() => {
        try { localStorage.setItem('lemtel-permissions-onboarded', '1'); } catch {}
        setPermsGateDone(true);
      }} />
    );
  }


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
        {tab === 'home'   && <DashboardScreen onNavigate={setTab} haptic={haptic} />}
        {tab === 'calls'  && <CallsScreen sp={sp} haptic={haptic} />}
        {tab === 'ava'    && <AVAChatScreen />}
        {tab === 'queues' && <QueuesScreen />}
        {tab === 'more'   && <MoreScreen creds={creds} sp={sp} onSignOut={onSignOut} haptic={haptic} />}
      </div>

      <BottomTabs active={tab} onChange={(t) => { haptic(ImpactStyle.Light); setTab(t); }} />

      {!inCall && <DialerFab sp={sp} haptic={haptic} />}
      {inCall && <ActiveCallSheet sp={sp} haptic={haptic} />}
    </div>
  );
}
