import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { theme } from '../lib/theme';
import { setAuthToken } from '../lib/avaApi';
import LemtelLogo from './LemtelLogo';
import BrandTagline from './BrandTagline';

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

type Mode = 'email' | 'extension';

export default function SetupWizard({ onComplete }: { onComplete: (creds: Creds) => void }) {
  const { colors } = theme;
  const [portalUrl, setPortalUrl] = useState('https://avastatistic.ca');
  const [mode, setMode] = useState<Mode>('extension');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [extension, setExtension] = useState('');
  const [sipDomain, setSipDomain] = useState('lemtel.lemtel.tel');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = React.useMemo(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY), []);

  const finalize = async (
    authUserId: string,
    accessToken: string | undefined,
    refreshToken: string | undefined,
    fallbackEmail: string,
    softphone: { extension?: string; display_name?: string; sip_domain?: string; wss_url?: string; organization_id?: string } | null,
  ) => {
    const credentials: Creds = {
      portalUrl: (portalUrl || 'https://avastatistic.ca').replace(/\/+$/, ''),
      email: fallbackEmail,
      extension: String(softphone?.extension ?? extension ?? 'N/A'),
      displayName: softphone?.display_name || fallbackEmail.split('@')[0],
      sipDomain: softphone?.sip_domain || sipDomain || 'lemtel.lemtel.tel',
      wssUrl: softphone?.wss_url || 'wss://lemtel.lemtel.tel:7443',
      userId: authUserId,
      accessToken,
      refreshToken,
    };
    if (accessToken) setAuthToken(accessToken);
    await window.electronAPI?.saveCredentials?.(credentials);
    onComplete(credentials);
  };

  const handleEmailConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError || !authData.user) {
        setError(authError?.message ?? 'Login failed');
        setLoading(false);
        return;
      }
      const { data: allowed, error: gateErr } = await supabase
        .rpc('my_platform_access_allowed', { _platform: 'desktop' });
      if (gateErr || allowed !== true) {
        await supabase.auth.signOut();
        setError('App access has not been granted by Lemtel. Please contact your provider.');
        setLoading(false);
        return;
      }
      const { data: softphoneUser } = await supabase
        .from('pbx_softphone_users')
        .select('extension,display_name,sip_domain,wss_url,organization_id,status')
        .eq('portal_user_id', authData.user.id)
        .maybeSingle();
      await finalize(
        authData.user.id,
        authData.session?.access_token,
        authData.session?.refresh_token,
        authData.user.email || email,
        softphoneUser,
      );
    } catch (err: any) {
      setError(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExtensionConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('extension-signin', {
        body: {
          extension: extension.trim(),
          password,
          sip_domain: sipDomain.trim() || undefined,
          platform: 'desktop',
        },
      });
      const errMsg = (data as any)?.error || fnErr?.message;
      if (errMsg || !(data as any)?.access_token) {
        const friendly =
          errMsg === 'invalid_credentials' ? 'Wrong extension or password.' :
          errMsg === 'extension_not_found' ? 'Extension not found.' :
          errMsg === 'app_access_disabled' || errMsg === 'desktop_access_disabled'
            ? 'Desktop access has not been enabled for this extension. Contact Lemtel.' :
          errMsg === 'ambiguous_extension' ? 'Multiple extensions match — please enter the SIP domain.' :
          (errMsg || 'Sign in failed');
        setError(friendly);
        setLoading(false);
        return;
      }
      const d = data as any;
      // Hydrate the local Supabase client so subsequent app code sees the session.
      await supabase.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
      await finalize(d.user_id, d.access_token, d.refresh_token, d.email || `ext-${d.extension}@${d.sip_domain || 'lemtel.tel'}`, d);
    } catch (err: any) {
      setError(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => (mode === 'email' ? handleEmailConnect() : handleExtensionConnect());
  const canSubmit = mode === 'email'
    ? !!email && !!password
    : !!extension && !!password;

  return (
    <div style={{
      minHeight: '100%',
      background: colors.bg,
      display: 'flex', flexDirection: 'column', color: colors.text,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Single soft gold radial behind the wordmark */}
      <div style={{
        position: 'absolute',
        top: '14%', left: '50%', transform: 'translateX(-50%)',
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.18) 0%, rgba(255,215,0,0.04) 40%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'authGlow 6s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', position: 'relative', zIndex: 1,
      }}>
        {/* Brand wordmark — square Lemtel mark */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <LemtelLogo size="lg" glow shape="square" />
          <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800, color: colors.textIce, letterSpacing: 0.2 }}>Lemtel</div>
          <BrandTagline size="sm" />
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 420,
          background: colors.bgCard,
          border: `1px solid ${colors.border}`,
          borderRadius: 24,
          padding: 32,
          boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
          animation: 'fadeIn .4s ease-out',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Portal URL" value={portalUrl} onChange={setPortalUrl} type="url" />
            <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" autoFocus />
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" onEnter={handleConnect} />

            {error && (
              <div style={{
                fontSize: 12, color: colors.red,
                padding: '10px 14px', borderRadius: 10,
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
                marginTop: 8, height: 50, borderRadius: 14,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              {loading ? 'Connecting…' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '18px 16px 22px', textAlign: 'center',
        fontSize: 11, color: colors.textDim, letterSpacing: 0.4,
        position: 'relative', zIndex: 1,
      }}>
        Built by{' '}
        <a
          href="https://assistantvirtualai.com"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI?.openExternal?.('https://assistantvirtualai.com');
          }}
          style={{ color: colors.gold, textDecoration: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          AVA Statistic · assistantvirtualai.com
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
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{
        fontSize: 10, color: theme.colors.textSub,
        textTransform: 'uppercase', letterSpacing: 1.6, fontWeight: 700,
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
