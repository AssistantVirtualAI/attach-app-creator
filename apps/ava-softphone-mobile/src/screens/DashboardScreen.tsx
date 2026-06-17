import React from 'react';
import type { ImpactStyle } from '@capacitor/haptics';
import { colors, font, gradients, radius } from '../lib/theme';
import { mobileApi, DomainStats, MeResponse } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, Skeleton, StatusDot, AIPanel, GhostButton } from '../components/ui/Primitives';
import { LemtelMark, AvaBadge, HeroGradient } from '../components/Brand';
import { useAutoSync } from '../hooks/useAutoSync';
import type { Tab } from '../components/BottomTabs';

export default function DashboardScreen({
  onNavigate, haptic,
}: { onNavigate: (t: Tab) => void; haptic: (s?: ImpactStyle) => Promise<void> }) {
  const me = useAutoSync<MeResponse>(() => mobileApi.me(), { intervalMs: 5 * 60_000 });
  const stats = useAutoSync<DomainStats>(() => mobileApi.domainStats(), { intervalMs: 60_000 });
  const m = me.data; const s = stats.data;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <HeroGradient>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LemtelMark size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: font.lg, fontWeight: 800, color: colors.textIce, letterSpacing: -0.3 }}>AVA Softphone</span>
              <AvaBadge />
            </div>
            <div style={{ fontSize: 10.5, color: colors.signalGold, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2 }}>
              Domain dashboard
            </div>
          </div>
          {s ? <StatusDot state="registered" /> : <Skeleton w={60} h={14} />}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: font.sm, color: colors.mutedSilver }}>
            {m ? `${m.domain.sipDomain || m.organization.name}` : <Skeleton w="60%" h={10} />}
          </div>
          <h1 style={{ fontSize: font.xxl, color: colors.textIce, margin: '6px 0 4px', fontWeight: 800, letterSpacing: -0.5 }}>
            {m ? `Hi, ${m.user.name.split(' ')[0]}` : <Skeleton w="60%" h={26} />}
          </h1>
          <p style={{ fontSize: font.base, color: colors.textSub, margin: 0, lineHeight: 1.5 }}>
            {s ? `${s.callsToday} calls today · ${s.answeredToday} answered · ${s.missedToday} missed.` : <Skeleton w="100%" h={14} />}
          </p>
        </div>
      </HeroGradient>

      <SectionTitle eyebrow="Live" title="Today across the domain" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Metric label="Total calls" value={s?.callsToday} tone="cyan" />
        <Metric label="Answered" value={s?.answeredToday} tone="success" />
        <Metric label="Missed" value={s?.missedToday} tone="danger" />
        <Metric label="Voicemails" value={s?.voicemailsToday} tone="gold" />
        <Metric label="Avg duration" value={s?.avgDurationSec != null ? `${Math.round(s.avgDurationSec)}s` : undefined} tone="violet" />
        <Metric label="Active ext." value={s?.activeExtensions} tone="cyan" />
      </div>

      <SectionTitle eyebrow="Last 7 days" title="Weekly overview" />
      <Card padded={true}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'end', height: 90 }}>
          {(s?.last7Days || Array(7).fill(0)).map((v, i) => {
            const max = Math.max(1, ...(s?.last7Days || [1]));
            const h = Math.max(6, Math.round((v / max) * 84));
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', height: h, borderRadius: 6,
                  background: `linear-gradient(180deg, ${colors.lemtelBlue}, ${colors.blueGlow})`,
                  opacity: s ? 1 : 0.25,
                }} />
                <span style={{ fontSize: 9, color: colors.mutedSilver }}>{dayLabel(i, s?.last7Days?.length || 7)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <SectionTitle eyebrow="Insights" title="Top extensions today" />
      {!s && [1,2,3].map(i => <Card key={i} style={{ marginBottom: 8 }}><Skeleton w="60%" h={12} /></Card>)}
      {s && s.topExtensions.length === 0 && (
        <Card><div style={{ fontSize: font.sm, color: colors.mutedSilver, textAlign: 'center' }}>No activity yet today.</div></Card>
      )}
      {s && s.topExtensions.map((ext, i) => (
        <Card key={ext.extension} style={{ marginBottom: 8 }} padded={true}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 800, color: colors.lemtelBlue, minWidth: 28 }}>#{i+1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>Ext {ext.extension}</div>
              <div style={{ fontSize: font.xs, color: colors.mutedSilver }}>{ext.name || '—'}</div>
            </div>
            <Chip tone="cyan">{ext.calls} calls</Chip>
          </div>
        </Card>
      ))}

      <SectionTitle eyebrow="AVA assistant" title="Ask anything" />
      <AIPanel title="Talk to AVA" right={<GhostButton tone="violet" style={{ padding: '6px 10px' }} onClick={() => onNavigate('ava')}>Open chat</GhostButton>}>
        <p style={{ fontSize: font.base, lineHeight: 1.55, color: colors.textIce, margin: 0 }}>
          Ask about today's calls, missed customers, recordings or queue performance.
        </p>
      </AIPanel>

      {stats.lastSyncedAt && (
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: font.xs, color: colors.mutedSilver }}>
          Synced {new Date(stats.lastSyncedAt).toLocaleTimeString()} · auto-refresh every 60s
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}

function dayLabel(i: number, total: number) {
  const d = new Date(); d.setDate(d.getDate() - (total - 1 - i));
  return ['S','M','T','W','T','F','S'][d.getDay()];
}

function Metric({ label, value, tone }: { label: string; value?: number | string; tone: 'success' | 'danger' | 'cyan' | 'gold' | 'violet' }) {
  const c = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'cyan' ? colors.avaCyan : tone === 'gold' ? colors.signalGold : colors.avaViolet;
  return (
    <Card padded={true} style={{ padding: 14 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: c, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: colors.textIce, marginTop: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: -0.5 }}>
        {value ?? <Skeleton w={40} h={22} />}
      </div>
    </Card>
  );
}
