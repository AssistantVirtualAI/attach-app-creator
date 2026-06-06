import React, { useEffect, useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, VoicemailEntry } from '../lib/mobileApi';
import { Card, Chip, EmptyState, GhostButton, AIPanel, Skeleton } from '../components/ui/Primitives';

export default function VoicemailScreen({ haptic }: { haptic?: (s?: ImpactStyle) => Promise<void> }) {
  const [items, setItems] = useState<VoicemailEntry[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => { mobileApi.voicemails().then(setItems); }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const open = items?.find((v) => v.id === openId);

  if (!items) {
    return (
      <div style={{ padding: 14 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ padding: 14, marginBottom: 8, borderRadius: radius.lg, background: gradients.card, border: `1px solid ${colors.border}` }}>
            <Skeleton w="55%" h={12} /><div style={{ height: 6 }} /><Skeleton w="80%" h={10} />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div style={{ padding: 14 }}><EmptyState icon="📭" title="No voicemails" hint="When callers leave a message, AVA will transcribe and summarize it here." /></div>;
  }

  return (
    <div>
      {items.map((v) => {
        const isOpen = openId === v.id;
        const isPlaying = playing === v.id;
        return (
          <Card key={v.id} style={{ marginBottom: 10 }} accent={v.priority === 'high' ? 'gold' : undefined}>
            <button onClick={() => { haptic?.(); setOpenId(isOpen ? null : v.id); }} style={{
              all: 'unset', display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer', padding: 2,
            }}>
              <span style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: v.isNew ? gradients.call : 'rgba(255,255,255,0.06)',
                border: `1px solid ${v.isNew ? colors.signalGold : colors.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: colors.textIce,
              }}>🎙</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>{v.customer || v.from}</span>
                  {v.isNew && <Chip tone="gold" size="xs">NEW</Chip>}
                  {v.priority === 'high' && <Chip tone="danger" size="xs">HIGH</Chip>}
                </div>
                <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                  {v.from} · {fmt(v.durationSec)} · {new Date(v.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{ color: colors.mutedSilver, fontSize: 14 }}>{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, borderRadius: radius.md,
                  background: colors.midnight2, border: `1px solid ${colors.border}`,
                }}>
                  <button onClick={() => { haptic?.(ImpactStyle.Medium); setPlaying(isPlaying ? null : v.id); }} style={{
                    width: 38, height: 38, borderRadius: '50%', border: 'none',
                    background: gradients.call, color: '#fff', fontSize: 16, cursor: 'pointer',
                  }}>{isPlaying ? '⏸' : '▶'}</button>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: isPlaying ? '60%' : '0%', background: gradients.call, transition: 'width 0.4s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{fmt(v.durationSec)}</span>
                </div>

                <AIPanel title="AVA summary" accent={colors.avaViolet} style={{ marginTop: 10 }}>
                  <div style={{ fontSize: font.sm, color: colors.textIce, lineHeight: 1.5 }}>{v.summary}</div>
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: 10, color: colors.avaCyan, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Transcript</div>
                    <div style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.5 }}>{v.transcript}</div>
                  </div>
                </AIPanel>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <GhostButton tone="cyan" onClick={() => haptic?.(ImpactStyle.Medium)}>📞 Call back</GhostButton>
                  <GhostButton tone="violet" onClick={() => haptic?.()}>💬 SMS</GhostButton>
                  <GhostButton tone="gold" onClick={() => haptic?.()}>✓ Done</GhostButton>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
