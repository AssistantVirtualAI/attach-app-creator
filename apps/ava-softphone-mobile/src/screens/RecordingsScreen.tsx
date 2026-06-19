import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, RecordingEntry } from '../lib/mobileApi';
import { Card, Chip, EmptyState, Skeleton } from '../components/ui/Primitives';
import type { Creds } from '../lib/creds';
import { restGet, loadPbxRecordingAudioMobile } from '../lib/mobileSupabase';
import { showMobileToast } from '../lib/mobileToast';

export default function RecordingsScreen({
  creds,
  isAdmin,
  myExtension,
}: {
  creds?: Creds | null;
  isAdmin: boolean;
  myExtension: string | null;
}) {
  const [items, setItems] = useState<RecordingEntry[] | null>(null);
  const [extFilter, setExtFilter] = useState<string>(isAdmin ? 'all' : (myExtension || 'all'));
  const [domainExtensions, setDomainExtensions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load recordings
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    const ext = isAdmin ? (extFilter === 'all' ? undefined : extFilter) : (myExtension || undefined);
    mobileApi.recordings(ext)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((e: any) => { if (!cancelled) { setError(e?.message || 'Failed to load recordings'); setItems([]); } });
    return () => { cancelled = true; };
  }, [extFilter, isAdmin, myExtension, creds?.accessToken]);

  // Load domain extensions for the filter
  useEffect(() => {
    if (!isAdmin) return;
    const domainUuid = creds?.domainUuid || creds?.fusionpbxDomainUuid;
    if (!creds?.accessToken || !domainUuid) return;
    restGet<{ extension: string }[]>(
      `/rest/v1/pbx_extensions_directory?select=extension&domain_uuid=eq.${encodeURIComponent(domainUuid)}&enabled=eq.true&order=extension.asc`,
      creds.accessToken,
    ).then((rows) => setDomainExtensions((rows || []).map((r) => String(r.extension)).filter(Boolean)))
      .catch(() => setDomainExtensions([]));
  }, [creds?.accessToken, creds?.domainUuid, creds?.fusionpbxDomainUuid, isAdmin]);

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
        creds?.domainUuid || creds?.fusionpbxDomainUuid || null,
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

  return (
    <div>
      {isAdmin ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 2px 10px' }}>
          <label style={{ fontSize: font.xs, color: colors.mutedSilver, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Extension</label>
          <select value={extFilter} onChange={(e) => setExtFilter(e.target.value)} style={{
            flex: 1, padding: '7px 10px', borderRadius: 10, border: `1px solid ${colors.border}`,
            background: 'rgba(255,255,255,0.06)', color: colors.textIce, fontSize: 12, fontWeight: 700,
          }}>
            <option value="all">All extensions (domain)</option>
            {myExtension && <option value={myExtension}>Mine ({myExtension})</option>}
            {extensionOptions.filter((e) => e !== myExtension).map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      ) : (
        myExtension && (
          <div style={{ fontSize: font.xs, color: colors.mutedSilver, margin: '6px 2px 10px' }}>
            Showing recordings for your extension {myExtension}.
          </div>
        )
      )}

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} style={{ width: '100%', marginBottom: 10 }} controls />

      {error && (
        <Card accent="gold" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: font.sm, color: colors.danger, fontWeight: 700 }}>Failed to load recordings</div>
          <div style={{ fontSize: 11, color: colors.mutedSilver, marginTop: 4 }}>{error}</div>
        </Card>
      )}

      {!items && <ListSkeleton rows={5} />}
      {items && items.length === 0 && (
        <EmptyState icon="🎙" title="No recordings yet" hint={isAdmin ? 'No domain recordings match this filter.' : 'Recordings for your extension will appear here.'} />
      )}
      {items && items.map((r) => (
        <button key={r.id} onClick={() => play(r)} style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '12px 14px', marginBottom: 8,
          borderRadius: radius.lg,
          background: gradients.card,
          border: `1px solid ${playingId === r.id ? colors.signalGold : colors.border}`,
          color: colors.textIce, cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.06)', color: colors.signalGold, fontSize: 14 }}>
            {loadingId === r.id ? '…' : playingId === r.id ? '❚❚' : '▶'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: font.base, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.customer || r.from || r.to || 'Unknown caller'}
            </div>
            <div style={{ fontSize: font.xs, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {r.from} → {r.to}{r.extension ? ` · ext ${r.extension}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: font.xs, color: colors.mutedSilver }}>
              {new Date(r.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <Chip tone="gold" size="xs">{Math.max(1, Math.round(r.durationSec / 60))}m</Chip>
              {r.hasTranscript && <Chip tone="violet" size="xs">AI</Chip>}
            </div>
          </div>
        </button>
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
