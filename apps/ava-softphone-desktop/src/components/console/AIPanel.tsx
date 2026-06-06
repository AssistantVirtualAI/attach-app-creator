import React from 'react';
import { theme } from '../../lib/theme';

const { colors: c } = theme;

export default function AIPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  if (!open) {
    return (
      <button
        onClick={onToggle}
        title="Open AVA panel"
        style={{
          position: 'absolute', top: 70, right: 0, zIndex: 5,
          width: 28, height: 64, borderRadius: '10px 0 0 10px',
          background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
          border: 'none', cursor: 'pointer', color: '#fff',
          fontSize: 11, fontWeight: 800, letterSpacing: 1,
          writingMode: 'vertical-rl' as any,
          boxShadow: '0 4px 18px -4px rgba(122,76,255,0.55)',
        }}
      >AVA</button>
    );
  }
  return (
    <aside style={{
      width: 320, flexShrink: 0, height: '100%',
      background: c.deepPanel,
      borderLeft: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, rgba(122,76,255,0.10), rgba(35,214,255,0.05))`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
            display: 'grid', placeItems: 'center', color: '#fff',
            fontWeight: 800, fontSize: 11,
          }}>AI</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textIce }}>AVA Assistant</div>
            <div style={{ fontSize: 9.5, color: c.avaCyan, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Live</div>
          </div>
        </div>
        <button onClick={onToggle} style={{
          background: 'transparent', border: 'none', color: c.mutedSilver,
          fontSize: 16, cursor: 'pointer', padding: 4,
        }}>×</button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Section title="Live Notes" accent={c.avaCyan}>
          <div style={{ fontSize: 12, color: c.mutedSilver, fontStyle: 'italic' }}>
            No active call. Notes will appear here in real time during conversations.
          </div>
        </Section>

        <Section title="Recent Summary" accent={c.avaViolet}>
          <div style={{ fontSize: 12, color: c.textIce, lineHeight: 1.55 }}>
            Last call with <strong>Marie Tremblay</strong> discussed Q4 invoicing.
            Sentiment: <span style={{ color: c.success }}>Positive</span>. Action item: send updated quote by Friday.
          </div>
        </Section>

        <Section title="Smart Suggestions" accent={c.signalGold}>
          {['Schedule callback with Acme Corp', 'Draft follow-up SMS for voicemail #2', 'Review queue overflow at 4 PM'].map((s, i) => (
            <button key={i} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 10px', marginBottom: 6,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${c.border}`, borderRadius: 8,
              color: c.textIce, fontSize: 11.5, cursor: 'pointer',
            }}>→ {s}</button>
          ))}
        </Section>
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${c.border}` }}>
        <input
          placeholder="Ask AVA anything…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', borderRadius: 10,
            background: c.bgCard, border: `1px solid ${c.borderAI}`,
            color: c.textIce, fontSize: 12, outline: 'none',
          }}
        />
      </div>
    </aside>
  );
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5,
        color: accent, textTransform: 'uppercase', marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}
