import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/theme';

const SUPABASE_URL = 'https://gejxisrqtvxavbrfcoxz.supabase.co';
const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';

type Creds = {
  portalUrl: string;
  email: string;
  extension: string;
  displayName?: string;
  sipDomain?: string;
  wssUrl?: string;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
};

interface SetupWizardProps {
  onComplete: (creds: Creds) => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t, mode, toggle } = useTheme();
  const [portalUrl, setPortalUrl] = useState('https://avastatistic.ca');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (authError || !authData.user) {
        setError(`Login failed: ${authError?.message ?? 'unknown error'}`);
        setLoading(false);
        return;
      }

      const { data: softphoneUser } = await supabase
        .from('pbx_softphone_users')
        .select('*')
        .eq('portal_user_id', authData.user.id)
        .maybeSingle();

      const credentials: Creds = {
        portalUrl: (portalUrl || 'https://avastatistic.ca').replace(/\/+$/, ''),
        email: authData.user.email || email,
        extension: String(softphoneUser?.extension ?? 'N/A'),
        displayName: softphoneUser?.display_name || email.split('@')[0],
        sipDomain: softphoneUser?.sip_domain || 'lemtel.lemtel.tel',
        wssUrl: softphoneUser?.wss_url || 'wss://lemtel.lemtel.tel:7443',
        userId: authData.user.id,
        accessToken: authData.session?.access_token,
        refreshToken: authData.session?.refresh_token,
      };

      await window.electronAPI?.saveCredentials?.(credentials);
      onComplete(credentials);
    } catch (err: any) {
      setError(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.03)',
    border: `1px solid ${t.border}`,
    borderRadius: 10,
    color: t.text,
    padding: '12px 14px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border 160ms ease, box-shadow 160ms ease',
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = t.accent;
    e.currentTarget.style.boxShadow = t.ringGlow;
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = t.border;
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: t.bgGradient,
        display: 'flex',
        flexDirection: 'column',
        color: t.text,
      }}
    >
      {/* Theme toggle floating */}
      <button
        onClick={toggle}
        title="Toggle theme"
        style={{
          position: 'absolute',
          top: 56,
          right: 20,
          background: t.surface,
          border: `1px solid ${t.border}`,
          color: t.text,
          width: 32,
          height: 32,
          borderRadius: 10,
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
        }}
      >
        {mode === 'dark' ? '☀️' : '🌙'}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        {/* Logo / brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: t.accentGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: 1,
              boxShadow: t.accentGlow,
              marginBottom: 16,
            }}
          >
            A
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
            Welcome to AVA Softphone
          </h1>
          <p style={{ color: t.textMuted, fontSize: 13, margin: '6px 0 0' }}>
            Sign in to your AVA workspace
          </p>
        </div>

        {/* Form card */}
        <div
          style={{
            width: '100%',
            maxWidth: 380,
            background: t.surface,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${t.glassBorder}`,
            borderRadius: 16,
            padding: 24,
            boxShadow: t.shadow,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(t.textMuted)}>Portal URL</label>
            <input
              style={inputStyle}
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(t.textMuted)}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder="you@company.com"
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle(t.textMuted)}>Password</label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.28)',
                borderRadius: 10,
                color: t.danger,
                padding: '10px 12px',
                fontSize: 12,
                marginTop: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              marginTop: 18,
              width: '100%',
              padding: '13px 14px',
              background: t.accentGradient,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: 0.2,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: t.accentGlow,
              transition: 'transform 120ms ease, opacity 160ms ease',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <p style={{ color: t.textSubtle, fontSize: 11, marginTop: 18, textAlign: 'center', maxWidth: 320 }}>
          Secured by AVA · Your credentials are encrypted end-to-end
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '14px 20px 18px',
          borderTop: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: t.textMuted,
          fontSize: 11,
        }}
      >
        <span style={{ opacity: 0.7 }}>App built by</span>
        <a
          href="https://avastatistic.ca"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI?.openExternal?.('https://avastatistic.ca');
          }}
          style={{ color: t.accent, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
        >
          AVA Statistics · avastatistic.ca
        </a>
      </div>
    </div>
  );
}

const labelStyle = (c: string): React.CSSProperties => ({
  display: 'block',
  color: c,
  fontSize: 11,
  marginBottom: 6,
  fontWeight: 600,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
});

export { default as LemtelLogo } from './LemtelLogo';
