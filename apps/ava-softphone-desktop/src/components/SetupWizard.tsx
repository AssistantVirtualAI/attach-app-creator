import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { WHITELABEL } from '../whitelabel.config';

type Creds = {
  portalUrl: string;
  email: string;
  extension: string;
  displayName?: string;
  sipDomain?: string;
  wssUrl?: string;
  userId?: string;
  accessToken?: string;
};

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

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient(WHITELABEL.supabaseUrl, WHITELABEL.supabaseAnonKey);

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError) {
        setError(`Login failed: ${authError.message}`);
        setLoading(false);
        return;
      }

      if (!authData.user || !authData.session) {
        setError('Login failed: no session returned');
        setLoading(false);
        return;
      }

      const { data: softphoneUser, error: spError } = await supabase
        .from('pbx_softphone_users')
        .select('*')
        .eq('portal_user_id', authData.user.id)
        .maybeSingle();

      const normalizedPortalUrl = (portalUrl.trim() || WHITELABEL.portalUrl).replace(/\/+$/, '');

      if (spError || !softphoneUser) {
        const credentials: Creds = {
          portalUrl: normalizedPortalUrl,
          email: authData.user.email ?? email.trim(),
          extension: 'N/A',
          userId: authData.user.id,
          accessToken: authData.session.access_token,
        };
        await window.electronAPI?.saveCredentials?.(credentials);
        onComplete(credentials);
        return;
      }

      const credentials: Creds = {
        portalUrl: normalizedPortalUrl,
        email: authData.user.email ?? email.trim(),
        extension: String(softphoneUser.extension ?? ''),
        displayName: softphoneUser.display_name,
        sipDomain: softphoneUser.sip_domain || 'lemtel.lemtel.tel',
        wssUrl: softphoneUser.wss_url || 'wss://lemtel.lemtel.tel:7443',
        userId: authData.user.id,
        accessToken: authData.session.access_token,
      };

      await window.electronAPI?.saveCredentials?.(credentials);
      onComplete(credentials);
    } catch (err: any) {
      setError(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
          Connect your Lemtel account
        </h2>
        <p style={{ color: '#888', fontSize: 13, margin: '6px 0 0' }}>
          Sign in with your {WHITELABEL.providerName} portal credentials
        </p>

        <div style={{ height: 24 }} />

        <Label>Lemtel portal URL</Label>
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
          onClick={handleConnect}
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
          {loading ? '⏳ Connecting...' : 'Connect to Lemtel →'}
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
            <AvaLogo />
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

export function LemtelLogo() {
  return (
    <svg
      width="180"
      height="90"
      viewBox="0 0 180 90"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="90" cy="45" rx="88" ry="43" fill="#FFD700" />
      <ellipse cx="90" cy="45" rx="78" ry="35" fill="#003DA6" />
      <text
        x="90"
        y="40"
        textAnchor="middle"
        fill="white"
        fontSize="22"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        LEMTEL
      </text>
      <text
        x="90"
        y="58"
        textAnchor="middle"
        fill="white"
        fontSize="9"
        letterSpacing="2"
        fontFamily="Arial, sans-serif"
      >
        COMMUNICATIONS
      </text>
    </svg>
  );
}

function AvaLogo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="9" fill="#0023e6" />
      <text
        x="10"
        y="14"
        textAnchor="middle"
        fill="white"
        fontSize="9"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        AVA
      </text>
    </svg>
  );
}
