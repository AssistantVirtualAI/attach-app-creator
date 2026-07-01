import React, { useEffect, useMemo, useState } from 'react';
import { colors, font, radius } from '../lib/theme';
import { Card, Chip, SectionTitle, Skeleton } from './ui/Primitives';
import { mobileApi, CallRecord, RecordingEntry, VoicemailEntry, SmsThread } from '../lib/mobileApi';

type Period = 'today' | 'week' | 'month';

function periodStart(p: Period): number {
  const now = new Date();
  if (p === 'today') {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  if (p === 'week') return Date.now() - 7 * 24 * 36e5;
  return Date.now() - 30 * 24 * 36e5;
}

function fmtDuration(sec: number): string {
  if (!sec || sec < 60) return `${Math.max(0, Math.round(sec))}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function StatsDashboard() {
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);
  const [voicemails, setVoicemails] = useState<VoicemailEntry[]>([]);
  const [threads, setThreads] = useState<SmsThread[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const [c, r, v, t] = await Promise.all([
          mobileApi.calls({ rangeDays: 30, limit: 500 }).catch(() => [] as CallRecord[]),
          mobileApi.recordings(undefined, { rangeDays: 30 }).catch(() => [] as RecordingEntry[]),
          mobileApi.voicemails().catch(() => [] as VoicemailEntry[]),
          mobileApi.threads().catch(() => [] as SmsThread[]),
        ]);
        if (!alive) return;
        setCalls(Array.isArray(c) ? c : []);
        setRecordings(Array.isArray(r) ? r : []);
        setVoicemails(Array.isArray(v) ? v : []);
        setThreads(Array.isArray(t) ? t : []);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Erreur de chargement');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const iv = window.setInterval(load, 60_000);
    const onCallEnded = () => load();
    window.addEventListener('ava:callEnded', onCallEnded as EventListener);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      window.clearInterval(iv);
      window.removeEventListener('ava:callEnded', onCallEnded as EventListener);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const stats = useMemo(() => {
    const cutoff = periodStart(period);
    const inPeriod = (iso?: string) => {
      const t = iso ? new Date(iso).getTime() : 0;
      return t >= cutoff;
    };
    const cs = calls.filter((c) => inPeriod(c.startedAt));
    const received = cs.filter((c) => c.direction === 'in' && c.status === 'answered').length;
    const missed = cs.filter((c) => c.status === 'missed').length;
    const outbound = cs.filter((c) => c.direction === 'out').length;
    const durs = cs.filter((c) => c.durationSec > 0).map((c) => c.durationSec);
    const avgDur = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;

    const rs = recordings.filter((r) => inPeriod(r.startedAt));
    const recTotal = rs.length;
    const recTranscribed = rs.filter((r) => r.hasTranscript).length;
    const recPending = recTotal - recTranscribed;

    const vs = voicemails.filter((v) => inPeriod(v.receivedAt));
    const vmNew = vs.filter((v) => v.isNew).length;
    const vmTotal = vs.length;

    // SMS: threads only expose lastMessage/updatedAt + unread; use unread as
    // "unread messages" and updatedAt as recency filter for "active threads".
    const smsUnread = threads.reduce((s, t) => s + (t.unread || 0), 0);
    const smsActive = threads.filter((t) => {
      const ts = /^\d/.test(t.updatedAt) ? new Date(t.updatedAt).getTime() : 0;
      // Fallback: if updatedAt is a short "HH:mm" string, count it as today.
      if (!ts && period === 'today') return true;
      return ts >= cutoff;
    }).length;

    return { received, missed, outbound, avgDur, recTotal, recTranscribed, recPending, vmNew, vmTotal, smsUnread, smsActive };
  }, [period, calls, recordings, voicemails, threads]);

  return (
    <>
      <SectionTitle
        eyebrow="Tableau de bord"
        title="Vue d'ensemble"
        right={<PeriodToggle value={period} onChange={setPeriod} />}
      />
      {err && (
        <Card padded={true} style={{ marginBottom: 10, background: 'rgba(255,90,90,0.10)', border: '1px solid rgba(255,90,90,0.3)' }}>
          <span style={{ color: colors.danger, fontSize: font.sm }}>{err}</span>
        </Card>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <StatCard label="Reçus" value={stats.received} tone="success" icon="↘" loading={loading} />
        <StatCard label="Manqués" value={stats.missed} tone="danger" icon="✕" loading={loading} />
        <StatCard label="Sortants" value={stats.outbound} tone="cyan" icon="↗" loading={loading} />
        <StatCard label="Durée moy." value={fmtDuration(stats.avgDur)} tone="violet" icon="⏱" loading={loading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
        <MiniStat label="SMS non lus" value={stats.smsUnread} tone="cyan" loading={loading} />
        <MiniStat label="Msgrie nouv." value={stats.vmNew} tone="gold" loading={loading} />
        <MiniStat label="Msgrie tot." value={stats.vmTotal} tone="gold" loading={loading} />
      </div>

      <Card padded={true} style={{ marginTop: 10, background: 'linear-gradient(155deg, rgba(23,198,204,0.10), rgba(255,255,255,0.03))', border: '1px solid rgba(23,198,204,0.24)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: colors.avaCyan, textTransform: 'uppercase' }}>Enregistrements</div>
          <div style={{ fontSize: font.lg, fontWeight: 800, color: colors.textIce, fontFamily: 'JetBrains Mono, monospace' }}>
            {loading ? <Skeleton w={30} h={18} /> : stats.recTotal}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip tone="cyan">{stats.recTranscribed} transcrits</Chip>
          <Chip tone="gold">{stats.recPending} en attente</Chip>
        </div>
      </Card>
    </>
  );
}

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts: { k: Period; label: string }[] = [
    { k: 'today', label: "Aujourd'hui" },
    { k: 'week', label: 'Semaine' },
    { k: 'month', label: 'Mois' },
  ];
  return (
    <div style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
      {opts.map((o) => {
        const active = o.k === value;
        return (
          <button
            key={o.k}
            onClick={() => onChange(o.k)}
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: 0.4,
              background: active ? colors.avaCyan : 'transparent',
              color: active ? '#001018' : colors.textSub,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function toneColor(tone: 'success' | 'danger' | 'cyan' | 'gold' | 'violet') {
  switch (tone) {
    case 'success': return colors.success;
    case 'danger': return colors.danger;
    case 'cyan': return colors.avaCyan;
    case 'gold': return colors.signalGold;
    case 'violet': return colors.avaViolet;
  }
}

function StatCard({ label, value, tone, icon, loading }: { label: string; value: number | string; tone: 'success' | 'danger' | 'cyan' | 'gold' | 'violet'; icon: string; loading?: boolean }) {
  const c = toneColor(tone);
  return (
    <Card padded={true} style={{
      padding: 14,
      background: `linear-gradient(155deg, ${c}1f, ${colors.graphite} 75%)`,
      border: `1px solid ${c}33`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: c, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ width: 22, height: 22, borderRadius: 8, display: 'grid', placeItems: 'center', background: `${c}26`, color: c, fontSize: 12, fontWeight: 900 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: colors.textIce, marginTop: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: -0.5 }}>
        {loading ? <Skeleton w={50} h={22} /> : value}
      </div>
    </Card>
  );
}

function MiniStat({ label, value, tone, loading }: { label: string; value: number; tone: 'cyan' | 'gold' | 'violet'; loading?: boolean }) {
  const c = toneColor(tone);
  return (
    <div style={{
      padding: '10px 10px',
      borderRadius: radius.lg,
      background: `${c}14`,
      border: `1px solid ${c}30`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: c, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: colors.textIce, marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
        {loading ? <Skeleton w={30} h={16} /> : value}
      </div>
    </div>
  );
}
