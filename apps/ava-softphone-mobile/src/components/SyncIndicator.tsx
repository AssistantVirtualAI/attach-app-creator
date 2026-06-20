import React, { useEffect, useState } from 'react';
import { useSyncStatus } from '../lib/syncStatus';
import { useT } from '../lib/i18n';
import { colors } from '../lib/theme';

/**
 * Compact pill at the top of the screen showing global sync status:
 * loading (cyan, spinner), success (green, check) for 2.5s, error (red, !).
 */
export default function SyncIndicator() {
  const { t } = useT();
  const snap = useSyncStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (snap.state === 'loading' || snap.state === 'error') {
      setVisible(true);
      return;
    }
    if (snap.state === 'success') {
      setVisible(true);
      const id = setTimeout(() => setVisible(false), 2200);
      return () => clearTimeout(id);
    }
    setVisible(false);
  }, [snap.state, snap.lastSuccessAt, snap.lastErrorAt]);

  if (!visible || snap.state === 'idle') return null;

  const cfg =
    snap.state === 'loading' ? { bg: 'rgba(36,178,255,0.16)', bd: '#24B2FF66', fg: '#7CD9FF', icon: <Spinner />, label: t('sync.loading') } :
    snap.state === 'error'   ? { bg: 'rgba(255,77,103,0.16)', bd: `${colors.danger}66`, fg: '#FF8FA1', icon: <span>!</span>, label: t('sync.error') } :
                               { bg: 'rgba(16,185,129,0.16)', bd: '#10B98166', fg: '#7FE8C2', icon: <span>✓</span>, label: t('sync.success') };

  return (
    <div style={{
      position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 999,
      background: cfg.bg, border: `1px solid ${cfg.bd}`, color: cfg.fg,
      fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4,
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 50, pointerEvents: 'none',
      boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
    }}>
      <span style={{ display: 'inline-flex', width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>{cfg.icon}</span>
      <span>{cfg.label}</span>
      {snap.totalLoaders > 0 && snap.state === 'loading' && (
        <span style={{ opacity: 0.75 }}>· {snap.readyLoaders}/{snap.totalLoaders}</span>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 12, height: 12, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#7CD9FF',
      display: 'inline-block', animation: 'avaspin 0.8s linear infinite',
    }}>
      <style>{`@keyframes avaspin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
