import React, { useEffect, useState } from 'react';
import { WHITELABEL } from '../whitelabel.config';

const lemtelLogoUrl = new URL('../assets/lemtel-logo.svg', import.meta.url).href;

type Tab = 'account' | 'audio' | 'notifications' | 'general' | 'about';
const TABS: Tab[] = ['account', 'audio', 'notifications', 'general', 'about'];

export default function SettingsPage({
  creds,
  onSignOut,
  onBack,
}: {
  creds: { email: string; extension: string };
  onSignOut: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>('account');
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devs) => {
      setMics(devs.filter((d) => d.kind === 'audioinput'));
      setSpeakers(devs.filter((d) => d.kind === 'audiooutput'));
    });
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack} style={back}>
        ← Back
      </button>
      <div style={tabsRow}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <section style={section}>
          <Row label="Email" value={creds.email} />
          <Row label="Extension" value={creds.extension} />
          <Row label="Status" value="🟢 Registered" />
          <button style={danger} onClick={onSignOut}>
            Sign Out
          </button>
        </section>
      )}

      {tab === 'audio' && (
        <section style={section}>
          <Select label="Microphone" options={mics} />
          <Select label="Speaker" options={speakers} />
          <Select label="Ring device" options={speakers} />
          <Toggle label="Echo cancellation" defaultChecked />
          <Toggle label="Noise suppression" defaultChecked />
        </section>
      )}

      {tab === 'notifications' && (
        <section style={section}>
          <Toggle label="Incoming call notifications" defaultChecked />
          <Toggle label="Missed call notifications" defaultChecked />
          <Toggle label="New SMS notifications" defaultChecked />
          <Toggle label="Notification sound" defaultChecked />
        </section>
      )}

      {tab === 'general' && (
        <section style={section}>
          <Toggle
            label="Launch on startup"
            defaultChecked
            onChange={(v) => window.electronAPI.setLaunchOnStartup(v)}
          />
          <Toggle label="Minimize to tray on close" defaultChecked />
          <SelectStatic label="Theme" options={['Dark', 'Light', 'System']} />
          <SelectStatic label="Language" options={['FR', 'EN']} />
        </section>
      )}

      {tab === 'about' && (
        <section style={section}>
          <img src={lemtelLogoUrl} alt={`${WHITELABEL.appName} logo`} style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 10 }} />
          <Row label="Application" value={WHITELABEL.appName} />
          <Row label="Version" value="1.0.0" />
          <button
            style={primary}
            onClick={() => window.electronAPI.checkForUpdates()}
          >
            Check for Updates
          </button>
          <a
            style={link}
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI.openExternal(
                'https://github.com/AssistantVirtualAI/attach-app-creator/releases'
              );
            }}
            href="#"
          >
            Release Notes ↗
          </a>
          <div style={{ opacity: 0.6, fontSize: 12, marginTop: 10 }}>
            © 2026 {WHITELABEL.clientName}. Powered by {WHITELABEL.providerName}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
function Toggle({
  label,
  defaultChecked,
  onChange,
}: {
  label: string;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [v, setV] = useState(!!defaultChecked);
  return (
    <label style={{ display: 'flex', gap: 8, padding: '6px 0', alignItems: 'center' }}>
      <input
        type="checkbox"
        checked={v}
        onChange={(e) => {
          setV(e.target.checked);
          onChange?.(e.target.checked);
        }}
      />
      {label}
    </label>
  );
}
function Select({ label, options }: { label: string; options: MediaDeviceInfo[] }) {
  return (
    <label style={{ display: 'block', padding: '6px 0' }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <select style={selectStyle}>
        {options.map((o) => (
          <option key={o.deviceId} value={o.deviceId}>
            {o.label || o.deviceId}
          </option>
        ))}
      </select>
    </label>
  );
}
function SelectStatic({ label, options }: { label: string; options: string[] }) {
  return (
    <label style={{ display: 'block', padding: '6px 0' }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <select style={selectStyle}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

const back: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: '#9aa',
  cursor: 'pointer',
  fontSize: 12,
};
const tabsRow: React.CSSProperties = { display: 'flex', gap: 4, margin: '8px 0 12px' };
const tabBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#aaa',
  border: 0,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  textTransform: 'capitalize',
  borderBottom: '2px solid transparent',
};
const tabActive: React.CSSProperties = { color: '#fff', borderColor: '#0023e6' };
const section: React.CSSProperties = {
  background: '#13131c',
  borderRadius: 8,
  padding: 12,
};
const danger: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 12px',
  background: '#3a0d0d',
  color: '#ff8a8a',
  border: '1px solid #5a1313',
  borderRadius: 6,
  cursor: 'pointer',
};
const primary: React.CSSProperties = {
  padding: '8px 12px',
  background: '#0023e6',
  border: 0,
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
};
const link: React.CSSProperties = {
  display: 'block',
  marginTop: 10,
  color: '#7aa2ff',
  fontSize: 13,
};
const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: '#15151f',
  border: '1px solid #2a2a3a',
  borderRadius: 6,
  color: '#fff',
};
