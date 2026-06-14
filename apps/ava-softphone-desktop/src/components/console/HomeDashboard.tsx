import React from 'react';
import { theme } from '../../lib/theme';
import { useTenant } from '../../hooks/useTenant';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { useSyncStatus, formatAge } from '../../hooks/useSyncStatus';

const { colors: c } = theme;

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

export default function HomeDashboard({
  displayName, extension, onQuickDial,
}: { displayName: string; extension: string; onQuickDial: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const { orgId, orgName, extension: tenantExt } = useTenant();
  const stats = useDashboardStats(orgId, tenantExt || extension);
  const { pbx, syncConnected, lastEvent, ageMs, healthy } = useSyncStatus();

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto', animation: 'fadeIn .3s ease-out' }}>
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
          Ext {extension} · Your day at a glance, powered by AVA AI
        </p>
      </header>

      {/* AVA daily brief */}
      <div style={{
        background: `linear-gradient(135deg, rgba(122,76,255,0.10), rgba(35,214,255,0.06))`,
        border: `1px solid ${c.borderAI}`,
        borderRadius: 16, padding: '18px 20px', marginBottom: 22,
        display: 'flex', gap: 16, alignItems: 'flex-start',
        boxShadow: '0 8px 32px -16px rgba(122,76,255,0.4)',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
          display: 'grid', placeItems: 'center', color: '#fff',
          fontWeight: 800, fontSize: 14, letterSpacing: 0.5,
        }}>AI</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: c.avaCyan, textTransform: 'uppercase', marginBottom: 4 }}>
            AVA Daily Brief
          </div>
          <div style={{ fontSize: 13.5, color: c.textIce, lineHeight: 1.55 }}>
            {stats.loading ? 'Loading your day…' : (
              <>You have <strong style={{ color: c.signalGold }}>{stats.missedToday} missed call{stats.missedToday === 1 ? '' : 's'}</strong> and <strong style={{ color: c.signalGold }}>{stats.unreadVoicemail} unread voicemail{stats.unreadVoicemail === 1 ? '' : 's'}</strong> today. {stats.unreadSms > 0 ? `${stats.unreadSms} unread message${stats.unreadSms === 1 ? '' : 's'} waiting.` : 'Inbox is clear on SMS.'}</>
            )}
          </div>
        </div>
      </div>

      {/* Stat grid — live from realtime sync */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Stat label="Missed Calls" value={stats.missedToday} accent={c.danger} hint="Today" />
        <Stat label="Answered" value={stats.answeredToday} accent={c.success} hint="Today" />
        <Stat label="Unread SMS" value={stats.unreadSms} accent={c.signalGold} hint="All threads" />
        <Stat label="Voicemail" value={stats.unreadVoicemail} accent={c.avaCyan} hint="New" />
        <Stat label="Live Calls" value={stats.liveCalls} accent={c.avaViolet} hint="In progress" />
        <Stat label="Extensions" value={stats.extensionsTotal} accent={c.lemtelBlue} hint="Provisioned" />
        <Stat label="Sync" value={syncConnected ? 'Live' : 'Off'} accent={syncConnected ? c.avaCyan : c.mutedSilver} hint={lastEvent ? formatAge(ageMs) : 'Idle'} />
        <Stat label="PBX Health" value={pbx === 'registered' ? 'OK' : pbx === 'error' ? 'Down' : '…'} accent={pbx === 'registered' ? c.success : pbx === 'error' ? c.danger : c.mutedSilver} hint={pbx === 'registered' ? 'SIP registered' : pbx} />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 10 }}>
          Quick Actions
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onQuickDial} style={quickBtn(c.signalGold)}>📞 New Call</button>
          <button style={quickBtn(c.avaCyan)}>💬 New Message</button>
          <button style={quickBtn(c.avaViolet)}>✨ Ask AVA</button>
          <button style={quickBtn(c.mutedSilver)}>🎙 Create Greeting</button>
          <button style={quickBtn(c.mutedSilver)}>↪ Set Forwarding</button>
        </div>
      </div>

      {/* Needs attention */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 10 }}>
          Needs Attention
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { who: 'Marie Tremblay', why: 'Promised callback by 3 PM', tag: 'Callback' },
            { who: 'Acme Corp (514-555-0182)', why: 'Renewal mentioned in last call', tag: 'Sales' },
            { who: 'Voicemail — Unknown', why: 'Urgent tone detected', tag: 'AI Flagged' },
          ].map((it, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 14px', background: c.bgCard,
              border: `1px solid ${c.border}`, borderRadius: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`,
                display: 'grid', placeItems: 'center', color: '#fff',
                fontWeight: 700, fontSize: 13,
              }}>{it.who.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.textIce }}>{it.who}</div>
                <div style={{ fontSize: 11.5, color: c.mutedSilver, marginTop: 2 }}>{it.why}</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                padding: '4px 9px', borderRadius: 999,
                background: 'rgba(255,230,0,0.10)', color: c.signalGold,
                border: `1px solid ${c.borderGold}`,
              }}>{it.tag}</span>
            </div>
          ))}
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
