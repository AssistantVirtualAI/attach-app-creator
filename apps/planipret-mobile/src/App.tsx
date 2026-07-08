/**
 * Planiprêt Mobile — Standalone Capacitor app
 * Uses the exact same shell + routes as the /mplanipret route on web.
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LanguageProvider } from '@/context/LanguageContext';

const PlanipretMobile = lazy(() => import('@/pages/planipret/PlanipretMobile'));
const MHome = lazy(() => import('@/pages/planipret/mobile/MHome'));
const MCalls = lazy(() => import('@/pages/planipret/mobile/MCalls'));
const MMessages = lazy(() => import('@/pages/planipret/mobile/MMessages'));
const MVoicemail = lazy(() => import('@/pages/planipret/mobile/MVoicemail'));
const MContacts = lazy(() => import('@/pages/planipret/mobile/MContacts'));
const MMore = lazy(() => import('@/pages/planipret/mobile/MMore'));
const MPipeline = lazy(() => import('@/pages/planipret/mobile/MPipeline'));
const MSearch = lazy(() => import('@/pages/planipret/mobile/MSearch'));
const MStats = lazy(() => import('@/pages/planipret/mobile/MStats'));
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

export default function App() {
  return (
    <LanguageProvider>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/mplanipret" replace />} />
          <Route path="/login" element={<Navigate to="/mplanipret" replace />} />
          <Route path="/mplanipret" element={<PlanipretMobile />}>
            <Route index element={<MHome />} />
            <Route path="home" element={<MHome />} />
            <Route path="calls" element={<MCalls />} />
            <Route path="messages" element={<MMessages />} />
            <Route path="voicemail" element={<MVoicemail />} />
            <Route path="contacts" element={<MContacts />} />
            <Route path="more" element={<MMore />} />
            <Route path="pipeline" element={<MPipeline />} />
            <Route path="search" element={<MSearch />} />
            <Route path="stats" element={<MStats />} />
            <Route path="ava" element={<MAvaChat />} />
            <Route path="notifications" element={<MAvaNotifications />} />
            <Route path="extension-sync" element={<MExtensionSync />} />
          </Route>
          <Route path="*" element={<Navigate to="/mplanipret" replace />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  );
}
