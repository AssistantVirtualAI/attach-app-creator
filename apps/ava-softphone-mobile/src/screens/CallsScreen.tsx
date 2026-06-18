import React, { useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, CallRecord } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, Skeleton, EmptyState, PrimaryButton, GhostButton } from '../components/ui/Primitives';
import CallDetailScreen from './CallDetailScreen';
import Dialpad from '../components/Dialpad';
import VoicemailScreen from './VoicemailScreen';
import { useRealtimeCDR } from '../hooks/useRealtimeCDR';
import type { Creds } from '../lib/creds';

type SubTab = 'recents' | 'dial' | 'voicemail';

export default function CallsScreen({ sp, haptic, creds }: { sp: any; haptic: (s?: ImpactStyle) => Promise<void>; creds?: Creds | null }) {
  const [sub, setSub] = useState<SubTab>('recents');
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'missed' | 'recorded'>('all');
  const [number, setNumber] = useState('');

  // Real-time CDR via Supabase Realtime (postgres_changes) with automatic
  // 15s polling fallback + visible warning if the realtime channel fails.
  const { calls, transport, warning, dismissWarning } = useRealtimeCDR(creds || null);

  if (selected) return <CallDetailScreen id={selected} onBack={() => setSelected(null)} />;

  const filtered = (calls || []).filter((c) =>
    filter === 'all' ? true : filter === 'missed' ? c.status === 'missed' : c.hasRecording
  );

  const startCall = async (to: string) => {
    if (!to) return;
    await haptic(ImpactStyle.Medium);
    try { await mobileApi.startCall(to); } catch {}
    if (sp?.call) sp.call(to);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      {warning && (
        <div role="status" style={{
          marginBottom: 10, padding: '10px 12px', borderRadius: 12,
          background: 'rgba(245,158,11,0.12)', border: `1px solid ${colors.warning}55`,
          color: colors.warning, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>⚠ {warning}</span>
          <button onClick={dismissWarning} style={{ background: 'transparent', border: 'none', color: colors.warning, cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}
      <SegmentedControl value={sub} onChange={setSub} />
      {transport === 'realtime' && false /* could surface a "live" pill here */}

      {sub === 'dial' && (
        <div style={{ marginTop: 6 }}>
          <NumberDisplay value={number} onBackspace={() => { haptic(); setNumber((n) => n.slice(0, -1)); }} onClear={() => setNumber('')} />
          <Dialpad
            onPress={(k) => { haptic(ImpactStyle.Light); setNumber((n) => n + k); }}
            onLongPressZero={() => { haptic(ImpactStyle.Medium); setNumber((n) => n + '+'); }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <PrimaryButton onClick={() => startCall(number)} disabled={!number} style={{ flex: 1 }}>
              📞 Call
            </PrimaryButton>
            <GhostButton tone="cyan" onClick={() => sp?.snap?.status === 'connecting' ? null : haptic()}>
              {sp?.snap?.status === 'registered' ? 'SIP · Live' : sp?.snap?.status || 'Offline'}
            </GhostButton>
          </div>
          {sp?.snap?.status !== 'registered' && (
            <Card style={{ marginTop: 14 }} accent="gold">
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, color: colors.signalGold, textTransform: 'uppercase' }}>WebRTC unavailable</div>
              <p style={{ fontSize: font.sm, color: colors.mutedSilver, margin: '6px 0 10px', lineHeight: 1.5 }}>
                Your SIP is not registered yet. You can still place a click-to-call request that rings your deskphone.
              </p>
              <PrimaryButton onClick={() => startCall(number)} disabled={!number}>Click-to-call deskphone</PrimaryButton>
            </Card>
          )}
        </div>
      )}

      {sub === 'recents' && (
        <>
          <div style={{ display: 'flex', gap: 6, margin: '12px 0 10px' }}>
            {(['all', 'missed', 'recorded'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 12px', borderRadius: 999,
                background: filter === f ? colors.signalGold + '1a' : 'transparent',
                border: `1px solid ${filter === f ? colors.borderGold : colors.border}`,
                color: filter === f ? colors.signalGold : colors.mutedSilver,
                fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
              }}>{f}</button>
            ))}
          </div>

          {!calls && <ListSkeleton rows={6} />}
          {calls && filtered.length === 0 && (
            <EmptyState icon="📞" title="No calls yet" hint="Your call history will appear here. Tap the keypad to start one." cta={{ label: 'Open dialer', onPress: () => setSub('dial') }} />
          )}
          {calls && filtered.map((c) => <CallRow key={c.id} c={c} onPress={() => { haptic(); setSelected(c.id); }} />)}
        </>
      )}

      {sub === 'voicemail' && <div style={{ marginTop: 12 }}><VoicemailScreen haptic={haptic} /></div>}

      <div style={{ height: 80 }} />
    </div>
  );
}

function SegmentedControl({ value, onChange }: { value: SubTab; onChange: (v: SubTab) => void }) {
  const items: { id: SubTab; label: string }[] = [
    { id: 'recents', label: 'Recents' },
    { id: 'dial', label: 'Keypad' },
    { id: 'voicemail', label: 'Voicemail' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 4,
      padding: 4, borderRadius: radius.lg,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${colors.border}`,
    }}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} style={{
            padding: '10px 8px', borderRadius: radius.md, border: 'none',
            background: active ? gradients.call : 'transparent',
            color: active ? '#fff' : colors.mutedSilver,
            fontSize: font.sm, fontWeight: 700, cursor: 'pointer',
            transition: 'all .18s ease',
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}

function NumberDisplay({ value, onClear, onBackspace }: { value: string; onClear: () => void; onBackspace: () => void }) {
  return (
    <div style={{
      margin: '12px 0 16px', padding: '20px 16px',
      borderRadius: radius.xl,
      background: gradients.card,
      border: `1px solid ${colors.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      minHeight: 64,
    }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: value.length > 10 ? 22 : 28, color: colors.textIce, fontWeight: 600, letterSpacing: 0.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value || <span style={{ color: colors.mutedSilver, fontWeight: 400 }}>Enter number</span>}
      </span>
      {value && (
        <>
          <button onClick={onBackspace} style={{ background: 'transparent', border: 'none', color: colors.mutedSilver, fontSize: 22, cursor: 'pointer', padding: 4 }}>⌫</button>
          <button onClick={onClear} style={{ background: 'transparent', border: 'none', color: colors.mutedSilver, fontSize: 12, cursor: 'pointer' }}>Clear</button>
        </>
      )}
    </div>
  );
}

function CallRow({ c, onPress }: { c: CallRecord; onPress: () => void }) {
  const arrow = c.status === 'missed' ? '↙' : c.direction === 'in' ? '↘' : '↗';
  const arrowColor = c.status === 'missed' ? colors.danger : c.direction === 'in' ? colors.success : colors.avaCyan;
  return (
    <button onClick={onPress} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '12px 14px', marginBottom: 8,
      borderRadius: radius.lg,
      background: gradients.card,
      border: `1px solid ${colors.border}`,
      color: colors.textIce, cursor: 'pointer', textAlign: 'left',
    }}>
      <span style={{ color: arrowColor, fontSize: 18, width: 18, textAlign: 'center' }}>{arrow}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: font.base, fontWeight: 600, color: colors.textIce, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.customer || (c.direction === 'in' ? c.from : c.to)}
        </div>
        <div style={{ fontSize: font.xs, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
          {c.direction === 'in' ? c.from : c.to}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontSize: font.xs, color: colors.mutedSilver }}>{new Date(c.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {c.hasRecording && <Chip tone="gold" size="xs">REC</Chip>}
          {c.hasTranscript && <Chip tone="violet" size="xs">AI</Chip>}
        </div>
      </div>
    </button>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '24px 1fr 60px',
          alignItems: 'center', gap: 12, padding: 14, marginBottom: 8,
          borderRadius: 12, background: gradients.card, border: `1px solid ${colors.border}`,
        }}>
          <Skeleton w={16} h={16} r={999} />
          <div>
            <Skeleton w="55%" h={12} />
            <div style={{ height: 6 }} />
            <Skeleton w="35%" h={10} />
          </div>
          <Skeleton w={40} h={10} />
        </div>
      ))}
    </div>
  );
}
