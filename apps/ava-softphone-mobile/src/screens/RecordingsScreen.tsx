import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, RecordingEntry } from '../lib/mobileApi';
import { Card, Chip, EmptyState, Skeleton, AIPanel } from '../components/ui/Primitives';
import type { Creds } from '../lib/creds';
import { restGet, loadPbxRecordingAudioMobile } from '../lib/mobileSupabase';
import { showMobileToast } from '../lib/mobileToast';
import { useCallAi } from '../hooks/useCallAi';
import { useT } from '../lib/i18n';

export default function RecordingsScreen({
  creds,
  isAdmin,
  myExtension,
  rangeDays,
  onRangeDaysChange,
}: {
  creds?: Creds | null;
  isAdmin: boolean;
  myExtension: string | null;
  rangeDays: 7 | 30;
  onRangeDaysChange: (days: 7 | 30) => void;
}) {
  const [items, setItems] = useState<RecordingEntry[] | null>(null);
  const [extFilter, setExtFilter] = useState<string>(isAdmin ? 'all' : (myExtension || 'all'));
  const [domainExtensions, setDomainExtensions] = useState<string[]>([]);
  const [fallbackDomainUuid, setFallbackDomainUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { lang } = useT();
  const fr = lang === 'fr';
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load recordings
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    const ext = isAdmin ? (extFilter === 'all' ? undefined : extFilter) : (myExtension || undefined);
    mobileApi.recordings(ext, { rangeDays })
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((e: any) => { if (!cancelled) { setError(e?.message || 'Failed to load recordings'); setItems([]); } });
    return () => { cancelled = true; };
  }, [extFilter, isAdmin, myExtension, creds?.accessToken, rangeDays]);

  // Fallback: derive domain_uuid from /mobile-me when creds lack it.
  useEffect(() => {
    if (!isAdmin) return;
    if (creds?.domainUuid || creds?.fusionpbxDomainUuid || fallbackDomainUuid) return;
    mobileApi.me()
      .then((m) => setFallbackDomainUuid(m?.domain?.fusionpbxDomainUuid || m?.organization?.fusionpbxDomainUuid || null))
      .catch(() => {});
  }, [isAdmin, creds?.domainUuid, creds?.fusionpbxDomainUuid, fallbackDomainUuid]);

  // Load domain extensions for the filter
  useEffect(() => {
    if (!isAdmin) return;
    const domainUuid = creds?.domainUuid || creds?.fusionpbxDomainUuid || fallbackDomainUuid;
    if (!creds?.accessToken || !domainUuid) return;
    restGet<{ extension: string }[]>(
      `/rest/v1/pbx_extensions_directory?select=extension&domain_uuid=eq.${encodeURIComponent(domainUuid)}&enabled=eq.true&order=extension.asc`,
      creds.accessToken,
    ).then((rows) => setDomainExtensions((rows || []).map((r) => String(r.extension)).filter(Boolean)))
      .catch(() => setDomainExtensions([]));
  }, [creds?.accessToken, creds?.domainUuid, creds?.fusionpbxDomainUuid, fallbackDomainUuid, isAdmin]);

  const extensionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of domainExtensions) set.add(e);
    for (const r of items || []) if (r.extension) set.add(r.extension);
    if (myExtension) set.add(myExtension);
    return Array.from(set).sort();
  }, [items, domainExtensions, myExtension]);

  const play = async (rec: RecordingEntry) => {
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    setLoadingId(rec.id);
    try {
      const url = await loadPbxRecordingAudioMobile(
        {
          id: rec.id,
          xml_cdr_uuid: rec.xml_cdr_uuid,
          recording_path: rec.record_path,
          recording_name: rec.record_name,
          domain_uuid: rec.domain_uuid,
          domain_name: rec.domain_name,
          organization_id: rec.organization_id,
          start_at: rec.startedAt,
        },
        creds?.accessToken || null,
        creds?.organizationId || null,
        creds?.domainUuid || creds?.fusionpbxDomainUuid || fallbackDomainUuid || null,
      );
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
      }
      setPlayingId(rec.id);
    } catch (e: any) {
      showMobileToast(e?.message || 'Unable to load recording', 'error');
    } finally {
      setLoadingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      {isAdmin ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 2px 10px' }}>
          <label style={{ fontSize: font.xs, color: colors.mutedSilver, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Extension</label>
          <select value={extFilter} onChange={(e) => setExtFilter(e.target.value)} style={{
            flex: 1, padding: '7px 10px', borderRadius: 10, border: `1px solid ${colors.border}`,
            background: 'rgba(255,255,255,0.06)', color: colors.textIce, fontSize: 12, fontWeight: 700,
          }}>
            <option value="all">{fr ? 'Toutes les extensions (domaine)' : 'All extensions (domain)'}</option>
            {myExtension && <option value={myExtension}>{fr ? `La mienne (${myExtension})` : `Mine (${myExtension})`}</option>}
            {extensionOptions.filter((e) => e !== myExtension).map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          {extensionOptions.length === 0 && (
            <span style={{ fontSize: 10, color: colors.mutedSilver }}>{fr ? 'Chargement…' : 'Loading…'}</span>
          )}
        </div>
      ) : (
        myExtension && (
          <div style={{ fontSize: font.xs, color: colors.mutedSilver, margin: '6px 2px 10px' }}>
            {fr ? `Enregistrements de votre extension ${myExtension}.` : `Showing recordings for your extension ${myExtension}.`}
          </div>
        )
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '0 2px 10px' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={fr ? 'Rechercher nom, numéro, extension…' : 'Search name, number, extension…'} style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, background: 'rgba(255,255,255,0.06)', color: colors.textIce, fontSize: 12, outline: 'none' }} />
        {([7, 30] as const).map((d) => <button key={d} onClick={() => onRangeDaysChange(d)} style={{ padding: '7px 9px', borderRadius: 10, border: `1px solid ${rangeDays === d ? colors.borderGold : colors.border}`, background: rangeDays === d ? colors.signalGold + '1a' : 'rgba(255,255,255,0.04)', color: rangeDays === d ? colors.signalGold : colors.mutedSilver, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{d}{fr ? 'j' : 'd'}</button>)}
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} style={{ width: '100%', marginBottom: 10 }} controls />

      {error && (
        <Card accent="gold" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: font.sm, color: colors.danger, fontWeight: 700 }}>{fr ? 'Échec du chargement des enregistrements' : 'Failed to load recordings'}</div>
          <div style={{ fontSize: 11, color: colors.mutedSilver, marginTop: 4 }}>{error}</div>
        </Card>
      )}

      {!items && <ListSkeleton rows={5} />}
      {items && items.filter((r) => !search.trim() || [r.customer, r.from, r.to, r.extension, r.summary].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
        <EmptyState icon="🎙" title={fr ? 'Aucun enregistrement' : 'No recordings yet'} hint={isAdmin ? (fr ? 'Aucun enregistrement du domaine ne correspond à ce filtre.' : 'No domain recordings match this filter.') : (fr ? 'Les enregistrements de votre extension apparaîtront ici.' : 'Recordings for your extension will appear here.')} />
      )}
      {items && items.filter((r) => !search.trim() || [r.customer, r.from, r.to, r.extension, r.summary].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase())).map((r) => (
        <div key={r.id} style={{ marginBottom: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            borderRadius: radius.lg,
            background: gradients.card,
            border: `1px solid ${playingId === r.id || expandedId === r.id ? colors.signalGold : colors.border}`,
            color: colors.textIce,
          }}>
            <button onClick={() => play(r)} style={{
              width: 32, height: 32, borderRadius: 16, display: 'grid', placeItems: 'center',
              background: 'rgba(255,255,255,0.06)', color: colors.signalGold, fontSize: 14,
              border: 'none', cursor: 'pointer',
            }}>
              {loadingId === r.id ? '…' : playingId === r.id ? '❚❚' : '▶'}
            </button>
            <button onClick={() => toggleExpand(r.id)} style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'inherit',
              textAlign: 'left', cursor: 'pointer', padding: 0,
            }}>
              <div style={{ fontSize: font.base, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.customer || r.from || r.to || (fr ? 'Appelant inconnu' : 'Unknown caller')}
              </div>
              <div style={{ fontSize: font.xs, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                {r.from} → {r.to}{r.extension ? ` · ext ${r.extension}` : ''}
              </div>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: font.xs, color: colors.mutedSilver }}>
                {new Date(r.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <Chip tone="gold" size="xs">{Math.max(1, Math.round(r.durationSec / 60))}m</Chip>
                {r.hasTranscript && <Chip tone="violet" size="xs">AI</Chip>}
                <button onClick={() => toggleExpand(r.id)} style={{
                  background: 'transparent', border: `1px solid ${colors.borderAI}`, color: colors.avaViolet,
                  borderRadius: 8, padding: '2px 6px', fontSize: 10, fontWeight: 800, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <Sparkles size={10} /> {expandedId === r.id ? (fr ? 'Masquer' : 'Hide') : 'AI'}
                </button>
              </div>
            </div>
          </div>
          {expandedId === r.id && (
            <RecordingAiPanel rec={r} />
          )}
        </div>
      ))}
    </div>
  );
}

function RecordingAiPanel({ rec }: { rec: RecordingEntry }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const meta = useMemo(() => ({
    recording_path: rec.record_path,
    recording_name: rec.record_name,
    domain_uuid: rec.domain_uuid,
    xml_cdr_uuid: rec.xml_cdr_uuid || rec.id,
    organization_id: rec.organization_id,
  }), [rec]);
  const { data, loading, running, stage, error, run } = useCallAi(rec.id, meta);

  const hasTranscript = (data?.transcript?.length || 0) > 0;
  const hasAi = !!data?.summary || (data?.coachingNotes?.length || 0) > 0;

  // Auto-trigger AI on first expand if nothing is cached and no prior error.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (loading || running) return;
    if (hasTranscript || hasAi || error) return;
    autoStartedRef.current = true;
    run();
  }, [loading, running, hasTranscript, hasAi, error, run]);

  const statusText = running
    ? stage === 'analyzing' ? (fr ? 'Analyse · coaching et sentiment…' : 'Analyzing call · coaching & sentiment…') : (fr ? 'Transcription audio par IA…' : 'Transcribing audio with AI…')
    : error ? (fr ? 'Échec de l\'IA' : 'AI run failed')
    : hasAi ? (fr ? 'IA prête · en cache' : 'AI ready · cached')
    : hasTranscript ? (fr ? 'Transcription prête' : 'Transcript ready')
    : (fr ? 'Préparation de l\'IA…' : 'Preparing AI…');

  return (
    <div style={{ margin: '8px 0 0', padding: 12, borderRadius: radius.lg, border: `1px solid ${colors.borderAI}`, background: 'rgba(122,76,255,0.05)' }}>
      {loading && !data ? (
        <Skeleton w="60%" h={14} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: colors.avaViolet, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 800 }}>{statusText}</div>
            <button onClick={run} disabled={running} style={{
              padding: '6px 10px', borderRadius: 999, border: 'none',
              background: running ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${colors.avaViolet}, ${colors.avaCyan})`,
              color: '#fff', fontSize: 11, fontWeight: 800, cursor: running ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {running ? <Loader2 size={11} className="spin" /> : <Sparkles size={11} />}
              {running ? (fr ? 'Traitement…' : 'Working…') : error ? (fr ? 'Réessayer' : 'Retry') : (hasTranscript || hasAi) ? (fr ? 'Relancer l\'IA' : 'Re-run AI') : (fr ? 'Transcrire et analyser' : 'Transcribe & analyze')}
            </button>
          </div>

          {/* Progress stepper */}
          {(running || (!hasAi && !error)) && (
            <ProgressStepper stage={running ? stage : (hasTranscript ? 'analyzing' : 'transcribing')} />
          )}

          {error && (
            <div style={{ marginBottom: 8, padding: 10, borderRadius: radius.md, border: `1px solid ${colors.danger}55`, background: `${colors.danger}10` }}>
              <div style={{ color: colors.danger, fontSize: 11, fontWeight: 800, marginBottom: 4 }}>⚠ {fr ? 'Échec de la transcription' : 'Transcription failed'}</div>
              <div style={{ color: colors.mutedSilver, fontSize: 11, marginBottom: 8, wordBreak: 'break-word' }}>{error}</div>
              <button onClick={run} disabled={running} style={{
                padding: '5px 10px', borderRadius: 8, border: `1px solid ${colors.danger}80`,
                background: 'transparent', color: colors.danger, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
              }}>↻ {fr ? 'Relancer l\'IA' : 'Retry AI run'}</button>
            </div>
          )}

          {data?.summary && (
            <AIPanel title={fr ? 'Résumé' : 'Summary'} accent={colors.avaViolet}>
              <p style={{ fontSize: font.sm, lineHeight: 1.5, color: colors.textIce, margin: 0 }}>{data.summary}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {data.coachingScore != null && <Chip tone="cyan" size="xs">Coaching {data.coachingScore}/5</Chip>}
                {data.qualityScore > 0 && <Chip tone="gold" size="xs">{fr ? 'Qualité' : 'Quality'} {data.qualityScore}/100</Chip>}
                {data.sentiment && <Chip tone={data.sentiment === 'positive' ? 'success' : data.sentiment === 'negative' ? 'danger' : 'neutral'} size="xs">{data.sentiment}</Chip>}
              </div>
            </AIPanel>
          )}

          {data?.coachingNotes && data.coachingNotes.length > 0 && (
            <AIPanel title={fr ? 'Notes de coaching' : 'Coaching notes'} accent={colors.avaCyan}>
              {data.coachingNotes.map((n, i) => (
                <div key={i} style={{ fontSize: font.sm, color: colors.textIce, lineHeight: 1.45, padding: '4px 0' }}>✦ {n}</div>
              ))}
            </AIPanel>
          )}

          {data?.actionItems && data.actionItems.length > 0 && (
            <AIPanel title={fr ? 'Actions à faire' : 'Action items'} accent={colors.success}>
              {data.actionItems.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: font.sm, color: colors.textIce }}>
                  <span style={{ color: colors.success }}>→</span><span>{a}</span>
                </div>
              ))}
            </AIPanel>
          )}

          {hasTranscript && (
            <AIPanel title={fr ? 'Transcription' : 'Transcript'} accent={colors.signalGold}>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {data!.transcript.map((line, i) => (
                  <div key={i} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: line.speaker === 'agent' ? 'flex-end' : 'flex-start',
                    marginBottom: 6,
                  }}>
                    <div style={{ fontSize: 9, color: colors.mutedSilver, marginBottom: 2, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>
                      {line.speaker === 'agent' ? 'Agent' : line.speaker === 'customer' ? 'Caller' : 'Speaker'}
                    </div>
                    <div style={{
                      maxWidth: '88%', padding: '6px 10px', borderRadius: 12,
                      fontSize: font.sm, lineHeight: 1.4,
                      background: line.speaker === 'agent' ? 'rgba(106,225,255,0.12)' : 'rgba(255,255,255,0.05)',
                      color: colors.textIce,
                    }}>{line.text}</div>
                  </div>
                ))}
              </div>
            </AIPanel>
          )}
        </>
      )}
    </div>
  );
}

function ProgressStepper({ stage }: { stage: 'idle' | 'transcribing' | 'analyzing' | 'done' | 'error' }) {
  const steps = [
    { id: 'transcribing', label: 'Transcribe' },
    { id: 'analyzing', label: 'Analyze' },
    { id: 'done', label: 'Ready' },
  ];
  const activeIdx = stage === 'analyzing' ? 1 : stage === 'done' ? 2 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 10px' }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 999,
            background: i <= activeIdx ? `${colors.avaViolet}25` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${i <= activeIdx ? colors.avaViolet : colors.border}`,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
            color: i <= activeIdx ? colors.avaViolet : colors.mutedSilver,
          }}>
            {i === activeIdx && stage !== 'done' ? <Loader2 size={10} className="spin" /> : i < activeIdx || stage === 'done' ? '✓' : i + 1}
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < activeIdx ? colors.avaViolet : colors.border, borderRadius: 2 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 60px',
          alignItems: 'center', gap: 12, padding: 14, marginBottom: 8,
          borderRadius: 12, background: gradients.card, border: `1px solid ${colors.border}`,
        }}>
          <Skeleton w={32} h={32} r={999} />
          <div>
            <Skeleton w="55%" h={12} />
            <div style={{ height: 6 }} />
            <Skeleton w="35%" h={10} />
          </div>
          <Skeleton w={40} h={10} />
        </div>
      ))}
    </div>
  );
}
