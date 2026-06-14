import React from 'react';
import { createRoot } from 'react-dom/client';
// Side-effect import: throws at boot if a production build was bundled with
// VITE_AVA_MOCK=true. Must run before any UI mounts.
import './lib/buildGuard';
import App from './App';
import { ThemeProvider } from './lib/theme';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import DemoModeBanner from './components/DemoModeBanner';
import './styles/animations.css';

// Renderer-level safety net: never let an unhandled rejection or window error
// bubble up to Electron and trigger render-process-gone (black screen).
window.addEventListener('unhandledrejection', (e) => {
  // eslint-disable-next-line no-console
  console.error('[renderer] unhandled rejection:', e.reason);
  e.preventDefault();
  try {
    (window as any).electronAPI?.logRendererCrash?.({
      scope: 'unhandledrejection',
      message: String((e.reason as any)?.message || e.reason),
      stack: (e.reason as any)?.stack,
    });
  } catch { /* noop */ }
});
window.addEventListener('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[renderer] window error:', e.error || e.message);
  try {
    (window as any).electronAPI?.logRendererCrash?.({
      scope: 'window-error',
      message: e.message,
      stack: (e.error as any)?.stack,
    });
  } catch { /* noop */ }
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <DemoModeBanner />
        <App />
      </ThemeProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);


