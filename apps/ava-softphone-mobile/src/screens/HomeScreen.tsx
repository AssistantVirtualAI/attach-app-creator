import React, { useEffect, useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import { colors, gradients, font, radius } from '../lib/theme';
import { mobileApi, DashboardBrief, MeResponse } from '../lib/mobileApi';
import { Card, Chip, StatusDot, SectionTitle, AIPanel, Skeleton, PrimaryButton, GhostButton } from '../components/ui/Primitives';
import { LemtelMark, AvaBadge, HeroGradient } from '../components/Brand';
import type { Tab } from '../components/BottomTabs';

interface Props { onNavigate: (t: Tab) => void; haptic: (s?: ImpactStyle) => Promise<void> }

export default function HomeScreen({ onNavigate, haptic }: Props) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [data, setData] = useState<DashboardBrief | null>(null);

  useEffect(() => {
    mobileApi.me().then(setMe);
    mobileApi.dashboard().then(setData);
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      {/* Account header */}
      <HeroGradient>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LemtelMark size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: font.lg, fontWeight: 800, color: colors.textIce, letterSpacing: -0.3 }}>Lemtel</span>
              <AvaBadge />
            </div>
            <div style={{ fontSize: 10.5, color: colors.signalGold, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2 }}>
              AI Phone
            </div>
          </div>
          {data ? <StatusDot state={data.status.sipState} /> : <Skeleton w={50} h={14} />}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: font.sm, color: colors.mutedSilver }}>
            {me ? `${me.dataScope === 'domain_admin' ? 'Admin domaine' : 'Extension'} ${me.extension.number} · ${me.domain.sipDomain || me.organization.name}` : <Skeleton w="60%" h={10} />}
          </div>
          <h1 style={{ fontSize: font.xxl, color: colors.textIce, margin: '6px 0 4px', fontWeight: 800, letterSpacing: -0.5 }}>
            {data?.greeting || (me ? `Good morning, ${me.user.name.split(' ')[0]}` : <Skeleton w="70%" h={26} />)}
          </h1>
          <p style={{ fontSize: font.base, color: colors.textSub, margin: 0, lineHeight: 1.5 }}>
            {data?.brief || <Skeleton w="100%" h={14} />}
          </p>
        </div>
      </HeroGradient>

      {/* Quick actions */}
      <SectionTitle eyebrow="Shortcuts" title="Quick actions" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <QuickAction label="Call" icon="☎" tone="gold" onPress={() => { haptic(ImpactStyle.Medium); onNavigate('calls'); }} />
        <QuickAction label="Message" icon="✉" tone="cyan" onPress={() => { haptic(); onNavigate('messages'); }} />
        <QuickAction label="Ask AVA" icon="✦" tone="violet" onPress={() => { haptic(); onNavigate('ai'); }} />
        <QuickAction label="Greeting" icon="◉" tone="violet" onPress={() => { haptic(); onNavigate('ai'); }} />
        <QuickAction label="Forwarding" icon="↪" tone="gold" onPress={() => { haptic(); onNavigate('settings'); }} />
        <QuickAction label="Voicemail" icon="✉" tone="cyan" onPress={() => { haptic(); onNavigate('calls'); }} />
      </div>

      {/* Data scope */}
      <SectionTitle eyebrow="Real PBX data" title="Access scope" />
      <Card padded={true} style={{ marginBottom: 10, background: 'linear-gradient(145deg, rgba(23,198,204,0.12), rgba(255,255,255,0.045))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, display: 'grid', placeItems: 'center', background: gradients.ai, fontSize: 18 }}>⌁</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: font.base, fontWeight: 800, color: colors.textIce }}>{data?.scope.label || (me?.dataScope === 'domain_admin' ? 'Domain admin' : 'Extension user')}</div>
            <div style={{ fontSize: font.sm, color: colors.mutedSilver, marginTop: 2 }}>{me ? `${me.client?.name ? `${me.client.name} · ` : ''}${me.organization.name} · ${me.domain.sipDomain || me.extension.sipDomain}` : 'Loading secure domain scope…'}</div>
          </div>
          <Chip tone={me?.permissions.admin ? 'gold' : 'cyan'}>{me?.permissions.admin ? 'Admin' : 'User'}</Chip>
        </div>
      </Card>

      {me?.status?.updatedAt && (
        <div style={{ margin: '8px 2px 0', fontSize: font.xs, color: colors.mutedSilver }}>
          PBX status synced {new Date(me.status.updatedAt).toLocaleString()}
        </div>
      )}

      {/* Communication health */}
      <SectionTitle eyebrow="Today" title="Communication health" />
      <AnswerRateHero
        answered={data?.metrics.answeredCalls}
        missed={data?.metrics.missedCalls}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
        <Metric label="Missed" value={data?.metrics.missedCalls} tone="danger" icon="↘" trend={-12} />
        <Metric label="Answered" value={data?.metrics.answeredCalls} tone="success" icon="↗" trend={+18} />
        <Metric label="Unread SMS" value={data?.metrics.unreadSms} tone="cyan" icon="✉" trend={+4} />
        <Metric label="Voicemail" value={data?.metrics.voicemails} tone="gold" icon="◉" trend={-2} />
        {me?.permissions.admin && <Metric label="Active users" value={data?.metrics.activeUsers} tone="success" icon="◆" trend={+6} />}
        <Metric label="Action items" value={data?.metrics.actionItems} tone="violet" icon="✦" trend={+1} />
      </div>

      {/* Activity sparkline */}
      <SectionTitle eyebrow="Last 12 hours" title="Call activity" />
      <ActivitySpark answered={data?.metrics.answeredCalls ?? 0} missed={data?.metrics.missedCalls ?? 0} />

      {/* Needs attention */}
      <SectionTitle eyebrow="AVA prioritized" title="Needs attention" />
      {!data && <Card><Skeleton w="80%" h={12} /><div style={{ height: 8 }} /><Skeleton w="50%" h={10} /></Card>}
      {data?.needsAttention.map((n) => (
        <Card key={n.id} accent={n.accent === 'danger' ? 'gold' : (n.accent as any)} style={{ marginBottom: 10 }} onPress={() => haptic()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center',
              background: gradients.ai, fontSize: 16,
            }}>{n.kind === 'voicemail' ? '✉' : n.kind === 'callback' ? '↺' : '✓'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>{n.title}</div>
              <div style={{ fontSize: font.sm, color: colors.mutedSilver }}>{n.subtitle}</div>
            </div>
            <Chip tone={n.accent === 'gold' ? 'gold' : n.accent === 'cyan' ? 'cyan' : 'violet'}>{n.kind.replace('_', ' ')}</Chip>
          </div>
        </Card>
      ))}

      {/* AI brief */}
      <SectionTitle eyebrow="AVA Daily Brief" title="What changed since last login" />
      <AIPanel title="AVA Daily Brief" right={<GhostButton tone="cyan" style={{ padding: '6px 10px' }} onClick={() => onNavigate('ai')}>Open AI</GhostButton>}>
        <p style={{ fontSize: font.base, lineHeight: 1.55, color: colors.textIce, margin: 0 }}>
          {data?.brief || 'Generating today\'s brief…'}
        </p>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Chip tone="gold">{data?.metrics.actionItems ?? '·'} action items</Chip>
          <Chip tone="cyan">{data?.metrics.unreadSms ?? '·'} unread</Chip>
          <Chip tone="violet">AVA agents online</Chip>
        </div>
      </AIPanel>

      <div style={{ height: 80 }} />
    </div>
  );
}

function QuickAction({
  label, icon, tone, onPress,
}: { label: string; icon: string; tone: 'gold' | 'cyan' | 'violet'; onPress: () => void }) {
  const c = tone === 'gold' ? colors.signalGold : tone === 'cyan' ? colors.avaCyan : colors.avaViolet;
  return (
    <button onClick={onPress} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      minHeight: 78,
      padding: '14px 8px', borderRadius: radius.xl,
      background: `linear-gradient(155deg, ${c}1a, ${colors.graphite} 70%)`,
      border: `1px solid ${c}44`,
      color: colors.textIce, fontSize: font.sm, fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 24px -18px rgba(0,35,230,0.35)',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value?: number; tone: 'success' | 'danger' | 'cyan' | 'gold' }) {
  const c = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'cyan' ? colors.avaCyan : colors.signalGold;
  return (
    <Card padded={true} style={{ padding: 14 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: c, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: colors.textIce, marginTop: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: -0.5 }}>
        {value ?? <Skeleton w={40} h={22} />}
      </div>
    </Card>
  );
}
