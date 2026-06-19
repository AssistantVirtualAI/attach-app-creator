import React, { useEffect, useRef, useState } from 'react';
import type { ImpactStyle } from '@capacitor/haptics';
import { Moon, Sun } from 'lucide-react';
import { colors, font, gradients, radius } from '../lib/theme';
import { mobileApi, DomainStats, MeResponse, StatsRange } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, Skeleton, StatusDot, AIPanel, GhostButton } from '../components/ui/Primitives';
import { LemtelMark, AvaBadge, HeroGradient } from '../components/Brand';
import { useAutoSync } from '../hooks/useAutoSync';
import { useTheme } from '../lib/ThemeContext';
import { useMobileCredentials } from '../hooks/useMobileCredentials';
import { restGet } from '../lib/mobileSupabase';
import type { Tab } from '../components/BottomTabs';
import NotificationsSheet, { NotificationBell, useNotificationCounts } from '../components/NotificationsSheet';

const RANGE_LABELS: Record<StatsRange, string> = { today: 'Today', '7d': '7 days', '30d': '30 days' };
const AI_CACHE_KEY = (range: string) => `ava.aisummary.${range}`;

export default function DashboardScreen({
  onNavigate, haptic, onOpenProfile,
}: { onNavigate: (t: Tab) => void; haptic: (s?: ImpactStyle) => Promise<void>; onOpenProfile?: () => void }) {
  const { mode, toggle } = useTheme();
  const [range, setRange] = useState<StatsRange>('today');
  const [notifOpen, setNotifOpen] = useState(false);
  const notifCounts = useNotificationCounts();
  const me = useAutoSync<MeResponse>(() => mobileApi.me(), { intervalMs: 5 * 60_000 });
  const stats = useAutoSync<DomainStats>(() => mobileApi.domainStats(range), { intervalMs: 60_000, deps: [range] });
  const m = me.data; const s = stats.data;

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!s) return;
    const sig = `${range}|${s.totalCalls ?? s.callsToday ?? 0}|${s.answered ?? 0}|${s.missed ?? 0}|${s.peakHour ?? ''}`;
    if (lastKeyRef.current === sig) return;
    lastKeyRef.current = sig;
    try {
      const cached = localStorage.getItem(AI_CACHE_KEY(sig));
      if (cached) { setAiSummary(cached); return; }
    } catch {}
    setAiLoading(true); setAiError(null);
    mobileApi.aiSummary(range, s, RANGE_LABELS[range])
      .then((r) => {
        setAiSummary(r.summary || '');
        try { localStorage.setItem(AI_CACHE_KEY(sig), r.summary || ''); } catch {}
      })
      .catch((e) => setAiError(e?.message || 'AVA summary failed'))
      .finally(() => setAiLoading(false));
  }, [s, range]);


  const total = s?.totalCalls ?? s?.callsToday ?? 0;
  const answered = s?.answered ?? s?.answeredToday ?? 0;
  const missed = s?.missed ?? s?.missedToday ?? 0;
  const voicemails = s?.voicemails ?? s?.voicemailsToday ?? 0;
  const buckets = s?.buckets ?? s?.last7Days ?? [];

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
              Call history · {RANGE_LABELS[range]}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {s ? <StatusDot state="registered" /> : <Skeleton w={40} h={14} />}
            <button
              onClick={() => { haptic(); toggle(); }}
              aria-label="Toggle theme"
              title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: colors.textIce, cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <button
                onClick={onOpenProfile}
                aria-label="My profile"
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${colors.lemtelBlue}, ${colors.avaCyan})`,
                  color: '#fff', fontWeight: 800, fontSize: 13, border: '2px solid rgba(255,255,255,0.85)',
                  cursor: 'pointer', display: 'grid', placeItems: 'center',
                  boxShadow: '0 8px 18px -8px rgba(7,22,168,0.45)',
                }}
              >
                {(m?.user?.name || m?.user?.email || 'U').split(/[\s@]/)[0].slice(0, 2).toUpperCase()}
              </button>
              <NotificationBell onClick={() => setNotifOpen(true)} count={notifCounts.total} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: font.sm, color: colors.mutedSilver }}>
            {m ? `${m.domain.sipDomain || m.organization.name}` : <Skeleton w="60%" h={10} />}
          </div>
          <h1 style={{ fontSize: font.xxl, color: colors.textIce, margin: '6px 0 4px', fontWeight: 800, letterSpacing: -0.5 }}>
            {m ? `Hi, ${m.user.name.split(' ')[0]}` : <Skeleton w="60%" h={26} />}
          </h1>
          <p style={{ fontSize: font.base, color: colors.textSub, margin: 0, lineHeight: 1.5 }}>
            {s ? `${total} calls · ${answered} answered · ${missed} missed.` : <Skeleton w="100%" h={14} />}
          </p>
        </div>
      </HeroGradient>

      {/* Range tabs */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0 10px', padding: 4, background: 'rgba(255,255,255,0.08)', borderRadius: radius.xl }}>
        {(Object.keys(RANGE_LABELS) as StatsRange[]).map((r) => (
          <button key={r} onClick={() => { haptic(); setRange(r); }} style={{
            flex: 1, padding: '8px 6px', borderRadius: radius.lg, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
            background: range === r ? `linear-gradient(135deg, ${colors.lemtelBlue}, ${colors.avaCyan})` : 'transparent',
            color: range === r ? '#fff' : colors.mutedSilver,
            transition: 'all .2s ease',
          }}>{RANGE_LABELS[r]}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Metric label="Total calls" value={s ? total : undefined} tone="cyan" />
        <Metric label="Answered" value={s ? answered : undefined} tone="success" />
        <Metric label="Missed" value={s ? missed : undefined} tone="danger" />
        <Metric label="Voicemails" value={s ? voicemails : undefined} tone="gold" />
        <Metric label="Answer rate" value={s?.answerRate != null ? `${s.answerRate}%` : undefined} tone="success" />
        <Metric label="Avg duration" value={s?.avgDurationSec != null ? `${s.avgDurationSec}s` : undefined} tone="violet" />
        <Metric label="Total talk" value={s?.totalTalkSec != null ? fmtTalk(s.totalTalkSec) : undefined} tone="cyan" />
        <Metric label="Peak hour" value={s?.peakHour != null ? `${s.peakHour}:00` : undefined} tone="gold" />
        <Metric label="Outbound" value={s?.outboundCalls ?? undefined} tone="cyan" />
        <Metric label="Failed dials" value={s?.dialFailedCount ?? undefined} tone="danger" />
        <Metric label="Dial success" value={s?.dialSuccessRate != null ? `${s.dialSuccessRate}%` : undefined} tone="success" />
        <Metric label="Active ext." value={s?.activeExtensions ?? undefined} tone="violet" />
      </div>

      {m?.extension?.number && (
        <>
          <SectionTitle eyebrow="My extension" title={`Ext ${m.extension.number} · ${RANGE_LABELS[range]}`} />
          <MyExtensionStats range={range} extension={m.extension.number} domainUuid={m.domain.fusionpbxDomainUuid} />
        </>
      )}

      <SectionTitle eyebrow={RANGE_LABELS[range]} title="Calls per day" />
      <Card padded={true}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, buckets.length)}, 1fr)`, gap: range === '30d' ? 2 : 6, alignItems: 'end', height: 90 }}>
          {(buckets.length ? buckets : Array(7).fill(0)).map((v, i) => {
            const max = Math.max(1, ...(buckets.length ? buckets : [1]));
            const h = Math.max(6, Math.round((v / max) * 84));
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', height: h, borderRadius: 4,
                  background: `linear-gradient(180deg, ${colors.lemtelBlue}, ${colors.blueGlow})`,
                  opacity: s ? 1 : 0.25,
                }} />
                {range !== '30d' && (
                  <span style={{ fontSize: 9, color: colors.mutedSilver }}>{dayLabel(i, buckets.length || 7)}</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <SectionTitle eyebrow="Insights" title={`Top extensions · ${RANGE_LABELS[range]}`} />
      {!s && [1,2,3].map(i => <Card key={i} style={{ marginBottom: 8 }}><Skeleton w="60%" h={12} /></Card>)}
      {s && s.topExtensions.length === 0 && (
        <Card><div style={{ fontSize: font.sm, color: colors.mutedSilver, textAlign: 'center' }}>No activity in this range.</div></Card>
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

      <SectionTitle eyebrow="AVA assistant" title={`AVA summary · ${RANGE_LABELS[range]}`} />
      <AIPanel title="What AVA sees" accent={colors.avaViolet} right={<GhostButton tone="violet" style={{ padding: '6px 10px' }} onClick={() => onNavigate('ava')}>Open chat</GhostButton>}>
        {!s ? (
          <Skeleton w="100%" h={42} />
        ) : (
          <div style={{ fontSize: font.base, lineHeight: 1.55, color: colors.textIce }}>
            {aiLoading && !aiSummary ? (
              <Skeleton w="100%" h={42} />
            ) : aiError && !aiSummary ? (
              <p style={{ margin: '0 0 8px', color: colors.danger, fontSize: font.sm }}>{aiError}</p>
            ) : aiSummary ? (
              <p style={{ margin: '0 0 8px' }}>{aiSummary}</p>
            ) : (
              <p style={{ margin: '0 0 8px' }}>
                {total === 0
                  ? `No calls in this range yet — refresh once new CDRs land.`
                  : `Across ${RANGE_LABELS[range].toLowerCase()}, ${total} calls · ${answered} answered, ${missed} missed.`}
              </p>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {(['today','7d','30d'] as StatsRange[]).map((r) => (
                <button key={r} onClick={() => { haptic(); setRange(r); }} style={{
                  padding: '4px 10px', borderRadius: 999, border: `1px solid ${colors.border}`,
                  background: range === r ? colors.avaViolet : 'transparent',
                  color: range === r ? '#fff' : colors.textSub, fontSize: 10.5, fontWeight: 700,
                  letterSpacing: 0.6, textTransform: 'uppercase', cursor: 'pointer',
                }}>{RANGE_LABELS[r]}</button>
              ))}
            </div>
          </div>
        )}
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

function fmtTalk(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h${m}m`;
  return `${m}m`;
}

function Metric({ label, value, tone }: { label: string; value?: number | string; tone: 'success' | 'danger' | 'cyan' | 'gold' | 'violet' }) {
  const c = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'cyan' ? colors.avaCyan : tone === 'gold' ? colors.signalGold : colors.avaViolet;
  return (
    <Card padded={true} style={{ padding: 14 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: c, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: colors.textIce, marginTop: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: -0.5 }}>
        {value ?? <Skeleton w={40} h={22} />}
      </div>
    </Card>
  );
}

function MyExtensionStats({ range, extension, domainUuid }: { range: StatsRange; extension: string; domainUuid?: string | null }) {
  const mobile = useMobileCredentials();
  const [s, setS] = React.useState<{ total: number; answered: number; missed: number; voicemails: number; recordings: number; avgSec: number } | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!mobile.accessToken || !domainUuid) return;
    const now = new Date();
    const since = new Date(now);
    if (range === 'today') since.setHours(0, 0, 0, 0);
    else if (range === '7d') since.setDate(now.getDate() - 7);
    else since.setDate(now.getDate() - 30);
    const sinceIso = since.toISOString();
    const url = `/rest/v1/pbx_call_records?select=id,call_status,duration_seconds,has_recording,direction&domain_uuid=eq.${encodeURIComponent(domainUuid)}&extension=eq.${encodeURIComponent(extension)}&start_at=gte.${encodeURIComponent(sinceIso)}&limit=1000`;
    restGet<any[]>(url, mobile.accessToken)
      .then((rows) => {
        const r = rows || [];
        const total = r.length;
        const answered = r.filter((x) => (x.call_status || '').toLowerCase() === 'answered').length;
        const missed = r.filter((x) => ['missed', 'no_answer', 'noanswer'].includes(String(x.call_status || '').toLowerCase())).length;
        const voicemails = r.filter((x) => String(x.call_status || '').toLowerCase().includes('voicemail')).length;
        const recordings = r.filter((x) => !!x.has_recording).length;
        const dur = r.reduce((a, x) => a + (Number(x.duration_seconds) || 0), 0);
        setS({ total, answered, missed, voicemails, recordings, avgSec: total ? Math.round(dur / total) : 0 });
      })
      .catch((e) => setErr(e?.message || 'Failed'));
  }, [mobile.accessToken, domainUuid, extension, range]);

  if (err) return <Card accent="gold"><div style={{ fontSize: font.sm, color: colors.danger }}>{err}</div></Card>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      <Metric label="My calls" value={s?.total} tone="cyan" />
      <Metric label="My answered" value={s?.answered} tone="success" />
      <Metric label="My missed" value={s?.missed} tone="danger" />
      <Metric label="My voicemails" value={s?.voicemails} tone="gold" />
      <Metric label="My recordings" value={s?.recordings} tone="violet" />
      <Metric label="My avg duration" value={s != null ? `${s.avgSec}s` : undefined} tone="cyan" />
    </div>
  );
}
