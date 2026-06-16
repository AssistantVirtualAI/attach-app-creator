import React, { useEffect, useMemo, useRef, useState } from 'react';
import { theme } from '../../lib/theme';
import { useTenant } from '../../hooks/useTenant';
import { useDashboardStats, AttentionItem, RangeKey, DailySeries, rangeBounds } from '../../hooks/useDashboardStats';
import { useSyncStatus, formatAge } from '../../hooks/useSyncStatus';
import { supabase } from '../../lib/supabaseClient';

const { colors: c } = theme;

const STORAGE_KEY = 'ava.home.range.v1';
const VALID_METRICS = new Set(['calls','missed','answered','recordings','voicemail','sms','live','realtime']);
const VALID_RANGES = new Set(['today','week','month','custom']);

// Inject one-time style for keyframes + visible focus rings on tiles/buttons.
const STYLE_ID = 'ava-home-a11y-style';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes avaSlideInRight { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
    @keyframes avaShimmer { 0% { background-position: -200px 0 } 100% { background-position: 200px 0 } }
    .ava-stat-tile:focus-visible { outline: 3px solid #ffffff; outline-offset: 3px; box-shadow: 0 0 0 5px rgba(0,35,230,0.55), 0 10px 28px -14px rgba(8,14,32,0.45) !important; }
    .ava-range-btn:focus-visible, .ava-quick-btn:focus-visible, .ava-drawer-close:focus-visible { outline: 3px solid #0023e6; outline-offset: 2px; }
    .ava-spark-skel { background: linear-gradient(90deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.10) 100%); background-size: 400px 100%; animation: avaShimmer 1.2s linear infinite; }
  `;
  document.head.appendChild(s);
}


function fmtRelative(iso: string | null) {
  if (!iso) return 'No CDR yet';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'No CDR yet';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type Tone = {
  from: string;
  to: string;
  ring: string;   // strong border / focus ring
  shadow: string; // glow
};

// Deeper, AA-contrast tones for white text on the gradient surface.
const tones: Record<string, Tone> = {
  cyan:   { from: '#0e7490', to: '#0891b2', ring: 'rgba(8,145,178,0.85)',  shadow: 'rgba(8,145,178,0.45)' },
  red:    { from: '#b91c1c', to: '#dc2626', ring: 'rgba(185,28,28,0.85)',  shadow: 'rgba(185,28,28,0.45)' },
  green:  { from: '#047857', to: '#0f9d58', ring: 'rgba(4,120,87,0.85)',   shadow: 'rgba(4,120,87,0.45)' },
  gold:   { from: '#a16207', to: '#d4a73a', ring: 'rgba(161,98,7,0.85)',   shadow: 'rgba(161,98,7,0.45)' },
  violet: { from: '#5b21b6', to: '#7a4cff', ring: 'rgba(91,33,182,0.85)',  shadow: 'rgba(91,33,182,0.45)' },
  blue:   { from: '#1e3a8a', to: '#0023e6', ring: 'rgba(0,35,230,0.85)',   shadow: 'rgba(0,35,230,0.45)' },
  pink:   { from: '#9d174d', to: '#db2777', ring: 'rgba(157,23,77,0.85)',  shadow: 'rgba(157,23,77,0.45)' },
  slate:  { from: '#334155', to: '#475569', ring: 'rgba(51,65,85,0.85)',   shadow: 'rgba(51,65,85,0.45)' },
};

type MetricKey = 'calls' | 'missed' | 'answered' | 'recordings' | 'voicemail' | 'sms' | 'live' | 'realtime';

function Sparkline({ data, color = 'rgba(255,255,255,0.95)' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const w = 100, h = 28;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => `${(i * step).toFixed(2)},${(h - (v / max) * (h - 4) - 2).toFixed(2)}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 28, display: 'block' }} aria-hidden>
      <polygon points={area} fill="rgba(255,255,255,0.18)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({
  label, value, tone, hint, series, onClick,
}: {
  label: string; value: string | number; tone: Tone; hint?: string;
  series?: number[]; onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className="ava-lift ava-focus"
      aria-label={`${label}: ${value}${hint ? ` — ${hint}` : ''}`}
      style={{
        textAlign: 'left',
        background: `linear-gradient(135deg, ${tone.from} 0%, ${tone.to} 100%)`,
        border: `1px solid ${tone.ring}`,
        borderRadius: 18, padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 6,
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 10px 28px -14px ${tone.shadow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        color: '#fff',
        cursor: interactive ? 'pointer' : 'default',
        font: 'inherit',
      }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,0.28), transparent 55%)',
        pointerEvents: 'none',
      }} />
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.95)', position: 'relative' }}>{label}</span>
      <span className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.6, lineHeight: 1.05, position: 'relative', textShadow: '0 2px 12px rgba(0,0,0,0.20)' }}>{value}</span>
      {series && series.length > 0 && (
        <div style={{ position: 'relative', marginTop: 2 }}>
          <Sparkline data={series} />
        </div>
      )}
      {hint && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.92)', position: 'relative' }}>{hint}</span>}
    </button>
  );
}

