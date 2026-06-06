import React, { useEffect, useState } from 'react';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, CallDetail } from '../lib/mobileApi';
import { Card, Chip, AIPanel, Skeleton, Waveform, GhostButton } from '../components/ui/Primitives';

export default function CallDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<CallDetail | null>(null);
  useEffect(() => { mobileApi.callDetail(id).then(setData); }, [id]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <button onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', marginBottom: 12,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${colors.border}`,
        borderRadius: 999, color: colors.textIce, fontSize: font.sm, cursor: 'pointer',
      }}>← Back</button>

      {!data && <Skeleton w="60%" h={22} />}
      {data && (
        <>
          <div style={{ marginBottom: 4, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, color: colors.signalGold, textTransform: 'uppercase' }}>
            {data.direction === 'in' ? 'Inbound call' : 'Outbound call'}
          </div>
          <h1 style={{ fontSize: font.xxl, color: colors.textIce, margin: '2px 0 6px', fontWeight: 800, letterSpacing: -0.3 }}>
            {data.customer || data.from}
          </h1>
          <div style={{ fontSize: font.sm, color: colors.mutedSilver, marginBottom: 14 }}>
            {new Date(data.startedAt).toLocaleString()} · {Math.floor(data.durationSec / 60)}:{(data.durationSec % 60).toString().padStart(2, '0')}
          </div>

          {/* Recording */}
          {data.hasRecording && (
            <Card style={{ marginBottom: 14 }} accent="gold">
              <Waveform progress={0.4} color={colors.signalGold} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 11, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>0:00</span>
                <button style={{
                  padding: '8px 16px', borderRadius: 999, border: 'none',
                  background: gradients.call, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>▶ Play</button>
                <span style={{ fontSize: 11, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>
                  {Math.floor(data.durationSec / 60)}:{(data.durationSec % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </Card>
          )}

          {/* AI Summary */}
          <AIPanel title="AVA Summary" accent={colors.avaViolet}>
            <p style={{ fontSize: font.base, lineHeight: 1.55, color: colors.textIce, margin: 0 }}>{data.summary}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Chip tone="gold">Quality {data.qualityScore}/100</Chip>
              <Chip tone={data.sentiment === 'positive' ? 'success' : data.sentiment === 'negative' ? 'danger' : 'neutral'}>{data.sentiment || 'neutral'}</Chip>
              <Chip tone="cyan">{data.intent}</Chip>
            </div>
          </AIPanel>

          {/* Action items */}
          <AIPanel title="Action items" accent={colors.success}>
            {data.actionItems.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i === data.actionItems.length - 1 ? 'none' : `1px solid ${colors.border}` }}>
                <span style={{ color: colors.success }}>→</span>
                <span style={{ fontSize: font.base, color: colors.textIce, lineHeight: 1.45 }}>{a}</span>
              </div>
            ))}
          </AIPanel>

          {/* Topics */}
          <AIPanel title="Topics" accent={colors.avaCyan}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.topics.map((t) => <Chip key={t} tone="cyan">{t}</Chip>)}
            </div>
          </AIPanel>

          {/* Transcript */}
          <AIPanel title="Transcript" accent={colors.signalGold}>
            {data.transcript.map((line, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: line.speaker === 'agent' ? 'flex-end' : 'flex-start',
                marginBottom: 8,
              }}>
                <div style={{
                  maxWidth: '85%', padding: '8px 12px', borderRadius: 14,
                  background: line.speaker === 'agent' ? gradients.call : colors.graphite2,
                  color: colors.textIce, fontSize: font.base, lineHeight: 1.5,
                  borderBottomRightRadius: line.speaker === 'agent' ? 4 : 14,
                  borderBottomLeftRadius:  line.speaker === 'agent' ? 14 : 4,
                }}>{line.text}</div>
                <div style={{ fontSize: 9.5, color: colors.mutedSilver, marginTop: 3, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>
                  {line.speaker} · {Math.floor(line.t / 60)}:{(line.t % 60).toString().padStart(2, '0')}
                </div>
              </div>
            ))}
          </AIPanel>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <GhostButton tone="gold" style={{ flex: 1 }}>Tag</GhostButton>
            <GhostButton tone="cyan" style={{ flex: 1 }}>Share</GhostButton>
            <GhostButton tone="violet" style={{ flex: 1 }}>Re-analyze</GhostButton>
          </div>

          <div style={{ height: 60 }} />
        </>
      )}
    </div>
  );
}
