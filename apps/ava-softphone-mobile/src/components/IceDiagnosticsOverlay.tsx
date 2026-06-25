import { useEffect, useState } from 'react';
import {
  onIceDiagnostic,
  isIceDiagOverlayEnabled,
  getActivePcConfig,
  type IceDiagnosticEvent,
} from '../lib/sip/rtcConfig';

/**
 * Floating diagnostic panel for iOS WebRTC debugging.
 * Visible only when localStorage['sip:iceDiag']='1', ?iceDiag=1,
 * or SIP debug mode is on. Shows the live ICE state and the last
 * 5 candidates with their source (STUN / TURN / LOCAL / PEER).
 */
export default function IceDiagnosticsOverlay() {
  const [show, setShow] = useState(false);
  const [iceState, setIceState] = useState<string>('—');
  const [gatherState, setGatherState] = useState<string>('—');
  const [provider, setProvider] = useState<string>('—');
  const [probe, setProbe] = useState<string>('—');
  const [candidates, setCandidates] = useState<{ source: string; raw: string; t: number }[]>([]);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setShow(isIceDiagOverlayEnabled());
    const cfg = getActivePcConfig();
    const first = (cfg.iceServers?.[2] as RTCIceServer | undefined)?.urls?.toString() ?? '';
    setProvider(first.includes('metered') ? 'metered' : first.includes('openrelay') ? 'fallback' : '—');

    const off = onIceDiagnostic((e: IceDiagnosticEvent) => {
      if (e.kind === 'ice-state') setIceState(e.state);
      else if (e.kind === 'gather-state') setGatherState(e.state);
      else if (e.kind === 'pc-config') setProvider(e.provider);
      else if (e.kind === 'probe-result') setProbe(`${e.provider}${e.relayFound ? ' ✓' : ' ✗'}`);
      else if (e.kind === 'candidate') {
        setCandidates((prev) => [{ source: e.source, raw: e.raw, t: Date.now() }, ...prev].slice(0, 5));
      }
    });
    return off;
  }, []);

  if (!show) return null;

  const color =
    iceState === 'connected' || iceState === 'completed' ? '#22c55e'
    : iceState === 'failed' ? '#ef4444'
    : iceState === 'disconnected' ? '#f59e0b'
    : '#94a3b8';

  return (
    <div
      style={{
        position: 'fixed', bottom: 88, right: 8, zIndex: 9999,
        background: 'rgba(4,11,22,0.92)', color: '#e2e8f0',
        border: '1px solid #1e293b', borderRadius: 12, padding: 10,
        font: '11px/1.35 ui-monospace, SFMono-Regular, monospace',
        maxWidth: collapsed ? 180 : 320, boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      }}
      onClick={() => setCollapsed((c) => !c)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: collapsed ? 0 : 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: color, display: 'inline-block' }} />
        <strong style={{ color: '#f8fafc' }}>ICE</strong>
        <span style={{ color }}>{iceState}</span>
        <span style={{ color: '#64748b', marginLeft: 'auto' }}>{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <>
          <div>gather: <span style={{ color: '#cbd5e1' }}>{gatherState}</span></div>
          <div>TURN provider: <span style={{ color: '#cbd5e1' }}>{provider}</span></div>
          <div>probe: <span style={{ color: '#cbd5e1' }}>{probe}</span></div>
          <div style={{ marginTop: 6, color: '#64748b' }}>candidats (5 récents)</div>
          {candidates.length === 0 && <div style={{ color: '#475569' }}>—</div>}
          {candidates.map((c, i) => (
            <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: c.source.startsWith('TURN') ? '#22c55e' : c.source.startsWith('STUN') ? '#38bdf8' : '#94a3b8' }}>
                {c.source}
              </span>{' '}
              <span style={{ color: '#475569' }}>{c.raw.slice(0, 60)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
