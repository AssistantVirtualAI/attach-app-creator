import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { WHITELABEL } from '../whitelabel.config';

type Creds = { portalUrl: string; email: string; extension: string };

export default function SetupWizard({
  onComplete,
}: {
  onComplete: (c: Creds) => void;
}) {
  const [portalUrl, setPortalUrl] = useState(WHITELABEL.portalUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [hoverBtn, setHoverBtn] = useState(false);

  async function connect() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient(WHITELABEL.supabaseUrl, WHITELABEL.supabaseAnonKey);
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr || !data.user) throw signErr ?? new Error('Sign-in failed');

      const { data: row, error: rowErr } = await supabase
        .from('pbx_softphone_users')
        .select('extension')
        .eq('portal_user_id', data.user.id)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row?.extension) {
        throw new Error('No softphone account found. Contact your administrator.');
      }

      await window.electronAPI.saveCredentials({
        portalUrl,
        email,
        extension: String(row.extension),
      });
      onComplete({ portalUrl, email, extension: String(row.extension) });
    } catch (e: any) {
      setError(e?.message ?? 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (key: string): React.CSSProperties => ({
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.08)',
    border: `1px solid ${focused === key ? WHITELABEL.accentColor : 'rgba(255,255,255,0.15)'}`,
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: WHITELABEL.backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* TOP */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 60,
        }}
      >
        <LemtelLogo />
        <div style={{ height: 32 }} />
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: 0 }}>
          {WHITELABEL.appName}
        </h1>
        <div
          style={{
            color: WHITELABEL.accentColor,
            fontSize: 13,
            letterSpacing: 1,
            marginTop: 6,
          }}
        >
          {WHITELABEL.tagline.toUpperCase()}
        </div>
        <div style={{ height: 8 }} />
        <div
          style={{
            width: 40,
            height: 2,
            background: WHITELABEL.accentColor,
          }}
        />
      </div>

      {/* MIDDLE */}
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,215,0,0.2)',
          borderRadius: 16,
          padding: 32,
          margin: '32px 24px',
        }}
      >
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
          Connect Your Account
        </h2>
        <p style={{ color: '#888', fontSize: 13, margin: '6px 0 0' }}>
          Sign in with your AVA portal credentials
        </p>

        <div style={{ height: 24 }} />

        <Label>AVA Portal URL</Label>
        <input
          style={inputStyle('url')}
          value={portalUrl}
          onChange={(e) => setPortalUrl(e.target.value)}
          onFocus={() => setFocused('url')}
          onBlur={() => setFocused(null)}
        />

        <div style={{ height: 12 }} />
        <Label>Email</Label>
        <input
          style={inputStyle('email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocused('email')}
          onBlur={() => setFocused(null)}
        />

        <div style={{ height: 12 }} />
        <Label>Password</Label>
        <input
          style={inputStyle('pw')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setFocused('pw')}
          onBlur={() => setFocused(null)}
        />

        {error && (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(255,0,0,0.1)',
              border: '1px solid rgba(255,0,0,0.3)',
              borderRadius: 8,
              color: '#ff6b6b',
              padding: 12,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ height: 24 }} />

        <button
          onClick={connect}
          disabled={loading}
          onMouseEnter={() => setHoverBtn(true)}
          onMouseLeave={() => setHoverBtn(false)}
          style={{
            width: '100%',
            padding: 14,
            background: hoverBtn
              ? WHITELABEL.accentColor
              : `linear-gradient(135deg, ${WHITELABEL.primaryColor}, #0052CC)`,
            color: hoverBtn ? WHITELABEL.primaryColor : '#fff',
            border: `1px solid ${WHITELABEL.accentColor}`,
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {loading ? '⏳ Connecting...' : 'Connect & Sign In →'}
        </button>
      </div>

      {/* BOTTOM */}
      <div style={{ marginTop: 'auto', padding: 20 }}>
        <div style={{ height: 1, background: '#333', marginBottom: 16 }} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#666' }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0023e6, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              A
            </div>
            <span>Built by {WHITELABEL.providerName}</span>
          </div>
          <a
            href={WHITELABEL.providerUrl}
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI?.openExternal?.(WHITELABEL.providerUrl);
            }}
            style={{ color: WHITELABEL.accentColor, textDecoration: 'none', cursor: 'pointer' }}
          >
            {WHITELABEL.providerUrl.replace(/^https?:\/\//, '')}
          </a>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        color: '#ccc',
        fontSize: 12,
        marginBottom: 6,
        fontWeight: 500,
      }}
    >
      {children}
    </label>
  );
}

export function LemtelLogo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const w = size === 'lg' ? 180 : 60;
  const h = size === 'lg' ? 100 : 32;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: '50%',
        background: WHITELABEL.primaryColor,
        border: `${size === 'lg' ? 4 : 2}px solid ${WHITELABEL.accentColor}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: size === 'lg' ? '0 8px 32px rgba(0,61,166,0.4)' : 'none',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontWeight: 800,
          fontSize: size === 'lg' ? 24 : 10,
          letterSpacing: 1,
          lineHeight: 1,
        }}
      >
        LEMTEL
      </div>
      {size === 'lg' && (
        <div
          style={{
            color: '#fff',
            fontSize: 8,
            letterSpacing: 3,
            marginTop: 6,
          }}
        >
          COMMUNICATIONS
        </div>
      )}
    </div>
  );
}
