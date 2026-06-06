import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { theme } from '../lib/theme';
import LemtelLogo from './LemtelLogo';

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

export default function SetupWizard({ onComplete }: { onComplete: (creds: Creds) => void }) {
  const { colors, glow } = theme;
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
        setError(authError?.message ?? 'Login failed');
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

  return (
    <div style={{
      minHeight: '100%',
      background: 'radial-gradient(circle at 30% 20%, #0a0520 0%, #050510 60%)',
      display: 'flex', flexDirection: 'column', color: colors.text,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Floating orbs */}
      <div className="lemtel-orb" style={{
        width: 320, height: 320, top: '-80px', left: '-60px',
        background: 'rgba(0,61,166,0.35)', animation: 'float1 12s ease-in-out infinite',
      }} />
      <div className="lemtel-orb" style={{
        width: 260, height: 260, bottom: '-60px', right: '-40px',
        background: 'rgba(124,58,237,0.25)', animation: 'float2 10s ease-in-out infinite',
      }} />
      <div className="lemtel-orb" style={{
        width: 200, height: 200, top: '40%', right: '20%',
        background: 'rgba(255,215,0,0.10)', animation: 'float3 14s ease-in-out infinite',
      }} />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', position: 'relative', zIndex: 1,
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <LemtelLogo size="lg" glow halo />
          <div style={{
            marginTop: 16, fontSize: 11, fontWeight: 800,
            letterSpacing: 6, color: colors.gold,
            textShadow: `0 0 18px ${colors.goldDim}`,
          }}>
            LEMTEL TELECOM
          </div>
          <div style={{
            marginTop: 6, fontSize: 12, color: colors.aiLight,
            letterSpacing: 0.4,
          }}>
            AI-Powered Business Communications
          </div>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 360,
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,215,0,0.15)',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          animation: 'fadeIn .4s ease-out',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Portal URL" value={portalUrl} onChange={setPortalUrl} type="url" />
            <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" autoFocus />
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" onEnter={handleConnect} />

            {error && (
              <div style={{
                fontSize: 11, color: colors.red,
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                {error}
              </div>
            )}

            <button
              className="lemtel-btn-primary"
              onClick={handleConnect}
              disabled={loading || !email || !password}
              style={{
                marginTop: 6, height: 46, borderRadius: 12,
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', letterSpacing: 0.3,
              }}
            >
              {loading ? 'Connecting…' : '→ Connect'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 16px 18px', textAlign: 'center',
        fontSize: 10, color: colors.textDim, letterSpacing: 0.4,
        position: 'relative', zIndex: 1,
      }}>
        Built by{' '}
        <a
          href="https://assistantvirtualai.com"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI?.openExternal?.('https://assistantvirtualai.com');
          }}
          style={{ color: colors.gold, textDecoration: 'none', cursor: 'pointer' }}
        >
          AVA AI · assistantvirtualai.com
        </a>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder, autoFocus, onEnter,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; autoFocus?: boolean; onEnter?: () => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontSize: 10, color: theme.colors.textSub,
        textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600,
      }}>{label}</span>
      <input
        className="lemtel-input"
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      />
    </label>
  );
}
