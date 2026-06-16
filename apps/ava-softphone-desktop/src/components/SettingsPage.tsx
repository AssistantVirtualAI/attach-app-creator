import React, { useEffect, useState } from 'react';
import { WHITELABEL } from '../whitelabel.config';
import { useTheme } from '../lib/theme';
import { useBrightness, Brightness } from '../hooks/useBrightness';
import { useContrast, Contrast } from '../hooks/useContrast';
import SipDebugView from './SipDebugView';

type Tab = 'account' | 'audio' | 'notifications' | 'general' | 'diagnostics' | 'about';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'account', icon: '👤', label: 'Account' },
  { id: 'audio', icon: '🎧', label: 'Audio' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'general', icon: '⚙', label: 'General' },
  { id: 'diagnostics', icon: '🛠', label: 'Diagnostics' },
  { id: 'about', icon: 'ⓘ', label: 'About' },
];

export default function SettingsPage({
  creds,
  onSignOut,
  onBack,
}: {
  creds: { email: string; extension: string };
  onSignOut: () => void;
  onBack: () => void;
}) {
  const { t, mode, setMode } = useTheme();
  const { brightness, setBrightness } = useBrightness();
  const { contrast, setContrast } = useContrast();
  const [tab, setTab] = useState<Tab>('account');
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devs) => {
      setMics(devs.filter((d) => d.kind === 'audioinput'));
      setSpeakers(devs.filter((d) => d.kind === 'audiooutput'));
    });
  }, []);

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.03)',
    border: `1px solid ${t.border}`,
    borderRadius: 10,
    color: t.text,
    fontSize: 13,
    outline: 'none',
  };

  const section: React.CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.glassBorder}`,
    backdropFilter: 'blur(12px)',
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  return (
    <div style={{ background: t.bgGradient, flex: 1, minHeight: 0, overflowY: 'auto', padding: 18 }}>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', color: t.textMuted,
          cursor: 'pointer', fontSize: 12, padding: '4px 0', marginBottom: 14,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Back
      </button>

      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        background: t.surface, border: `1px solid ${t.border}`,
        padding: 4, borderRadius: 12, overflowX: 'auto',
      }}>
        {TABS.map((tt) => {
          const active = tab === tt.id;
          return (
            <button
              key={tt.id}
              onClick={() => setTab(tt.id)}
              style={{
                background: active ? t.accentSoft : 'transparent',
                color: active ? t.accent : t.textMuted,
                border: 'none',
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                borderRadius: 8,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'all 140ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tt.icon}</span> {tt.label}
            </button>
          );
        })}
      </div>

      {tab === 'account' && (
        <section style={section}>
          <Row tokens={t} label="Email" value={creds.email} />
          <Row tokens={t} label="Extension" value={creds.extension} />
          <Row tokens={t} label="Status" value="● Registered" valueColor={t.success} />
          <button
            style={{
              marginTop: 6, padding: '11px 14px',
              background: 'rgba(239,68,68,0.10)',
              color: t.danger,
              border: '1px solid rgba(239,68,68,0.28)',
              borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13,
            }}
            onClick={onSignOut}
          >
            Sign Out
          </button>
        </section>
      )}

      {tab === 'audio' && (
        <section style={section}>
          <SelectField tokens={t} label="Microphone" selectStyle={selectStyle}>
            {mics.map((o) => (<option key={o.deviceId} value={o.deviceId}>{o.label || o.deviceId}</option>))}
          </SelectField>
          <SelectField tokens={t} label="Speaker" selectStyle={selectStyle}>
            {speakers.map((o) => (<option key={o.deviceId} value={o.deviceId}>{o.label || o.deviceId}</option>))}
          </SelectField>
          <SelectField tokens={t} label="Ring device" selectStyle={selectStyle}>
            {speakers.map((o) => (<option key={o.deviceId} value={o.deviceId}>{o.label || o.deviceId}</option>))}
          </SelectField>
          <Toggle tokens={t} label="Echo cancellation" defaultChecked />
          <Toggle tokens={t} label="Noise suppression" defaultChecked />
        </section>
      )}

      {tab === 'notifications' && (
        <section style={section}>
          <Toggle tokens={t} label="Incoming call notifications" defaultChecked />
          <Toggle tokens={t} label="Missed call notifications" defaultChecked />
          <Toggle tokens={t} label="New SMS notifications" defaultChecked />
          <Toggle tokens={t} label="Notification sound" defaultChecked />
        </section>
      )}

      {tab === 'general' && (
        <section style={section}>
          <Toggle
            tokens={t}
            label="Launch on startup"
            defaultChecked
            onChange={(v) => window.electronAPI.setLaunchOnStartup(v)}
          />
          <Toggle tokens={t} label="Minimize to tray on close" defaultChecked />
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              Appearance
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['daylight', 'light', 'dark', 'midnight'] as const).map((m) => {
                const active = mode === m;
                const meta: Record<string, { icon: string; label: string }> = {
                  daylight: { icon: '🌤️', label: 'Daylight' },
                  light:    { icon: '☀️', label: 'Light' },
                  dark:     { icon: '🌙', label: 'Dark' },
                  midnight: { icon: '🌌', label: 'Midnight' },
                };
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      flex: '1 1 calc(50% - 4px)', minWidth: 110, padding: '14px 12px',
                      background: active ? t.accentSoft : 'transparent',
                      border: `1px solid ${active ? 'rgba(0,35,230,0.45)' : t.border}`,
                      color: active ? t.accent : t.text,
                      borderRadius: 12, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      fontWeight: active ? 700 : 500, fontSize: 12,
                      transition: 'all 160ms ease',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{meta[m].icon}</span>
                    {meta[m].label}
                  </button>
                );
              })}
            </div>

            <ThemePreview t={t} mode={mode} />
          </div>

          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              Brightness · keeps blue/yellow palette
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['dim', 'medium', 'bright'] as Brightness[]).map((b) => {
                const active = brightness === b;
                const label = b === 'dim' ? 'Dim' : b === 'medium' ? 'Medium' : 'Bright';
                const icon = b === 'dim' ? '◐' : b === 'medium' ? '◑' : '◓';
                return (
                  <button
                    key={b}
                    onClick={() => setBrightness(b)}
                    style={{
                      flex: 1, padding: '12px 10px',
                      background: active ? 'rgba(255,215,0,0.12)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(255,215,0,0.45)' : t.border}`,
                      color: active ? '#FFD700' : t.text,
                      borderRadius: 12, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      fontWeight: active ? 700 : 500, fontSize: 12,
                      transition: 'all 160ms ease',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    {label}
                  </button>
                );
              })}
          </div>

          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              Contrast · quick readability presets
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['low', 'med', 'high'] as Contrast[]).map((cc) => {
                const active = contrast === cc;
                const label = cc === 'low' ? 'Low' : cc === 'med' ? 'Medium' : 'High';
                return (
                  <button
                    key={cc}
                    onClick={() => setContrast(cc)}
                    style={{
                      flex: 1, padding: '12px 10px',
                      background: active ? 'rgba(0,82,204,0.18)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(0,82,204,0.55)' : t.border}`,
                      color: active ? '#7FB0FF' : t.text,
                      borderRadius: 12, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      fontWeight: active ? 700 : 500, fontSize: 12,
                      transition: 'all 160ms ease',
                    }}
                  >
                    <span style={{ fontSize: 16, letterSpacing: 1, fontWeight: 800 }}>Aa</span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          </div>
          <SelectField tokens={t} label="Language" selectStyle={selectStyle}>
            <option>English</option>
            <option>Français</option>
          </SelectField>
        </section>
      )}

      {tab === 'diagnostics' && (
        <section style={section}>
          <SipDebugView />
        </section>
      )}

      {tab === 'about' && (
        <section style={{ ...section, alignItems: 'center', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: t.accentGradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 28,
            boxShadow: t.accentGlow, marginBottom: 6,
          }}>A</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{WHITELABEL.appName}</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>Version 1.4.0</div>
          <button
            style={{
              marginTop: 12, padding: '11px 18px',
              background: t.accentGradient,
              border: 'none', borderRadius: 10, color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: 13,
              boxShadow: t.accentGlow,
            }}
            onClick={() => window.electronAPI.checkForUpdates()}
          >
            Check for Updates
          </button>
          <a
            style={{ color: t.accent, fontSize: 12, cursor: 'pointer', textDecoration: 'none', fontWeight: 600 }}
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI.openExternal(
                'https://github.com/AssistantVirtualAI/attach-app-creator/releases'
              );
            }}
            href="#"
          >
            Release notes ↗
          </a>
          <div style={{ color: t.textSubtle, fontSize: 11, marginTop: 8 }}>
            © 2026 {WHITELABEL.clientName} · Built by AVA Statistics
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ tokens, label, value, valueColor }: { tokens: any; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ color: tokens.textMuted, fontSize: 12 }}>{label}</span>
      <span style={{ color: valueColor || tokens.text, fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Toggle({
  tokens,
  label,
  defaultChecked,
  onChange,
}: {
  tokens: any;
  label: string;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [v, setV] = useState(!!defaultChecked);
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}>
      <span style={{ fontSize: 13, color: tokens.text }}>{label}</span>
      <button
        type="button"
        onClick={() => { const nv = !v; setV(nv); onChange?.(nv); }}
        style={{
          width: 38, height: 22, borderRadius: 999,
          background: v ? tokens.accent : 'rgba(127,127,127,0.3)',
          border: 'none', position: 'relative', cursor: 'pointer',
          transition: 'background 160ms ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: v ? 18 : 2,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          transition: 'left 180ms ease',
        }} />
      </button>
    </label>
  );
}

function SelectField({ tokens, label, selectStyle, children }: { tokens: any; label: string; selectStyle: React.CSSProperties; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</div>
      <select style={selectStyle}>{children}</select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Live theme preview — typography, glass surface, focus ring, button */
/* Updates instantly as `t` and `mode` change.                         */
/* ------------------------------------------------------------------ */
function ThemePreview({ t, mode }: { t: any; mode: string }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
        Live preview · {mode}
      </div>
      <div
        style={{
          background: t.glass,
          border: `1px solid ${t.glassBorder}`,
          borderRadius: 16,
          padding: 18,
          boxShadow: t.shadow,
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          display: 'flex', flexDirection: 'column', gap: 12,
          color: t.text,
        }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>The quick aurora call</div>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>
            Body text on a glass surface — should remain comfortably readable.
          </div>
          <div style={{ fontSize: 11, color: t.textSubtle, marginTop: 2 }}>Subtle caption · timestamp · meta</div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              padding: '9px 16px', borderRadius: 10, border: 'none',
              background: t.accentGradient, color: '#fff',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              boxShadow: focused ? t.ringGlow : t.accentGlow,
              outline: 'none',
            }}>
            Primary action
          </button>
          <button
            style={{
              padding: '9px 16px', borderRadius: 10,
              background: t.surface, color: t.text,
              border: `1px solid ${t.border}`,
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
            Secondary
          </button>
          <span style={{ fontSize: 11, color: t.textMuted }}>
            Tab into the primary button to preview the focus ring.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>Input</span>
            <input
              placeholder="Type to test…"
              defaultValue="hello@avastatistic.ca"
              style={{
                padding: '9px 12px', borderRadius: 10,
                background: t.surface, color: t.text,
                border: `1px solid ${t.border}`,
                fontSize: 13, outline: 'none',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>Select</span>
            <select
              style={{
                padding: '9px 12px', borderRadius: 10,
                background: t.surface, color: t.text,
                border: `1px solid ${t.border}`,
                fontSize: 13, outline: 'none', cursor: 'pointer',
              }}>
              <option>Workspace · Default</option>
              <option>Agency · Lemtel</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge bg={t.accentSoft} fg={t.accent}>Active</Badge>
          <Badge bg="rgba(15,157,88,0.15)" fg={t.success}>Connected</Badge>
          <Badge bg="rgba(217,119,6,0.15)" fg={t.warning}>Pending</Badge>
          <Badge bg="rgba(220,38,38,0.15)" fg={t.danger}>Error</Badge>
          <a
            href="#preview-link"
            onClick={(e) => e.preventDefault()}
            style={{
              fontSize: 13, color: t.accent, textDecoration: 'underline',
              textDecorationColor: `${t.accent}80`, textUnderlineOffset: 3,
              fontWeight: 600,
            }}>
            Hyperlink sample →
          </a>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {[t.accent, t.success, t.warning, t.danger].map((c: string, i: number) => (
            <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 999,
      background: bg, color: fg,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      border: `1px solid ${fg}33`,
    }}>{children}</span>
  );
}
