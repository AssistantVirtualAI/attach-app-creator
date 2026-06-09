import React, { useEffect, useState } from 'react';
import LemtelLogo from './LemtelLogo';
import { theme } from '../lib/theme';
import { useSyncStatus, formatAge } from '../hooks/useSyncStatus';

const dragStyle: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'drag',
};
const noDrag: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'no-drag',
};

interface Props {
  sipStatus?: string;
}

export default function TitleBar({ sipStatus: sipStatusProp }: Props) {
  const { colors } = theme;
  const { pbx, syncConnected, lastEvent, ageMs, fresh } = useSyncStatus();
  const [aiBusy, setAiBusy] = useState(false);

  // Allow sipStatusProp prop to override the event stream
  const [pbxOverride, setPbxOverride] = useState<string | null>(sipStatusProp ?? null);
  useEffect(() => { setPbxOverride(sipStatusProp ?? null); }, [sipStatusProp]);
  const effectivePbx = (pbxOverride as any) || pbx;

  useEffect(() => {
    const onAi = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.busy === 'boolean') setAiBusy(d.busy);
    };
    window.addEventListener('lemtel:ai-activity', onAi as EventListener);
    return () => window.removeEventListener('lemtel:ai-activity', onAi as EventListener);
  }, []);

  const pbxMeta =
    effectivePbx === 'registered'
      ? { color: colors.gold, label: 'PBX Online', anim: 'statusPulse 2s ease-in-out infinite' }
      : effectivePbx === 'error'
        ? { color: colors.red, label: 'PBX Error', anim: 'none' }
        : { color: colors.textSub, label: 'PBX Connecting', anim: 'statusPulse 1.4s ease-in-out infinite' };

  const syncMeta = syncConnected
    ? { color: fresh ? '#23d6ff' : '#6fb8ff', label: lastEvent ? `Sync · ${formatAge(ageMs)}` : 'Sync Live' }
    : { color: colors.textSub, label: 'Sync Offline' };

  return (
    <div
      style={{
        height: 38,
        background: 'rgba(10,21,48,0.85)',
        borderBottom: `1px solid ${colors.border}`,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        position: 'relative',
        backdropFilter: 'blur(14px)',
        ...dragStyle,
      }}
    >
      {/* Left: brand spacer (window controls handled by OS) */}
      <div style={{ width: 70 }} />

      {/* Center: status pills */}
      <div style={{ ...noDrag, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill color={pbxMeta.color} label={pbxMeta.label} anim={pbxMeta.anim} />
        <Pill color={syncMeta.color} label={syncMeta.label} />
        <AIPill busy={aiBusy} />
      </div>

      {/* Right: spacer */}
      <div style={{ width: 70 }} />
    </div>
  );
}

function Pill({ color, label, anim }: { color: string; label: string; anim?: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '4px 11px', borderRadius: 999,
      background: 'rgba(8,16,38,0.6)',
      border: `1px solid ${color}55`,
      fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase',
      color: '#d8e6ff', fontWeight: 700,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 12px -4px ${color}66`,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: color,
        boxShadow: `0 0 8px ${color}`,
        animation: anim,
      }} />
      {label}
    </div>
  );
}

function AIPill({ busy }: { busy: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '4px 11px', borderRadius: 999,
      background: busy
        ? 'linear-gradient(135deg, rgba(122,76,255,0.35), rgba(35,214,255,0.25))'
        : 'linear-gradient(135deg, rgba(122,76,255,0.18), rgba(35,214,255,0.10))',
      border: '1px solid rgba(122,76,255,0.5)',
      fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase',
      color: '#eadcff', fontWeight: 800,
      boxShadow: busy ? '0 0 16px -2px rgba(122,76,255,0.7)' : '0 0 10px -4px rgba(122,76,255,0.5)',
      transition: 'box-shadow .3s ease, background .3s ease',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: busy ? '#23d6ff' : '#7a4cff',
        boxShadow: '0 0 8px currentColor',
        animation: busy ? 'statusPulse 1s ease-in-out infinite' : undefined,
      }} />
      AVA AI {busy ? '· Thinking' : '· Ready'}
    </div>
  );
}

export { LemtelLogo };
