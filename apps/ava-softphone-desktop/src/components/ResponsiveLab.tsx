import React, { useEffect, useRef, useState } from 'react';
import { detectOverlaps, OverlapIssue } from '../lib/overlapDetector';

// Preset widths to verify: 320 & 380 are the critical small breakpoints
// requested; 440 & 600 cover compact + standard desktop.
const PRESETS = [320, 360, 380, 440, 600, 900];

type FrameReport = { width: number; issues: OverlapIssue[]; checkedAt: number };

export default function ResponsiveLab() {
  const [reports, setReports] = useState<Record<number, FrameReport>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const frameRefs = useRef<Record<number, HTMLIFrameElement | null>>({});

  const checkFrame = (w: number) => {
    const f = frameRefs.current[w];
    if (!f || !f.contentDocument) return;
    try {
      const issues = detectOverlaps(f.contentDocument.body);
      setReports((r) => ({ ...r, [w]: { width: w, issues, checkedAt: Date.now() } }));
    } catch (e) {
      console.warn('[ResponsiveLab] scan failed for', w, e);
    }
  };

  const checkAll = () => PRESETS.forEach((w) => checkFrame(w));

  useEffect(() => {
    const id = setTimeout(checkAll, 1500);
    return () => clearTimeout(id);
  }, []);

  const total = Object.values(reports).reduce((a, r) => a + r.issues.length, 0);

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0A0F1F', color: '#E8ECF5', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <header style={{
        padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <strong style={{ fontSize: 16 }}>Responsive Lab</strong>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          {PRESETS.length} viewports · {total} issue{total === 1 ? '' : 's'} detected
        </span>
        <button onClick={checkAll} style={btnStyle}>Re-scan all</button>
        <a href="?" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-block' }}>Exit lab</a>
      </header>

      <div style={{
        flex: 1, overflow: 'auto', padding: 20,
        display: 'grid', gap: 20,
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
      }}>
        {PRESETS.map((w) => {
          const rep = reports[w];
          const hasIssues = rep && rep.issues.length > 0;
          return (
            <div key={w} style={{
              background: '#0F172A', borderRadius: 12,
              border: `1px solid ${hasIssues ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'}`,
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                <strong style={{ fontSize: 13 }}>{w}px</strong>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 999,
                    background: hasIssues ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                    color: hasIssues ? '#FCA5A5' : '#86EFAC',
                  }}>
                    {rep ? `${rep.issues.length} issue${rep.issues.length === 1 ? '' : 's'}` : 'scanning…'}
                  </span>
                  <button onClick={() => checkFrame(w)} style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}>Re-scan</button>
                  <button onClick={() => setSelected(selected === w ? null : w)} style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}>
                    {selected === w ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>

              <div style={{ background: '#000', padding: 12, display: 'flex', justifyContent: 'center' }}>
                <iframe
                  ref={(el) => { frameRefs.current[w] = el; }}
                  title={`preview-${w}`}
                  src={`${window.location.pathname}?embed=1`}
                  onLoad={() => setTimeout(() => checkFrame(w), 800)}
                  style={{
                    width: w, height: 600, border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, background: '#0A0F1F',
                  }}
                />
              </div>

              {selected === w && rep && (
                <div style={{
                  maxHeight: 220, overflow: 'auto', padding: 12,
                  borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11,
                  fontFamily: 'Fira Code, monospace',
                }}>
                  {rep.issues.length === 0 ? (
                    <span style={{ color: '#86EFAC' }}>✓ No clipped or overlapping interactive elements.</span>
                  ) : (
                    rep.issues.map((iss, i) => (
                      <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
                        {iss.kind === 'clipped' ? (
                          <><span style={{ color: '#FCA5A5' }}>CLIPPED</span> {iss.label} — <code>{iss.selector}</code></>
                        ) : (
                          <><span style={{ color: '#FCD34D' }}>OVERLAP</span> {iss.aLabel} ↔ {iss.bLabel} ({iss.area}px²)</>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  background: 'rgba(255,215,0,0.15)', color: '#FFD700',
  border: '1px solid rgba(255,215,0,0.4)', cursor: 'pointer',
};
