import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, CallDetail } from '../lib/mobileApi';
import { Card, Chip, AIPanel, Skeleton, GhostButton } from '../components/ui/Primitives';
import { getCredentials } from '../lib/creds';

export default function CallDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<CallDetail | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(() => { mobileApi.callDetail(id).then(setData).catch(() => {}); }, [id]);
  useEffect(() => { load(); }, [load]);

  // Cleanup audio on unmount or call change
  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, [id]);

  const fetchUrl = useCallback(async (): Promise<string | null> => {
    setAudioError(null);
    setLoadingAudio(true);
    try {
      const creds = await getCredentials();
      const res = await mobileApi.voicemailAudio({
        xml_cdr_uuid: id,
        organization_id: creds?.organizationId,
      });
      if (!res?.url) throw new Error('No recording URL returned');
      return res.url;
    } catch (e: any) {
      setAudioError(e?.message || 'Unable to load recording');
      return null;
    } finally {
      setLoadingAudio(false);
    }
  }, [id]);

  const togglePlay = useCallback(async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    let url = audioUrl;
    if (!url) {
      url = await fetchUrl();
      if (!url) return;
      setAudioUrl(url);
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audio.ontimeupdate = () => setCur(audio.currentTime);
    audio.onloadedmetadata = () => setDur(audio.duration || data?.durationSec || 0);
    audio.onended = () => {
      setPlaying(false);
      setCur(0);
      if (data && !data.transcript?.length) transcribe();
    };
    audio.onerror = () => {
      setAudioError('Playback failed');
      setPlaying(false);
    };
    audioRef.current = audio;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setAudioError('Playback failed — tap retry');
      setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, audioUrl, fetchUrl, data]);

  const retry = useCallback(async () => {
    setAudioUrl(null);
    setAudioError(null);
    await new Promise((r) => setTimeout(r, 1500));
    togglePlay();
  }, [togglePlay]);

  const transcribe = useCallback(async () => {
    if (transcribing) return;
    setTranscribing(true);
    setTranscribeError(null);
    try {
      await mobileApi.analyzeCall(id);
      // Poll once for the freshly written transcript/insights
      await new Promise((r) => setTimeout(r, 1500));
      load();
    } catch (e: any) {
      setTranscribeError(e?.message || 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  }, [id, transcribing, load]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * dur;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const hasTranscript = (data?.transcript?.length || 0) > 0;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <button onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', marginBottom: 12,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${colors.border}`,
        borderRadius: 999, color: colors.textIce, fontSize: font.sm, cursor: 'pointer',
      }}>← Back</button>

      {!data && <Skeleton w="60%" h={22} />}
      {data && (
        <>
          <div style={{ marginBottom: 4, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, color: colors.signalGold, textTransform: 'uppercase' }}>
            {data.direction === 'in' ? 'Inbound call' : 'Outbound call'}
          </div>
          <h1 style={{ fontSize: font.xxl, color: colors.textIce, margin: '2px 0 6px', fontWeight: 800, letterSpacing: -0.3 }}>
            {data.customer || data.from}
          </h1>
          <div style={{ fontSize: font.sm, color: colors.mutedSilver, marginBottom: 14 }}>
            {new Date(data.startedAt).toLocaleString()} · {fmt(data.durationSec)}
          </div>

          {/* Recording player */}
          {data.hasRecording && (
            <Card style={{ marginBottom: 14 }} accent="gold">
              {/* Progress bar / scrubber */}
              <div
                onClick={seek}
                style={{
                  height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                  position: 'relative', cursor: dur ? 'pointer' : 'default',
                  border: `1px solid ${colors.border}`, overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', inset: 0,
                  width: `${dur ? (cur / dur) * 100 : 0}%`,
                  background: gradients.call, transition: 'width .15s linear',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10 }}>
                <span style={{ fontSize: 11, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{fmt(cur)}</span>
                <button onClick={togglePlay} disabled={loadingAudio} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 999, border: 'none',
                  background: gradients.call, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  opacity: loadingAudio ? 0.6 : 1,
                }}>
                  {loadingAudio ? <Loader2 size={14} className="spin" /> : playing ? <Pause size={14} /> : <Play size={14} />}
                  {loadingAudio ? 'Loading' : playing ? 'Pause' : 'Play'}
                </button>
                <span style={{ fontSize: 11, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{fmt(dur || data.durationSec)}</span>
              </div>
              {audioError && (
                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: `1px solid ${colors.danger}55`, fontSize: 12, color: colors.danger, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span>⚠ {audioError}</span>
                  <button onClick={retry} style={{ background: 'transparent', border: `1px solid ${colors.danger}`, color: colors.danger, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={11} /> Retry
                  </button>
                </div>
              )}
            </Card>
          )}

          {/* Transcribe CTA when missing */}
          {data.hasRecording && !hasTranscript && (
            <Card style={{ marginBottom: 14 }} accent="violet">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={18} color={colors.avaViolet} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>No transcript yet</div>
                  <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 2 }}>
                    Run AVA to transcribe, summarize and tag this call.
                  </div>
                </div>
                <button onClick={transcribe} disabled={transcribing} style={{
                  padding: '8px 14px', borderRadius: 999, border: 'none',
                  background: `linear-gradient(135deg, ${colors.avaViolet}, ${colors.avaCyan})`,
                  color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  opacity: transcribing ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {transcribing ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                  {transcribing ? 'Working…' : 'Transcribe'}
                </button>
              </div>
              {transcribeError && (
                <div style={{ marginTop: 8, fontSize: 11, color: colors.danger }}>⚠ {transcribeError}</div>
              )}
            </Card>
          )}

          {/* AI Summary */}
          {data.summary && (
            <AIPanel title="AVA Summary" accent={colors.avaViolet}>
              <p style={{ fontSize: font.base, lineHeight: 1.55, color: colors.textIce, margin: 0 }}>{data.summary}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {data.qualityScore > 0 && <Chip tone="gold">Quality {data.qualityScore}/100</Chip>}
                {data.sentiment && <Chip tone={data.sentiment === 'positive' ? 'success' : data.sentiment === 'negative' ? 'danger' : 'neutral'}>{data.sentiment}</Chip>}
                {data.intent && <Chip tone="cyan">{data.intent}</Chip>}
              </div>
            </AIPanel>
          )}

          {/* Action items */}
          {data.actionItems?.length > 0 && (
            <AIPanel title="Action items" accent={colors.success}>
              {data.actionItems.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i === data.actionItems.length - 1 ? 'none' : `1px solid ${colors.border}` }}>
                  <span style={{ color: colors.success }}>→</span>
                  <span style={{ fontSize: font.base, color: colors.textIce, lineHeight: 1.45 }}>{a}</span>
                </div>
              ))}
            </AIPanel>
          )}

          {/* Topics */}
          {data.topics?.length > 0 && (
            <AIPanel title="Topics" accent={colors.avaCyan}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {data.topics.map((t) => <Chip key={t} tone="cyan">{t}</Chip>)}
              </div>
            </AIPanel>
          )}

          {/* Transcript */}
          {hasTranscript && (
            <AIPanel title="Transcript" accent={colors.signalGold}>
              {data.transcript.map((line, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: line.speaker === 'agent' ? 'flex-end' : 'flex-start',
                  marginBottom: 8,
                }}>
                  <div style={{
                    maxWidth: '85%', padding: '8px 12px', borderRadius: 14,
                    background: line.speaker === 'agent' ? gradients.call : colors.graphite2,
                    color: colors.textIce, fontSize: font.base, lineHeight: 1.5,
                    borderBottomRightRadius: line.speaker === 'agent' ? 4 : 14,
                    borderBottomLeftRadius:  line.speaker === 'agent' ? 14 : 4,
                  }}>{line.text}</div>
                  <div style={{ fontSize: 9.5, color: colors.mutedSilver, marginTop: 3, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>
                    {line.speaker} · {fmt(line.t)}
                  </div>
                </div>
              ))}
            </AIPanel>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <GhostButton tone="gold" style={{ flex: 1 }}>Tag</GhostButton>
            <GhostButton tone="cyan" style={{ flex: 1 }}>Share</GhostButton>
            <GhostButton tone="violet" style={{ flex: 1 }} onClick={transcribe}>Re-analyze</GhostButton>
          </div>

          <div style={{ height: 60 }} />
        </>
      )}
      <style>{`@keyframes spinrot { from { transform: rotate(0deg);} to { transform: rotate(360deg);} } .spin { animation: spinrot 1s linear infinite; }`}</style>
    </div>
  );
}
