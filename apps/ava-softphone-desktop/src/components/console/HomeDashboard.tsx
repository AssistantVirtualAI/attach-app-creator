import React from 'react';
import { theme } from '../../lib/theme';
import { useTenant } from '../../hooks/useTenant';
import { useDashboardStats, AttentionItem } from '../../hooks/useDashboardStats';
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

function Stat({ label, value, accent, hint }: { label: string; value: string | number; accent: string; hint?: string }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${c.deepPanel}, ${c.bgCard})`,
      border: `1px solid ${c.border}`,
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent, opacity: 0.7 }} />
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: c.mutedSilver }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 700, color: c.textIce, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
      {hint && <span style={{ fontSize: 10.5, color: c.textSub }}>{hint}</span>}
    </div>
  );
}

function attentionColor(item: AttentionItem) {
  if (item.tone === 'danger') return c.danger;
  if (item.tone === 'warn') return c.signalGold;
  if (item.tone === 'success') return c.success;
  return c.avaCyan;
}

export default function HomeDashboard({
  displayName, extension, onQuickDial,
}: { displayName: string; extension: string; onQuickDial: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const { orgId, orgName, extension: tenantExt } = useTenant();
  const stats = useDashboardStats(orgId, tenantExt || extension);
  const { pbx, syncConnected, lastEvent, ageMs, healthy } = useSyncStatus();
  const freshnessAccent = stats.cdrFreshness === 'live' ? c.success : stats.cdrFreshness === 'stale' ? c.signalGold : c.mutedSilver;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1180, margin: '0 auto', animation: 'fadeIn .3s ease-out' }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: c.signalGold, textTransform: 'uppercase' }}>
          <span>Command Center</span>
          {orgName && (
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(35,214,255,0.08)', border: `1px solid ${c.borderAI}`, color: c.avaCyan, fontSize: 9.5, letterSpacing: 1 }}>
              {orgName}
            </span>
          )}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: c.mutedSilver, letterSpacing: 0.6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: healthy ? '#23d6ff' : pbx === 'error' ? '#ff5577' : c.mutedSilver, boxShadow: `0 0 6px currentColor` }} />
            {pbx === 'registered' ? 'PBX Online' : pbx === 'error' ? 'PBX Error' : 'Connecting'} · {syncConnected ? (lastEvent ? `Sync ${formatAge(ageMs)}` : 'Sync Live') : 'Sync Offline'}
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: c.textIce, margin: '6px 0 4px', letterSpacing: -0.3 }}>
          {greeting}, {displayName.split(' ')[0] || 'there'}
        </h1>
        <p style={{ fontSize: 13, color: c.mutedSilver, margin: 0 }}>
          Ext {extension} · Live CDR, recordings, voicemail, and AVA insights for your own extension.
        </p>
      </header>

      <section style={{
        background: `linear-gradient(135deg, rgba(255,230,0,0.12), rgba(35,214,255,0.07), rgba(122,76,255,0.08))`,
        border: `1px solid ${c.borderAI}`,
        borderRadius: 18, padding: '20px 22px', marginBottom: 22,
        display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: 20, alignItems: 'center',
        boxShadow: '0 18px 48px -28px rgba(35,214,255,0.55)',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.8, color: c.avaCyan, textTransform: 'uppercase', marginBottom: 6 }}>
            Live Phone-System Brief
          </div>
          <div style={{ fontSize: 14.5, color: c.textIce, lineHeight: 1.55 }}>
            {stats.loading ? 'Loading the live PBX picture…' : (
              <>Today: <strong style={{ color: c.signalGold }}>{stats.totalCallsToday} call{stats.totalCallsToday === 1 ? '' : 's'}</strong>, <strong style={{ color: c.success }}>{stats.answeredToday} answered</strong>, <strong style={{ color: c.danger }}>{stats.missedToday} missed</strong>, and <strong style={{ color: c.avaCyan }}>{stats.recordingsToday} recording{stats.recordingsToday === 1 ? '' : 's'}</strong>. The latest CDR is {fmtRelative(stats.lastCallAt)}.</>
            )}
          </div>
        </div>
        <div style={{ borderLeft: `1px solid ${c.borderAI}`, paddingLeft: 18, display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.mutedSilver }}><span>CDR freshness</span><strong style={{ color: freshnessAccent }}>{stats.cdrFreshness.toUpperCase()}</strong></div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}><div style={{ width: stats.cdrFreshness === 'live' ? '100%' : stats.cdrFreshness === 'stale' ? '58%' : '18%', height: '100%', background: freshnessAccent }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.mutedSilver }}><span>Recording coverage</span><strong style={{ color: c.signalGold }}>{stats.recordingCoveragePct}%</strong></div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}><div style={{ width: `${Math.max(4, stats.recordingCoveragePct)}%`, height: '100%', background: c.signalGold }} /></div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Stat label="Calls Today" value={stats.totalCallsToday} accent={c.avaCyan} hint="Scoped to extension" />
        <Stat label="Missed Calls" value={stats.missedToday} accent={c.danger} hint="Today" />
        <Stat label="Answered" value={stats.answeredToday} accent={c.success} hint="Today" />
        <Stat label="Recordings" value={stats.recordingsToday} accent={c.signalGold} hint={stats.lastRecordingAt ? `Latest ${fmtRelative(stats.lastRecordingAt)}` : 'None today'} />
        <Stat label="Unread SMS" value={stats.unreadSms} accent={c.signalGold} hint="All threads" />
        <Stat label="Voicemail" value={stats.unreadVoicemail} accent={c.avaViolet} hint="Needs review" />
        <Stat label="Live Calls" value={stats.liveCalls} accent={c.lemtelBlue} hint="In progress" />
        <Stat label="Realtime" value={syncConnected ? 'Live' : 'Off'} accent={syncConnected ? c.avaCyan : c.mutedSilver} hint={lastEvent ? formatAge(ageMs) : 'Idle'} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 10 }}>
          Quick Actions
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onQuickDial} style={quickBtn(c.signalGold)}>New Call</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'calls' }))} style={quickBtn(c.avaCyan)}>Open Call History</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'recordings' }))} style={quickBtn(c.avaViolet)}>Review Recordings</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'messages' }))} style={quickBtn(c.success)}>Messages</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: 'pbxlive' }))} style={quickBtn(c.mutedSilver)}>PBX Live</button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 10 }}>
          Needs Attention
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.attention.map((it, i) => {
            const accent = attentionColor(it);
            return (
              <div key={`${it.tag}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', background: c.bgCard,
                border: `1px solid ${c.border}`, borderRadius: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `linear-gradient(135deg, ${accent}, ${c.deepPanel})`,
                  display: 'grid', placeItems: 'center', color: '#fff',
                  fontWeight: 800, fontSize: 13,
                }}>{it.tag.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.textIce }}>{it.title}</div>
                  <div style={{ fontSize: 11.5, color: c.mutedSilver, marginTop: 2 }}>{it.detail}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                  padding: '4px 9px', borderRadius: 999,
                  background: `${accent}18`, color: accent,
                  border: `1px solid ${accent}55`,
                }}>{it.tag}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const quickBtn = (accent: string): React.CSSProperties => ({
  padding: '10px 16px',
  background: c.bgCard,
  border: `1px solid ${c.border}`,
  borderLeft: `2px solid ${accent}`,
  borderRadius: 10,
  color: c.textIce, fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 160ms ease',
});