function attentionTone(item: AttentionItem): Tone {
  if (item.tone === 'danger') return tones.red;
  if (item.tone === 'warn') return tones.gold;
  if (item.tone === 'success') return tones.green;
  return tones.cyan;
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
  { key: 'custom', label: 'Custom' },
];

function loadPersistedRange(): { range: RangeKey; customFrom: string; customTo: string } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v?.range) return null;
    return { range: v.range, customFrom: v.customFrom || '', customTo: v.customTo || '' };
  } catch { return null; }
}

export default function HomeDashboard({
  displayName, extension, onQuickDial,
}: { displayName: string; extension: string; onQuickDial: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const { orgId, orgName, extension: tenantExt } = useTenant();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); }, []);

  const persisted = useMemo(() => loadPersistedRange(), []);
  const [range, setRange] = useState<RangeKey>(persisted?.range ?? 'today');
  const [customFrom, setCustomFrom] = useState<string>(persisted?.customFrom || weekAgo);
  const [customTo, setCustomTo] = useState<string>(persisted?.customTo || today);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ range, customFrom, customTo })); } catch { /* noop */ }
  }, [range, customFrom, customTo]);

  const stats = useDashboardStats(orgId, tenantExt || extension, range, customFrom, customTo);
  const { pbx, syncConnected, lastEvent, ageMs, healthy } = useSyncStatus();
  const freshnessAccent = stats.cdrFreshness === 'live' ? c.success : stats.cdrFreshness === 'stale' ? c.signalGold : c.mutedSilver;
  const rangeLabel = range === 'today' ? 'Today' : range === 'week' ? 'Last 7 days' : range === 'month' ? 'Last 30 days' : `${customFrom} → ${customTo}`;

  const [detail, setDetail] = useState<null | { metric: MetricKey; title: string; tone: Tone }>(null);
  const openDetail = (metric: MetricKey, title: string, tone: Tone) => setDetail({ metric, title, tone });

  return (
    <div className="ava-page" style={{ padding: '28px 32px', maxWidth: 1240, margin: '0 auto', animation: 'fadeIn .3s ease-out' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: c.signalGold, textTransform: 'uppercase', flexWrap: 'wrap' }}>
          <span>Command Center</span>
          {orgName && (
            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(33,212,253,0.10)', border: `1px solid ${c.borderAI}`, color: c.avaCyan, fontSize: 10, letterSpacing: 1 }}>
              {orgName}
            </span>
          )}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: c.mutedSilver, letterSpacing: 0.6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: healthy ? c.cyan : pbx === 'error' ? c.danger : c.mutedSilver, boxShadow: `0 0 8px currentColor` }} />
            {pbx === 'registered' ? 'PBX Online' : pbx === 'error' ? 'PBX Error' : 'Connecting'} · {syncConnected ? (lastEvent ? `Sync ${formatAge(ageMs)}` : 'Sync Live') : 'Sync Offline'}
          </span>
        </div>
        <h1 className="ava-display" style={{ fontSize: 34, fontWeight: 600, color: c.textIce, margin: '8px 0 6px', letterSpacing: -0.7, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.1 }}>
          {greeting}, {displayName.split(' ')[0] || 'there'}
        </h1>
        <p style={{ fontSize: 13.5, color: c.mutedSilver, margin: 0, lineHeight: 1.55 }}>
          Ext {extension} · Live CDR, recordings, voicemail and AVA insights for your extension.
        </p>
      </header>

      {/* Range selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, color: c.mutedSilver, textTransform: 'uppercase', marginRight: 4 }}>Range</span>
        {RANGES.map((r) => {
          const active = range === r.key;
          return (
            <button key={r.key} onClick={() => setRange(r.key)} style={{
              padding: '7px 14px',
              borderRadius: 999,
              border: active ? '1px solid transparent' : `1px solid ${c.border}`,
              background: active
                ? `linear-gradient(135deg, ${tones.blue.from}, ${tones.cyan.to})`
                : 'rgba(255,255,255,0.92)',
              color: active ? '#fff' : c.textIce,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
              cursor: 'pointer',
              boxShadow: active ? `0 6px 18px -8px ${tones.blue.shadow}` : 'none',
              transition: 'all 180ms ease',
            }}>{r.label}</button>
          );
        })}
        {range === 'custom' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} style={dateInput()} />
            <span style={{ color: c.mutedSilver, fontSize: 12 }}>→</span>
            <input type="date" value={customTo} min={customFrom} max={today} onChange={(e) => setCustomTo(e.target.value)} style={dateInput()} />
          </div>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: c.mutedSilver }}>{rangeLabel}</span>
      </div>

      <section
        className="ava-aurora-border"
        style={{
          background: 'linear-gradient(135deg, rgba(0,35,230,0.14), rgba(33,212,253,0.12), rgba(212,167,58,0.10))',
          border: `1px solid ${c.border}`,
          borderRadius: 20, padding: '22px 24px', marginBottom: 22,
          display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.9fr)', gap: 24, alignItems: 'center',
        }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2, color: c.avaCyan, textTransform: 'uppercase', marginBottom: 6 }}>
            Live Phone-System Brief · {rangeLabel}
          </div>
          <div style={{ fontSize: 14.5, color: c.textIce, lineHeight: 1.6 }}>
            {stats.loading ? 'Loading the live PBX picture…' : (
              <><strong style={{ color: c.signalGold }}>{stats.totalCallsToday} call{stats.totalCallsToday === 1 ? '' : 's'}</strong>, <strong style={{ color: c.success }}>{stats.answeredToday} answered</strong>, <strong style={{ color: c.danger }}>{stats.missedToday} missed</strong> and <strong style={{ color: c.avaCyan }}>{stats.recordingsToday} recording{stats.recordingsToday === 1 ? '' : 's'}</strong>. Latest CDR {fmtRelative(stats.lastCallAt)}.</>
            )}
          </div>
        </div>
        <div style={{ borderLeft: `1px solid ${c.border}`, paddingLeft: 20, display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.mutedSilver }}><span>CDR freshness</span><strong style={{ color: freshnessAccent }}>{stats.cdrFreshness.toUpperCase()}</strong></div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(11,21,48,0.08)', overflow: 'hidden' }}><div style={{ width: stats.cdrFreshness === 'live' ? '100%' : stats.cdrFreshness === 'stale' ? '58%' : '18%', height: '100%', background: `linear-gradient(90deg, ${freshnessAccent}, ${c.cyan})` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.mutedSilver }}><span>Recording coverage</span><strong style={{ color: c.signalGold }}>{stats.recordingCoveragePct}%</strong></div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(11,21,48,0.08)', overflow: 'hidden' }}><div style={{ width: `${Math.max(4, stats.recordingCoveragePct)}%`, height: '100%', background: `linear-gradient(90deg, ${c.signalGold}, ${c.goldSoft})` }} /></div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 26 }}>
        <Stat label={`Calls · ${rangeLabel}`} value={stats.totalCallsToday} tone={tones.cyan}
          series={stats.series.calls} hint="Scoped to extension"
          onClick={() => openDetail('calls', `All calls — ${rangeLabel}`, tones.cyan)} />
        <Stat label="Missed" value={stats.missedToday} tone={tones.red}
          series={stats.series.missed} hint={rangeLabel}
          onClick={() => openDetail('missed', `Missed calls — ${rangeLabel}`, tones.red)} />
        <Stat label="Answered" value={stats.answeredToday} tone={tones.green}
          series={stats.series.answered} hint={rangeLabel}
          onClick={() => openDetail('answered', `Answered calls — ${rangeLabel}`, tones.green)} />
        <Stat label="Recordings" value={stats.recordingsToday} tone={tones.gold}
          series={stats.series.recordings}
          hint={stats.lastRecordingAt ? `Latest ${fmtRelative(stats.lastRecordingAt)}` : 'None in range'}
          onClick={() => openDetail('recordings', `Recordings — ${rangeLabel}`, tones.gold)} />
        <Stat label="Unread SMS" value={stats.unreadSms} tone={tones.pink} hint="All threads"
          onClick={() => openDetail('sms', 'Unread SMS threads', tones.pink)} />
        <Stat label="Voicemail" value={stats.unreadVoicemail} tone={tones.violet} hint="Needs review"
          onClick={() => openDetail('voicemail', `Voicemails — ${rangeLabel}`, tones.violet)} />
        <Stat label="Live Calls" value={stats.liveCalls} tone={tones.blue} hint="In progress"
          onClick={() => openDetail('live', 'Live calls right now', tones.blue)} />
        <Stat label="Realtime" value={syncConnected ? 'Live' : 'Off'} tone={syncConnected ? tones.cyan : tones.slate}
          hint={lastEvent ? formatAge(ageMs) : 'Idle'}
          onClick={() => openDetail('realtime', 'Realtime sync status', syncConnected ? tones.cyan : tones.slate)} />
      </div>

      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 10 }}>
          Quick Actions
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onQuickDial} style={quickBtn(tones.gold)}>New Call</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'calls' }))} style={quickBtn(tones.cyan)}>Call History</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'recordings' }))} style={quickBtn(tones.violet)}>Recordings</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'messages' }))} style={quickBtn(tones.green)}>Messages</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'pbxlive' }))} style={quickBtn(tones.slate)}>PBX Live</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'admin' }))} style={quickBtn(tones.blue)}>PBX Admin</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'aiadmin' }))} style={quickBtn(tones.pink)}>AI Assistant</button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 10 }}>
          Needs Attention
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stats.attention.map((it, i) => {
            const tone = attentionTone(it);
            return (
              <div key={`${it.tag}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px',
                background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`,
                border: `1px solid ${tone.ring}`,
                borderRadius: 14,
                boxShadow: `0 10px 24px -14px ${tone.shadow}`,
                color: '#fff',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: 'rgba(255,255,255,0.22)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  display: 'grid', placeItems: 'center', color: '#fff',
                  fontWeight: 800, fontSize: 14,
                }}>{it.tag.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{it.title}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>{it.detail}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: 0.8,
                  padding: '5px 10px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.22)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.45)',
                }}>{it.tag}</span>
              </div>
            );
          })}
        </div>
      </div>

      {detail && (
        <MetricDetailDrawer
          metric={detail.metric}
          title={detail.title}
          tone={detail.tone}
          orgId={orgId}
          extension={tenantExt || extension}
          range={range}
          customFrom={customFrom}
          customTo={customTo}
          series={stats.series}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

const quickBtn = (tone: Tone): React.CSSProperties => ({
  padding: '11px 18px',
  background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`,
  border: `1px solid ${tone.ring}`,
  borderRadius: 12,
  color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
  cursor: 'pointer',
  transition: 'all 200ms cubic-bezier(.2,.7,.2,1)',
  boxShadow: `0 8px 20px -12px ${tone.shadow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
});

const dateInput = (): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid ${c.border}`,
  background: 'rgba(255,255,255,0.98)',
  color: c.textIce,
  fontSize: 12,
  fontWeight: 600,
});

/* ---------------- Metric Detail Drawer ---------------- */

import { rangeBounds } from '../../hooks/useDashboardStats';

function MetricDetailDrawer(props: {
  metric: MetricKey;
  title: string;
  tone: Tone;
  orgId: string | null;
  extension: string | null;
  range: RangeKey;
  customFrom: string;
  customTo: string;
  series: DailySeries;
  onClose: () => void;
}) {
  const { metric, title, tone, orgId, extension, range, customFrom, customTo, series, onClose } = props;
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!orgId) { setRows([]); return; }
        if (metric === 'sms') {
          let q = supabase.from('pbx_sms_threads')
            .select('id, peer_number, last_message_at, unread_count')
            .eq('organization_id', orgId)
            .gt('unread_count', 0)
            .order('last_message_at', { ascending: false })
            .limit(50);
          if (extension) q = q.eq('extension', extension);
          const { data } = await q;
          if (!cancelled) setRows(data || []);
          return;
        }
        if (metric === 'live') {
          let q = supabase.from('telecom_live_calls')
            .select('id, caller_id_number, destination_number, started_at, extension')
            .eq('organization_id', orgId)
            .order('started_at', { ascending: false })
            .limit(50);
          if (extension) q = q.eq('extension', extension);
          const { data } = await q;
          if (!cancelled) setRows(data || []);
          return;
        }
        if (metric === 'realtime') { if (!cancelled) setRows([]); return; }

        const { from, to } = rangeBounds(range, customFrom, customTo);
        let q = supabase.from('pbx_call_records')
          .select('id, caller_id_number, destination_number, start_at, duration, missed_call, call_status, hangup_cause, has_recording, recording_name, recording_path, voicemail_message, extension')
          .eq('organization_id', orgId)
          .gte('start_at', from)
          .lte('start_at', to)
          .order('start_at', { ascending: false })
          .limit(200);
        if (extension) q = q.eq('extension', extension);
        const { data } = await q;
        const all = (data || []) as any[];
        const filtered = all.filter((r) => {
          if (metric === 'calls') return true;
          if (metric === 'missed') return r.missed_call || r.call_status === 'missed' || r.hangup_cause === 'NO_ANSWER';
          if (metric === 'answered') return !(r.missed_call || r.call_status === 'missed' || r.hangup_cause === 'NO_ANSWER');
          if (metric === 'recordings') return r.has_recording || r.recording_name || r.recording_path;
          if (metric === 'voicemail') return r.missed_call || r.hangup_cause === 'NO_ANSWER' || (r.voicemail_message && r.voicemail_message !== 'false');
          return true;
        });
        if (!cancelled) setRows(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [metric, orgId, extension, range, customFrom, customTo]);

  const seriesForMetric =
    metric === 'missed' ? series.missed :
    metric === 'answered' ? series.answered :
    metric === 'recordings' ? series.recordings :
    metric === 'calls' || metric === 'voicemail' ? series.calls : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(8,14,32,0.55)',
        display: 'flex', justifyContent: 'flex-end', zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)', height: '100%', background: '#f6f8fd',
          borderLeft: `1px solid ${c.border}`,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 50px -20px rgba(8,14,32,0.45)',
          animation: 'slideInRight .25s ease-out',
        }}>
        <div style={{
          padding: '16px 18px',
          background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`,
          color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.9 }}>Detail</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, lineHeight: 1.25 }}>{title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12,
          }}>Close</button>
        </div>

        {seriesForMetric.length > 0 && (
          <div style={{ padding: '14px 18px 0', background: '#fff', borderBottom: `1px solid ${c.border}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 6 }}>
              Daily trend
            </div>
            <div style={{
              padding: 12, borderRadius: 12,
              background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3)`,
            }}>
              <Sparkline data={seriesForMetric} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: c.mutedSilver, margin: '6px 2px 12px' }}>
              <span>{series.dates[0]}</span>
              <span>{series.dates[series.dates.length - 1]}</span>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: c.mutedSilver, fontSize: 13 }}>Loading…</div>
          ) : !rows || rows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: c.mutedSilver, fontSize: 13 }}>
              {metric === 'realtime' ? 'Realtime status is live above.' : 'No matching records in this range.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r: any) => (
                <DetailRow key={r.id} metric={metric} row={r} tone={tone} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ metric, row, tone }: { metric: MetricKey; row: any; tone: Tone }) {
  const time = row.start_at || row.started_at || row.last_message_at;
  const primary =
    metric === 'sms' ? (row.peer_number || 'Unknown') :
    (row.caller_id_number || row.destination_number || 'Unknown');
  const secondary =
    metric === 'sms' ? `${row.unread_count || 0} unread` :
    metric === 'live' ? `Live · ${row.destination_number || ''}` :
    `${row.destination_number || ''}${row.duration ? ` · ${Math.round(row.duration)}s` : ''}`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 12px', background: '#fff',
      border: `1px solid ${c.border}`, borderLeft: `3px solid ${tone.from}`,
      borderRadius: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: c.textIce, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary}</div>
        <div style={{ fontSize: 11.5, color: c.mutedSilver, marginTop: 2 }}>{secondary}</div>
      </div>
      <div style={{ fontSize: 11, color: c.mutedSilver, whiteSpace: 'nowrap' }}>
        {time ? new Date(time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
      </div>
    </div>
  );
}
