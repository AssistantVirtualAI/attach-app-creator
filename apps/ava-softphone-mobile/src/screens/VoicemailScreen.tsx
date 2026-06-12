import React, { useEffect, useRef, useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, VoicemailEntry } from '../lib/mobileApi';
import { Card, Chip, EmptyState, GhostButton, AIPanel, Skeleton } from '../components/ui/Primitives';

const LEMTEL_ORG = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

export default function VoicemailScreen({ haptic }: { haptic?: (s?: ImpactStyle) => Promise<void> }) {
  const [items, setItems] = useState<VoicemailEntry[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ id: string; cur: number; dur: number } | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [analyses, setAnalyses] = useState<Record<string, { summary?: string; sentiment?: string; topics?: string[]; action_items?: string[] }>>({});
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCache = useRef<Map<string, string>>(new Map());

  useEffect(() => { mobileApi.voicemails().then(setItems); }, []);
  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);

  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const transcribe = async (v: VoicemailEntry, force = false) => {
    if (!force && (transcripts[v.id] || transcribing === v.id)) return;
    setTranscribing(v.id);
    setTranscribeError((p) => { const n = { ...p }; delete n[v.id]; return n; });
    try {
      let txt: string | null = null;
      let analysis: any = null;
      try {
        const d: any = await mobileApi.analyzeCall(v.id);
        txt = d?.transcript || d?.transcript_text || null;
        analysis = d?.analysis || d?.summary ? { summary: d?.summary, sentiment: d?.sentiment, topics: d?.topics, action_items: d?.action_items, ...(d?.analysis || {}) } : null;
      } catch {}
      if (!txt) {
        try {
          const res = await fetch(`https://gejxisrqtvxavbrfcoxz.supabase.co/functions/v1/ai-transcribe-call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ call_record_id: v.id, organization_id: LEMTEL_ORG }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
          txt = j?.transcript_text || j?.transcript || null;
          if (j?.analysis || j?.summary) analysis = { summary: j?.summary, sentiment: j?.sentiment, topics: j?.topics, action_items: j?.action_items, ...(j?.analysis || {}) };
        } catch (e: any) {
          setTranscribeError((p) => ({ ...p, [v.id]: e?.message || 'Transcription failed' }));
        }
      }
      if (txt) setTranscripts((p) => ({ ...p, [v.id]: txt! }));
      else if (!transcribeError[v.id]) setTranscribeError((p) => ({ ...p, [v.id]: 'No transcript returned' }));
      if (analysis) setAnalyses((p) => ({ ...p, [v.id]: analysis }));
    } finally {
      setTranscribing(null);
    }
  };

  const fetchUrl = async (id: string): Promise<string> => {
    const res = await mobileApi.voicemailAudio(id).catch(() => ({ url: '' } as any));
    return res?.url || '';
  };

  const togglePlay = async (v: VoicemailEntry) => {
    const id = v.id;
    setErrorId(null);
    if (playing === id) { audioRef.current?.pause(); setPlaying(null); return; }
    audioRef.current?.pause();

    let url = urlCache.current.get(id) || '';
    if (!url) {
      setLoadingId(id);
      url = await fetchUrl(id);
      setLoadingId(null);
      if (url) urlCache.current.set(id, url);
    }
    if (!url) { setErrorId(id); return; }

    const audio = new Audio(url);
    audio.ontimeupdate = () => setProgress({ id, cur: audio.currentTime, dur: audio.duration || v.durationSec });
    audio.onloadedmetadata = () => setProgress({ id, cur: 0, dur: audio.duration || v.durationSec });
    audio.onended = () => { setPlaying(null); transcribe(v); };
    audio.onerror = () => { setErrorId(id); setPlaying(null); };
    audioRef.current = audio;
    setPlaying(id);
    audio.play().catch(() => { setErrorId(id); setPlaying(null); });
  };

  const retry = async (v: VoicemailEntry) => {
    urlCache.current.delete(v.id);
    setErrorId(null);
    await new Promise((r) => setTimeout(r, 3000));
    togglePlay(v);
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>, v: VoicemailEntry) => {
    if (!audioRef.current || playing !== v.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const dur = audioRef.current.duration || v.durationSec;
    audioRef.current.currentTime = Math.max(0, Math.min(dur, pct * dur));
  };

  if (!items) {
    return (
      <div style={{ padding: 14 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ padding: 14, marginBottom: 8, borderRadius: radius.lg, background: gradients.card, border: `1px solid ${colors.border}` }}>
            <Skeleton w="55%" h={12} /><div style={{ height: 6 }} /><Skeleton w="80%" h={10} />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div style={{ padding: 14 }}><EmptyState icon="📭" title="No voicemails" hint="When callers leave a message, AVA will transcribe and summarize it here." /></div>;
  }

  return (
    <div>
      {items.map((v) => {
        const isOpen = openId === v.id;
        const isPlaying = playing === v.id;
        const p = progress?.id === v.id ? progress : null;
        const dur = p?.dur || v.durationSec;
        const cur = p?.cur || 0;
        const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
        const liveTranscript = transcripts[v.id];
        return (
          <Card key={v.id} style={{ marginBottom: 10 }} accent={v.priority === 'high' ? 'gold' : undefined}>
            <button onClick={() => { haptic?.(); setOpenId(isOpen ? null : v.id); }} style={{
              all: 'unset', display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer', padding: 2,
            }}>
              <span style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: v.isNew ? gradients.call : 'rgba(255,255,255,0.06)',
                border: `1px solid ${v.isNew ? colors.signalGold : colors.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: colors.textIce,
              }}>🎙</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>{v.customer || v.from}</span>
                  {v.isNew && <Chip tone="gold" size="xs">NEW</Chip>}
                  {v.priority === 'high' && <Chip tone="danger" size="xs">HIGH</Chip>}
                </div>
                <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                  {v.from} · {fmt(v.durationSec)} · {new Date(v.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{ color: colors.mutedSilver, fontSize: 14 }}>{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, borderRadius: radius.md,
                  background: colors.midnight2, border: `1px solid ${colors.border}`,
                }}>
                  <button onClick={() => { haptic?.(ImpactStyle.Medium); togglePlay(v); }} disabled={loadingId === v.id} style={{
                    width: 38, height: 38, borderRadius: '50%', border: 'none',
                    background: gradients.call, color: '#fff', fontSize: 16, cursor: 'pointer',
                    opacity: loadingId === v.id ? 0.6 : 1,
                  }}>{loadingId === v.id ? '…' : isPlaying ? '⏸' : '▶'}</button>
                  <div onClick={(e) => onSeek(e, v)} style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: gradients.call, transition: 'width 0.15s linear' }} />
                  </div>
                  <span style={{ fontSize: 11, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace', minWidth: 78, textAlign: 'right' }}>
                    {fmt(cur)} / {fmt(dur)}
                  </span>
                </div>
                {errorId === v.id && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'rgba(255,80,80,0.08)', border: `1px solid rgba(255,80,80,0.3)`, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, fontSize: 11, color: colors.danger }}>
                      Audio not available — recording may have been deleted from PBX.
                    </div>
                    <button onClick={() => retry(v)} style={{
                      padding: '6px 10px', borderRadius: 6, border: `1px solid ${colors.danger}`,
                      background: 'transparent', color: colors.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700,
                    }}>Retry</button>
                  </div>
                )}

                <AIPanel title="AVA summary" accent={colors.avaViolet} style={{ marginTop: 10 }}>
                  <div style={{ fontSize: font.sm, color: colors.textIce, lineHeight: 1.5 }}>{v.summary}</div>
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: 10, color: colors.avaCyan, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                      Transcript {transcribing === v.id && '· transcribing…'}
                    </div>
                    <div style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.5 }}>
                      {liveTranscript || v.transcript}
                    </div>
                  </div>
                </AIPanel>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <GhostButton tone="cyan" onClick={() => haptic?.(ImpactStyle.Medium)}>📞 Call back</GhostButton>
                  <GhostButton tone="violet" onClick={() => haptic?.()}>💬 SMS</GhostButton>
                  <GhostButton tone="gold" onClick={() => haptic?.()}>✓ Done</GhostButton>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
