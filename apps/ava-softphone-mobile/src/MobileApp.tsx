import { useEffect, useMemo, useRef, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
// Re-use battle-tested SIP hook from the desktop app
import { useSoftphone } from './hooks/useSoftphone';
import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import CallsScreen from './screens/CallsScreen';
import AVAChatScreen from './screens/AVAChatScreen';
import InboxScreen from './screens/InboxScreen';
import MoreScreen from './screens/MoreScreen';
import BottomTabs, { Tab } from './components/BottomTabs';
import ActiveCallSheet from './components/ActiveCallSheet';
import SplashAva from './components/SplashAva';
import PermissionGate from './components/PermissionGate';
import DialerFab from './components/DialerFab';
import RealtimeStatusPill from './components/RealtimeStatusPill';
import { useRealtimeCDR } from './hooks/useRealtimeCDR';
import { initBackgroundSync } from './lib/backgroundSync';
import { useStoredCreds, Creds, ensureStoredOrganizationId, hydrateSoftphoneCredentials } from './lib/creds';
import { gradients, colors } from './lib/theme';
import { requestAllPermissions, checkAllPermissions } from './lib/permissions';
import { registerPush, sendPushTokenToBackend } from './lib/pushNotifications';
import { syncDeviceContacts } from './lib/contacts';
import { bootNative, onAppStateChange } from './lib/nativeBoot';
import { registerDeepLinkHandler } from './lib/deepLink';
import { configureMobileApi } from './lib/mobileApi';
import { configureAudit, audit } from './lib/audit';

const isPreviewMode = (() => {
  try { return new URLSearchParams(window.location.search).get('preview') === '1'; }
  catch { return false; }
})();

export default function MobileApp() {
  const { creds, setCreds, clearCreds, loading } = useStoredCreds();
  const initialTab = (() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'home' || t === 'calls' || t === 'ava' || t === 'messages' || t === 'more') return t as Tab;
    } catch {}
    return 'home' as Tab;
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [booting, setBooting] = useState(!isPreviewMode);

  useEffect(() => {
    bootNative().finally(() => {
      setTimeout(() => setBooting(false), 700);
    });
    initBackgroundSync().catch(() => {});
    let unsubDeepLink: (() => void) | undefined;
    registerDeepLinkHandler().then((u) => { unsubDeepLink = u; }).catch(() => {});

    // Accept navigation commands from /mobile-preview host.
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== 'ava-preview') return;
      if (d.type === 'set-tab' && typeof d.tab === 'string') setTab(d.tab as Tab);
    };
    window.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('message', onMsg);
      unsubDeepLink?.();
    };
  }, []);


  if (loading || booting) return <SplashAva />;
  if (!creds) return <AuthScreen onAuthenticated={setCreds} />;

  return <AuthenticatedShell creds={creds} setCreds={setCreds} tab={tab} setTab={setTab} onSignOut={clearCreds} />;
}

function AuthenticatedShell({
  creds, setCreds, tab, setTab, onSignOut,
}: { creds: Creds; setCreds: (c: Creds) => void; tab: Tab; setTab: (t: Tab) => void; onSignOut: () => void }) {

  const [permsGateDone, setPermsGateDone] = useState<boolean | null>(isPreviewMode ? true : null);

  // Decide whether to show the onboarding permission gate.
  useEffect(() => {
    if (isPreviewMode) return;
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

  // Configure the mobile API client with the Supabase Edge Functions host
  // (NOT the marketing portal URL — edge functions live on supabase.co).
  useEffect(() => {
    const SUPABASE_URL =
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      'https://gejxisrqtvxavbrfcoxz.supabase.co';
    const SUPABASE_ANON =
      (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';
    configureMobileApi({
      portalUrl: SUPABASE_URL,
      accessToken: creds.accessToken || null,
      anonKey: SUPABASE_ANON,
    });
    configureAudit(async () => creds.accessToken || null);
    if (creds.accessToken) audit('softphone.signed_in', creds.userId, { extension: creds.extension });
    // Hydrate full SIP credentials (extension, sip_domain, wss_url, password,
    // org, role) from softphone-credentials so Settings displays real data and
    // SIP can register — covers email-only sign-ins and legacy sessions.
    const missing = !creds.organizationId || !creds.extension || !creds.sipDomain || !creds.wssUrl || !creds.sipPassword;
    if (creds.accessToken && missing) {
      hydrateSoftphoneCredentials('mobile').then((next) => {
        if (next) setCreds(next);
        else if (!creds.organizationId) ensureStoredOrganizationId().catch(() => {});
      }).catch(() => {});
    }
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

      <RealtimeHeader creds={creds} />

      <div key={tab} className="lemtel-page-enter" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'home'     && <DashboardScreen onNavigate={setTab as any} haptic={haptic} />}
        {tab === 'calls'    && <CallsScreen sp={sp} haptic={haptic} creds={creds} />}
        {tab === 'ava'      && <AVAChatScreen />}
        {tab === 'messages' && <InboxScreen haptic={haptic} />}
        {tab === 'more'     && <MoreScreen creds={creds} sp={sp} onSignOut={onSignOut} haptic={haptic} />}
      </div>

      <BottomTabs active={tab} onChange={(t) => { haptic(ImpactStyle.Light); setTab(t); }} />

      {!inCall && <DialerFab sp={sp} haptic={haptic} />}
      {inCall && <ActiveCallSheet sp={sp} haptic={haptic} />}
    </div>
  );
}

function RealtimeHeader({ creds }: { creds: Creds }) {
  const { transport, warning, lastSyncAt, nextRetryAt, syncLog, retryNow } = useRealtimeCDR(creds);
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
      padding: '4px 12px 0',
    }}>
      <RealtimeStatusPill
        transport={transport}
        warning={warning}
        lastSyncAt={lastSyncAt}
        nextRetryAt={nextRetryAt}
        syncLog={syncLog}
        onRefresh={retryNow}
      />
    </div>
  );
}
