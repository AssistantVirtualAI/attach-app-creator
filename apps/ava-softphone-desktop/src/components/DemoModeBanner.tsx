import React from 'react';
import { isMockMode } from '../lib/buildGuard';

/**
 * Visible strip shown whenever the app is running with VITE_AVA_MOCK=true.
 * Production builds can never reach this state (see buildGuard.ts).
 */
export default function DemoModeBanner() {
  if (!isMockMode()) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: '#facc15',
        color: '#1f1300',
        fontSize: 12,
        fontWeight: 700,
        padding: '6px 12px',
        textAlign: 'center',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(0,0,0,0.15)',
        zIndex: 9999,
      }}
    >
      Mode démonstration — données fictives
    </div>
  );
}
