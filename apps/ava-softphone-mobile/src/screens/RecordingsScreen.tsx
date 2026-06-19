import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play, Search, Sparkles } from 'lucide-react';
import { colors, font, radius } from '../lib/theme';
import { Card, Chip, EmptyState, SectionTitle, Skeleton } from '../components/ui/Primitives';
import { useMobileCredentials } from '../hooks/useMobileCredentials';
import { authedRealtime, loadPbxRecordingAudioMobile, restGet } from '../lib/mobileSupabase';
import { mobileApi } from '../lib/mobileApi';
import { showMobileToast } from '../lib/mobileToast';
import CallDetailScreen from './CallDetailScreen';

type Recording = {
  id: string; pbx_uuid: string | null; organization_id: string; domain_uuid: string | null; domain_name: string | null;
  caller_name: string | null; caller_number: string | null; destination_number: string | null; extension: string | null;
  start_at: string | null; duration_seconds: number | null; transcribed: boolean | null; ai_summary: string | null;
  recording_path: string | null; recording_name: string | null; recording_url?: string | null;
};

export default function RecordingsScreen() {
  const mobile = useMobileCredentials();
  const [data, setData] = useState<Recording[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'running' | 'failed' | undefined>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCache = useRef<Map<string, string>>(new Map());
  const objectUrls = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!mobile.accessToken || !mobile.domainUuid) return;
    const rows = await restGet<Recording[]>(`/rest/v1/pbx_call_records?select=id,pbx_uuid,organization_id,domain_uuid,domain_name,caller_name,caller_number,destination_number,extension,start_at,duration_seconds,transcribed,ai_summary,recording_path,recording_name,recording_url&domain_uuid=eq.${encodeURIComponent(mobile.domainUuid)}&or=(has_recording.eq.true,recording_path.not.is.null,recording_url.not.is.null)&order=start_at.desc&limit=100`, mobile.accessToken);
    setData(rows || []);
    setLastSyncedAt(Date.now());
  }, [mobile.accessToken, mobile.domainUuid]);

  useEffect(() => {
    if (mobile.loading) return;
    if (!mobile.accessToken || !mobile.domainUuid) { setData([]); return; }
    load().then(() => setError(null)).catch((e) => { setError(e?.message || 'Recordings failed'); setData([]); });
  }, [load, mobile.loading, mobile.accessToken, mobile.domainUuid]);

  useEffect(() => () => { audioRef.current?.pause(); objectUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  useEffect(() => {
    if (!mobile.accessToken || !mobile.domainUuid) return;
    const client = authedRealtime(mobile.accessToken);
    const channel = client.channel(`recordings-${mobile.domainUuid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_call_records', filter: `domain_uuid=eq.${mobile.domainUuid}` } as any, () => load().catch(() => {}))
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [load, mobile.accessToken, mobile.domainUuid]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data || [];
    return (data || []).filter((r) => [r.caller_name, r.caller_number, r.destination_number, r.extension, r.ai_summary].filter(Boolean).some((v) => String(v).toLowerCase().includes(t)));
  }, [data, q]);

  const play = async (r: Recording) => {
    if (playing === r.id) { audioRef.current?.pause(); setPlaying(null); return; }
    audioRef.current?.pause();
    audioRef.current = null;
    let url = urlCache.current.get(r.id) || '';
    if (!url) {
      setLoadingAudio(r.id);
      try {
        url = await loadPbxRecordingAudioMobile(r, mobile.accessToken, mobile.organizationId);
        urlCache.current.set(r.id, url);
        if (url.startsWith('blob:')) objectUrls.current.add(url);
      } catch (e: any) {
        showMobileToast(e?.message || 'Playback failed', 'error');
        setLoadingAudio(null);
        return;
      }
      setLoadingAudio(null);
    }
    const audio = new Audio(url);
    audio.onended = () => setPlaying(null);
    audio.onerror = () => { setPlaying(null); showMobileToast('Playback failed', 'error'); };
    audioRef.current = audio;
    setPlaying(r.id);
    audio.play().catch(() => { setPlaying(null); showMobileToast('Playback failed', 'error'); });
  };

  const transcribe = async (id: string) => {
    if (busy[id] === 'running') return;
    setBusy((b) => ({ ...b, [id]: 'running' }));
    try {
      const t = await mobileApi.transcribeCall(id);
      if (t?.stub || t?.error) throw new Error([t.error || t.reason || 'transcription unavailable', ...(t.fetchErrors || [])].filter(Boolean).join(' · '));
      await mobileApi.analyzeCall(id);
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
      showMobileToast('AI analysis: déjà traité et mis en cache.', 'success');
      load().catch(() => {});
    } catch (e: any) {
      setBusy((b) => ({ ...b, [id]: 'failed' }));
      showMobileToast(`Transcription/scoring failed — ${e?.message || 'unknown error'}`, 'error');
    }
  };

  if (open) return <CallDetailScreen id={open} onBack={() => setOpen(null)} />;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <SectionTitle eyebrow={mobile.sipDomain || 'AI transcribed'} title="Call recordings" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 10px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.7)', border: `1px solid ${colors.border}` }}><Search size={14} color={colors.mutedSilver} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recordings…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: colors.textIce }} /></div>
        <button onClick={() => load().catch((e) => setError(e?.message || 'Refresh failed'))} disabled={mobile.loading} style={{ padding: '8px 12px', borderRadius: 999, border: `1px solid ${colors.border}`, background: 'rgba(255,255,255,0.7)', color: colors.lemtelBlue, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{mobile.loading ? '…' : '↻'}</button>
      </div>
      <div style={{ fontSize: font.xs, color: colors.mutedSilver, margin: '0 2px 10px' }}>{filtered.length} of {data?.length ?? 0} · live sync {lastSyncedAt ? `· ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}</div>
      {error && <Card accent="gold"><div style={{ fontSize: font.sm, color: colors.danger }}>{error}</div></Card>}
      {!data && !error && [1, 2, 3, 4].map((i) => <Card key={i} style={{ marginBottom: 8 }}><Skeleton w="65%" h={14} /><div style={{ height: 6 }} /><Skeleton w="35%" h={10} /></Card>)}
      {data && data.length === 0 && <EmptyState icon="◉" title="No recordings yet" hint="Recorded calls from your SIP domain will appear here." />}
      {filtered.map((r) => {
        const state = busy[r.id];
        const label = r.caller_name || r.caller_number || r.destination_number || 'Unknown';
        return <Card key={r.id} style={{ marginBottom: 8 }} padded={true} onPress={() => setOpen(r.id)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={(e) => { e.stopPropagation(); play(r); }} disabled={loadingAudio === r.id} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #0023e6, #21d4fd)', color: '#fff', cursor: 'pointer', flexShrink: 0 }}>{loadingAudio === r.id ? <Loader2 size={15} className="spin" /> : playing === r.id ? <Pause size={15} /> : <Play size={15} />}</button>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: font.base, fontWeight: 800, color: colors.textIce, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div><div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>{r.start_at ? new Date(r.start_at).toLocaleString() : '—'} · {fmtDuration(Number(r.duration_seconds || 0))}</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}><Chip tone="gold" size="xs">REC</Chip>{r.transcribed ? <Chip tone="violet" size="xs">AI ✓</Chip> : <button onClick={(e) => { e.stopPropagation(); transcribe(r.id); }} disabled={state === 'running'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, border: 'none', background: state === 'failed' ? 'rgba(239,68,68,0.18)' : `linear-gradient(135deg, ${colors.avaViolet}, ${colors.avaCyan})`, color: state === 'failed' ? colors.danger : '#fff', fontSize: 10, fontWeight: 800, cursor: state === 'running' ? 'default' : 'pointer' }}>{state === 'running' ? <Loader2 size={10} className="spin" /> : <Sparkles size={10} />}{state === 'running' ? 'WORKING' : state === 'failed' ? 'RETRY' : 'AI'}</button>}</div>
          </div>
          {r.ai_summary && <p style={{ fontSize: font.sm, color: colors.textSub, margin: '8px 0 0', lineHeight: 1.4 }}>{r.ai_summary}</p>}
        </Card>;
      })}
      <div style={{ height: 80 }} />
    </div>
  );
}

function fmtDuration(s: number) { const m = Math.floor(s / 60); const sec = s % 60; return `${m}m ${sec.toString().padStart(2, '0')}s`; }
