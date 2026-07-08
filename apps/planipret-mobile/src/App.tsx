/**
 * Planiprêt Mobile — Router root (standalone, no WebView shell)
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import MobileAuthScreen from '@/components/planipret/mobile/MobileAuthScreen';

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
  return <MobileAuthScreen onLoggedIn={() => nav('/home', { replace: true })} />;
}

function Protected({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'authed' | 'anon'>('loading');
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState(data.session ? 'authed' : 'anon');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setState(session ? 'authed' : 'anon');
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  if (state === 'loading') return <Fallback />;
  if (state === 'anon') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<Fallback />}>
        <Routes>
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
