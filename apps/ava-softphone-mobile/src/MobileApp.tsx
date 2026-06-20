import { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
// Re-use battle-tested SIP hook from the desktop app
import { useSoftphone } from './hooks/useSoftphone';
import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import CallsScreen from './screens/CallsScreen';
import AVAChatScreen from './screens/AVAChatScreen';
import TeamChatScreen from './screens/TeamChatScreen';
import MoreScreen from './screens/MoreScreen';
import VoicemailScreen from './screens/VoicemailScreen';
import ContactsScreen from './screens/ContactsScreen';
import MessagesScreen from './screens/MessagesScreen';
import MessagesHubScreen from './screens/MessagesHubScreen';
import QueuesScreen from './screens/QueuesScreen';
import SettingsScreen from './screens/SettingsScreen';
import BottomTabs, { Tab } from './components/BottomTabs';
import ActiveCallSheet from './components/ActiveCallSheet';
import SplashAva from './components/SplashAva';
import PermissionGate from './components/PermissionGate';
import DialerFab from './components/DialerFab';
import SyncIndicator from './components/SyncIndicator';
import ProfileSheet from './components/ProfileSheet';
import { useRealtimeCDR } from './hooks/useRealtimeCDR';
import { initBackgroundSync } from './lib/backgroundSync';
import { useNotificationCounts } from './hooks/useNotificationCounts';
import { useStoredCreds, Creds, ensureStoredOrganizationId, hydrateSoftphoneCredentials } from './lib/creds';
import { gradients, colors } from './lib/theme';
import { ThemeProvider } from './lib/ThemeContext';
import { MobileI18nProvider } from './lib/i18n';
import { requestAllPermissions, checkAllPermissions } from './lib/permissions';
import { registerPush, sendPushTokenToBackend } from './lib/pushNotifications';
import { syncDeviceContacts } from './lib/contacts';
import { bootNative, onAppStateChange } from './lib/nativeBoot';
import { registerDeepLinkHandler } from './lib/deepLink';
import { configureMobileApi } from './lib/mobileApi';
import { configureAudit, audit } from './lib/audit';
import { edgeCall } from './lib/mobileSupabase';
import PerfOverlay from './components/PerfOverlay';
import { startPrefetch } from './lib/prefetch';

const isPreviewMode = (() => {
  try { return new URLSearchParams(window.location.search).get('preview') === '1'; }
  catch { return false; }
})();

export default function MobileApp() {
  const { creds, setCreds, clearCreds, loading } = useStoredCreds();
  const ALL_TABS: Tab[] = ['home','calls','ava','messages','more','voicemail','contacts','sms','queues','settings'];
  const initialTab = (() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      if (t && ALL_TABS.includes(t)) return t;
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
    // Préchargement opportuniste des écrans les plus consultés.
    try { startPrefetch(); } catch {}
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
  if (!creds) return <MobileI18nProvider><ThemeProvider><AuthScreen onAuthenticated={setCreds} /></ThemeProvider></MobileI18nProvider>;

  return <MobileI18nProvider><ThemeProvider><AuthenticatedShell creds={creds} setCreds={setCreds} tab={tab} setTab={setTab} onSignOut={clearCreds} /></ThemeProvider></MobileI18nProvider>;
}

function AuthenticatedShell({
  creds, setCreds, tab, setTab, onSignOut,
}: { creds: Creds; setCreds: (c: Creds) => void; tab: Tab; setTab: (t: Tab) => void; onSignOut: () => void }) {

  const [permsGateDone, setPermsGateDone] = useState<boolean | null>(isPreviewMode ? true : null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [freshCredentialToken, setFreshCredentialToken] = useState('');
  const passwordHealRef = useRef('');
  const hydratedTokenRef = useRef('');

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

  // Build SIP config from the same backend credentials used by desktop/portal,
  // but keep the mobile transport pinned to CA-signed WSS endpoints.
  const sipPassword = creds.sipPassword;
  const WORKING_WSS = [
    'wss://node.lemtelcloud.net:7444',
    'wss://pbxnode.lemtel.tel:7444',
  ];
  const sipDomain = creds.sipDomain || 'lemtel.lemtel.tel';
  // credentialsReady: true once we have extension + password, regardless of token freshness
  // The freshCredentialToken check was blocking SIP from ever starting
  const credentialsReady = !!(creds.extension && sipPassword);

  const sipConfig = credentialsReady && creds.extension && sipPassword
    ? {
        extension: creds.extension,
        displayName: creds.displayName || creds.email || 'User',
        password: sipPassword,
        domain: sipDomain,
        wssUrl: WORKING_WSS[0],
        wssUrls: WORKING_WSS,
        authUsername: creds.authUsername || creds.extension,
      }
    : null;

  console.log('[SIP] sipConfig:', sipConfig
    ? `ext=${sipConfig.extension} domain=${sipConfig.domain} wss=${sipConfig.wssUrl}`
    : 'NULL - missing: ' + [
        !creds.extension && 'extension',
        !sipPassword && 'password',
      ].filter(Boolean).join(', '));
  const softphone = useSoftphone(sipConfig);

  useEffect(() => {
    if (!creds.accessToken || !creds.extension || !softphone.sipError) return;
    if (!/authentication failed|403|401|407|forbidden|unauthor/i.test(softphone.sipError)) return;
    const key = `${creds.userId || creds.email}:${creds.extension}:${softphone.sipError}`;
    if (passwordHealRef.current === key) return;
    passwordHealRef.current = key;
    edgeCall('softphone-sync-password', creds.accessToken, { force_local_to_pbx: false })
      .then(() => hydrateSoftphoneCredentials('mobile'))
      .then((next) => { if (next) setCreds(next); })
      .catch((e) => console.warn('[SIP] password auto-sync failed', e?.message || e));
  }, [creds.accessToken, creds.email, creds.extension, creds.userId, setCreds, softphone.sipError]);

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
      sipConfig,
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
      reconnect: softphone.reconnect,
      lastPersistedError: softphone.lastPersistedError,
      sipLog: softphone.sipLog,
      clearSipLog: softphone.clearSipLog,
      clearSipState: softphone.clearSipState,
      retryAttempt: softphone.retryAttempt,
      nextRetryAt: softphone.nextRetryAt,
      retryLimitReached: softphone.retryLimitReached,
      setAudioEl: (_el: HTMLAudioElement | null) => {},
      transfer: (_target?: string) => {},
      park: () => {},
      startRecord: () => {},
      stopRecord: () => {},
    };
  }, [softphone, sipConfig]);

  const notif = useNotificationCounts({
    accessToken: creds.accessToken,
    organizationId: creds.organizationId,
    userId: creds.userId,
  });




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
    // Desktop/portal always fetch fresh SIP credentials from the backend.
    // Do the same on mobile once per session so stale cached SIP passwords from
    // prior logins cannot keep causing PBX auth failures.
    if (creds.accessToken && hydratedTokenRef.current !== creds.accessToken) {
      hydratedTokenRef.current = creds.accessToken;
      hydrateSoftphoneCredentials('mobile').then((next) => {
        if (next) setCreds(next);
        else if (!creds.organizationId) ensureStoredOrganizationId().catch(() => {});
        setFreshCredentialToken(creds.accessToken || '');
      }).catch(() => { setFreshCredentialToken(creds.accessToken || ''); });
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
      position: 'relative',
    }}>
      <audio ref={audioRef} autoPlay playsInline />
      <SyncIndicator />


      <div key={tab} className="lemtel-page-enter" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<div style={{ flex: 1 }} />}>
          {tab === 'home'       && <DashboardScreen onNavigate={setTab as any} haptic={haptic} onOpenProfile={() => setProfileOpen(true)} />}
          {tab === 'calls'      && <CallsScreen sp={sp} haptic={haptic} creds={creds} />}
          {tab === 'ava'        && <AVAChatScreen />}
          {tab === 'messages'   && <MessagesHubScreen accessToken={creds.accessToken || null} userId={creds.userId} sp={sp} haptic={haptic} channelUnread={notif.channelUnread} />}
          {tab === 'settings'   && <SettingsScreen creds={creds} sp={sp} onSignOut={onSignOut} onNavigate={setTab as any} />}
          {/* legacy deep-link routes */}
          {tab === 'more'       && <MoreScreen creds={creds} sp={sp} onSignOut={onSignOut} haptic={haptic} />}
          {tab === 'voicemail'  && <VoicemailScreen haptic={haptic} />}
          {tab === 'contacts'   && <ContactsScreen sp={sp} />}
          {tab === 'sms'        && <MessagesScreen haptic={haptic} />}
          {tab === 'queues'     && <QueuesScreen />}
        </Suspense>
      </div>

      <BottomTabs
        active={tab}
        onChange={(t) => {
          haptic(ImpactStyle.Light);
          if (t === 'calls') notif.markSeen('calls');
          if (t === 'voicemail') notif.markSeen('voicemail');
          setTab(t);
        }}
        badges={{
          calls: notif.missedCalls + notif.voicemails,
          messages: notif.messages,
          voicemail: notif.voicemails,
        }}
      />

      {!inCall && <DialerFab sp={sp} haptic={haptic} />}
      {inCall && <ActiveCallSheet sp={sp} haptic={haptic} />}

      {profileOpen && (
        <ProfileSheet
          creds={creds}
          onClose={() => setProfileOpen(false)}
          onSignOut={() => { setProfileOpen(false); onSignOut(); }}
          onCredsUpdate={setCreds}
        />
      )}
    </div>
  );
}

