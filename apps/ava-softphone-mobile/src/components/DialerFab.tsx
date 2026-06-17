import React, { useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import DialerScreen from '../screens/DialerScreen';
import { colors, gradients, shadow } from '../lib/theme';

/**
 * Floating dialer button shown above the bottom tab bar on every tab.
 * Opens a full-screen keypad modal wired to the existing softphone.
 */
export default function DialerFab({
  sp,
  haptic,
}: {
  sp: any;
  haptic: (s?: ImpactStyle) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          haptic(ImpactStyle.Medium);
          setOpen(true);
        }}
        aria-label="Open keypad"
        style={{
          position: 'fixed',
          right: 18,
          bottom: `calc(96px + var(--safe-bottom))`,
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: gradients.shinyPrimary,
          color: '#fff',
          fontSize: 26,
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
          boxShadow: shadow.lift,
          zIndex: 60,
        }}
      >
        ⌨
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(10,18,40,0.86)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 'var(--safe-top)',
            paddingBottom: 'var(--safe-bottom)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Keypad</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close keypad"
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                width: 36,
                height: 36,
                fontSize: 18,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <DialerScreen sp={sp} haptic={haptic} />
          </div>
        </div>
      )}
    </>
  );
}
