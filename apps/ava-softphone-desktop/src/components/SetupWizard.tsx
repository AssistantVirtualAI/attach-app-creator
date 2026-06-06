import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import lemtelLogo from '../assets/lemtel-logo.png';

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
  const [portalUrl, setPortalUrl] = useState('https://avastatistic.ca');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    try {
      let anonKey = SUPABASE_ANON_KEY;

      if (!anonKey) {
        try {
          const configRes = await fetch(
            'https://gejxisrqtvxavbrfcoxz.supabase.co/functions/v1/supabase-config',
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
          );
          if (configRes.ok) {
            const config = await configRes.json();
            anonKey =
              config.supabaseAnonKey ||
              config.supabase_anon_key ||
              config.anon_key ||
              '';
          }
        } catch {
          /* ignore */
        }
      }

      if (!anonKey) {
        setError('Cannot connect to AVA Portal. Check your internet connection.');
        setLoading(false);
        return;
      }

      const supabase = createClient(SUPABASE_URL, anonKey);

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

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
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: 'white',
    padding: '10px 14px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#ccc',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: 500,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a1a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* TOP */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48 }}>
        <LemtelLogo />
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '24px 0 4px' }}>
          Lemtel Telecom
        </h1>
        <div style={{ color: '#FFD700', fontSize: 12, letterSpacing: 1.5 }}>
          AI-POWERED BUSINESS COMMUNICATIONS
        </div>
        <div style={{ width: 40, height: 2, background: '#FFD700', marginTop: 12 }} />
      </div>

      {/* FORM */}
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,215,0,0.2)',
          borderRadius: 16,
          padding: 28,
          margin: '28px 24px',
        }}
      >
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
          Connect Your Account
        </h2>
        <p style={{ color: '#888', fontSize: 13, margin: '4px 0 20px' }}>
          Sign in with your AVA portal credentials
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>AVA Portal URL</label>
          <input style={inputStyle} value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          />
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(255,0,0,0.1)',
              border: '1px solid rgba(255,0,0,0.3)',
              borderRadius: 8,
              color: '#ff6b6b',
              padding: 12,
              fontSize: 13,
              marginTop: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          style={{
            marginTop: 20,
            width: '100%',
            padding: 14,
            background: 'linear-gradient(135deg, #003DA6, #0052CC)',
            color: '#fff',
            border: '1px solid #FFD700',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '⏳ Connecting...' : 'Connect & Sign In →'}
        </button>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: 'auto', padding: 20, textAlign: 'center' }}>
        <div style={{ height: 1, background: '#333', marginBottom: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, color: '#666', fontSize: 11 }}>
          <AvaLogo />
          <span>Built by AVA AI</span>
        </div>
        <a
          href="https://assistantvirtualai.com"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI?.openExternal?.('https://assistantvirtualai.com');
          }}
          style={{ display: 'inline-block', marginTop: 6, color: '#FFD700', fontSize: 11, textDecoration: 'none', cursor: 'pointer' }}
        >
          assistantvirtualai.com
        </a>
      </div>
    </div>
  );
}

export function LemtelLogo() {
  return (
    <div
      style={{
        position: 'relative',
        padding: 14,
        borderRadius: 24,
        background:
          'radial-gradient(circle at 50% 50%, rgba(0,90,255,0.25), rgba(255,215,0,0.08) 60%, transparent 80%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 24,
          background:
            'conic-gradient(from 0deg, rgba(255,215,0,0.4), rgba(0,140,255,0.4), rgba(255,215,0,0.4))',
          filter: 'blur(18px)',
          opacity: 0.4,
          zIndex: 0,
        }}
      />
      <img
        src={lemtelLogo}
        alt="Lemtel Communications"
        style={{
          position: 'relative',
          height: 90,
          width: 'auto',
          zIndex: 1,
          filter: 'drop-shadow(0 4px 24px rgba(255,215,0,0.45))',
        }}
      />
    </div>
  );
}

function AvaLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#0023e6" />
      <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif">
        AVA
      </text>
    </svg>
  );
}
