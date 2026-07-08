/**
 * Planiprêt Mobile — Router root (standalone, no WebView shell)
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MobileAuthScreen from '@/components/planipret/mobile/MobileAuthScreen';

const queryClient = new QueryClient();

const MHome = lazy(() => import('@/pages/planipret/mobile/MHome'));
const MCalls = lazy(() => import('@/pages/planipret/mobile/MCalls'));
const MMessages = lazy(() => import('@/pages/planipret/mobile/MMessages'));
const MVoicemail = lazy(() => import('@/pages/planipret/mobile/MVoicemail'));
const MContacts = lazy(() => import('@/pages/planipret/mobile/MContacts'));
const MPipeline = lazy(() => import('@/pages/planipret/mobile/MPipeline'));
const MSearch = lazy(() => import('@/pages/planipret/mobile/MSearch'));
const MStats = lazy(() => import('@/pages/planipret/mobile/MStats'));
const MMore = lazy(() => import('@/pages/planipret/mobile/MMore'));
const MAvaChat = lazy(() => import('@/pages/planipret/mobile/MAvaChat'));
const MAvaNotifications = lazy(() => import('@/pages/planipret/mobile/MAvaNotifications'));
const MExtensionSync = lazy(() => import('@/pages/planipret/mobile/MExtensionSync'));

function Fallback() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #060D1A 0%, #0A1425 100%)',
      color: '#2E9BDC', fontFamily: 'system-ui, sans-serif',
    }}>Chargement…</div>
  );
}

function Login() {
  const nav = useNavigate();
  // On mount, check if a session already exists → jump to /home.
  // Never block the UI: login screen renders immediately.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!cancelled && session) nav('/home', { replace: true });
      })
      .catch(() => { /* stay on /login if backend unreachable */ });
    return () => { cancelled = true; };
  }, [nav]);
  return <MobileAuthScreen onLoggedIn={() => nav('/home', { replace: true })} />;
}

function Protected({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'authed' | 'anon' | 'checking'>('checking');

  useEffect(() => {
    let mounted = true;
    // Hard 3s failsafe: if Supabase never resolves, redirect to /login.
    const timer = setTimeout(() => {
      if (mounted && state === 'checking') setState('anon');
    }, 3000);

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState(data.session ? 'authed' : 'anon');
    }).catch(() => {
      if (mounted) setState('anon');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setState(session ? 'authed' : 'anon');
    });

    return () => { mounted = false; clearTimeout(timer); sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'checking') return <Fallback />;
  if (state === 'anon') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Protected><MHome /></Protected>} />
          <Route path="/calls" element={<Protected><MCalls /></Protected>} />
          <Route path="/messages" element={<Protected><MMessages /></Protected>} />
          <Route path="/voicemail" element={<Protected><MVoicemail /></Protected>} />
          <Route path="/contacts" element={<Protected><MContacts /></Protected>} />
          <Route path="/pipeline" element={<Protected><MPipeline /></Protected>} />
          <Route path="/search" element={<Protected><MSearch /></Protected>} />
          <Route path="/stats" element={<Protected><MStats /></Protected>} />
          <Route path="/more" element={<Protected><MMore /></Protected>} />
          <Route path="/ava" element={<Protected><MAvaChat /></Protected>} />
          <Route path="/ava/notifications" element={<Protected><MAvaNotifications /></Protected>} />
          <Route path="/extension-sync" element={<Protected><MExtensionSync /></Protected>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
