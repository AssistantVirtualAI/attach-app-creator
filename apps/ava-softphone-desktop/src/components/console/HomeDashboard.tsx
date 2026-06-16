import React, { useMemo, useState } from 'react';
import { theme } from '../../lib/theme';
import { useTenant } from '../../hooks/useTenant';
import { useDashboardStats, AttentionItem, RangeKey } from '../../hooks/useDashboardStats';
import { useSyncStatus, formatAge } from '../../hooks/useSyncStatus';

const { colors: c } = theme;

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
  from: string;     // gradient start
  to: string;       // gradient end
  ring: string;     // border / glow color
  ink: string;      // text/value color
  chip: string;     // small chip bg
};

const tones: Record<string, Tone> = {
  cyan:   { from: '#0891b2', to: '#21d4fd', ring: 'rgba(8,145,178,0.55)',  ink: '#062c3a', chip: 'rgba(8,145,178,0.18)' },
  red:    { from: '#dc2626', to: '#fb7185', ring: 'rgba(220,38,38,0.55)',  ink: '#3b0a0a', chip: 'rgba(220,38,38,0.18)' },
  green:  { from: '#0f9d58', to: '#34d399', ring: 'rgba(15,157,88,0.55)',  ink: '#06281a', chip: 'rgba(15,157,88,0.18)' },
  gold:   { from: '#d4a73a', to: '#fbbf24', ring: 'rgba(212,167,58,0.60)', ink: '#3b2a05', chip: 'rgba(212,167,58,0.22)' },
  violet: { from: '#7a4cff', to: '#c084fc', ring: 'rgba(122,76,255,0.55)', ink: '#21104f', chip: 'rgba(122,76,255,0.18)' },
  blue:   { from: '#0023e6', to: '#4d6dff', ring: 'rgba(0,35,230,0.55)',   ink: '#06133f', chip: 'rgba(0,35,230,0.18)' },
  pink:   { from: '#db2777', to: '#f472b6', ring: 'rgba(219,39,119,0.55)', ink: '#3d0a26', chip: 'rgba(219,39,119,0.18)' },
  slate:  { from: '#475569', to: '#94a3b8', ring: 'rgba(71,85,105,0.55)',  ink: '#0b1530', chip: 'rgba(71,85,105,0.18)' },
};

function Stat({ label, value, tone, hint }: { label: string; value: string | number; tone: Tone; hint?: string }) {
  return (
    <div
      className="ava-lift"
      style={{
        background: `linear-gradient(135deg, ${tone.from} 0%, ${tone.to} 100%)`,
        border: `1px solid ${tone.ring}`,
        borderRadius: 18, padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: 6,
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 10px 28px -14px ${tone.ring}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        color: '#fff',
      }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,0.28), transparent 55%)',
        pointerEvents: 'none',
      }} />
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)', position: 'relative' }}>{label}</span>
      <span className="tabular-nums" style={{ fontSize: 34, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.6, lineHeight: 1.05, position: 'relative', textShadow: '0 2px 12px rgba(0,0,0,0.18)' }}>{value}</span>
      {hint && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.88)', position: 'relative' }}>{hint}</span>}
    </div>
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

export default function HomeDashboard({
  displayName, extension, onQuickDial,
}: { displayName: string; extension: string; onQuickDial: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const { orgId, orgName, extension: tenantExt } = useTenant();

  const [range, setRange] = useState<RangeKey>('today');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); }, []);
  const [customFrom, setCustomFrom] = useState<string>(weekAgo);
  const [customTo, setCustomTo] = useState<string>(today);

  const stats = useDashboardStats(orgId, tenantExt || extension, range, customFrom, customTo);
  const { pbx, syncConnected, lastEvent, ageMs, healthy } = useSyncStatus();
  const freshnessAccent = stats.cdrFreshness === 'live' ? c.success : stats.cdrFreshness === 'stale' ? c.signalGold : c.mutedSilver;
  const rangeLabel = range === 'today' ? 'Today' : range === 'week' ? 'Last 7 days' : range === 'month' ? 'Last 30 days' : `${customFrom} → ${customTo}`;

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
                : 'rgba(255,255,255,0.85)',
              color: active ? '#fff' : c.textIce,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
              cursor: 'pointer',
              boxShadow: active ? `0 6px 18px -8px ${tones.blue.ring}` : 'none',
              transition: 'all 180ms ease',
            }}>{r.label}</button>
          );
        })}
        {range === 'custom' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)}
              style={dateInput()} />
            <span style={{ color: c.mutedSilver, fontSize: 12 }}>→</span>
            <input type="date" value={customTo} min={customFrom} max={today} onChange={(e) => setCustomTo(e.target.value)}
              style={dateInput()} />
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 26 }}>
        <Stat label={`Calls · ${rangeLabel}`} value={stats.totalCallsToday} tone={tones.cyan} hint="Scoped to extension" />
        <Stat label="Missed" value={stats.missedToday} tone={tones.red} hint={rangeLabel} />
        <Stat label="Answered" value={stats.answeredToday} tone={tones.green} hint={rangeLabel} />
        <Stat label="Recordings" value={stats.recordingsToday} tone={tones.gold} hint={stats.lastRecordingAt ? `Latest ${fmtRelative(stats.lastRecordingAt)}` : 'None in range'} />
        <Stat label="Unread SMS" value={stats.unreadSms} tone={tones.pink} hint="All threads" />
        <Stat label="Voicemail" value={stats.unreadVoicemail} tone={tones.violet} hint="Needs review" />
        <Stat label="Live Calls" value={stats.liveCalls} tone={tones.blue} hint="In progress" />
        <Stat label="Realtime" value={syncConnected ? 'Live' : 'Off'} tone={syncConnected ? tones.cyan : tones.slate} hint={lastEvent ? formatAge(ageMs) : 'Idle'} />
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
                boxShadow: `0 10px 24px -14px ${tone.ring}`,
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
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>{it.detail}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: 0.8,
                  padding: '5px 10px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.22)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.4)',
                }}>{it.tag}</span>
              </div>
            );
          })}
        </div>
      </div>
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
  boxShadow: `0 8px 20px -12px ${tone.ring}, inset 0 1px 0 rgba(255,255,255,0.3)`,
});

const dateInput = (): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid ${c.border}`,
  background: 'rgba(255,255,255,0.95)',
  color: c.textIce,
  fontSize: 12,
  fontWeight: 600,
});
