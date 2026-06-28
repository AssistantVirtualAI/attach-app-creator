// Live transcript panel shown during an active call.
// Subscribes to startLiveTranscription() and renders a chronological,
// speaker-tagged feed where partial segments update in place and become
// final when the turn ends.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors, radius } from '../lib/theme';
import { startLiveTranscription, type LiveSegment, type LiveStatusEvent } from '../lib/liveTranscription';
import { useT } from '../lib/i18n';

interface Props {
  callRecordId: string;
  organizationId: string;
  active: boolean;
}

interface FeedEntry {
  key: string;
  speaker: 'agent' | 'client';
  text: string;
  status: 'partial' | 'final';
  at: number;
}

export default function LiveTranscriptPanel({ callRecordId, organizationId, active }: Props) {
  const { tx } = useT();
  const [status, setStatus] = useState<LiveStatusEvent['status']>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active || !callRecordId || !organizationId) return;
    const handle = startLiveTranscription({ callRecordId, organizationId });
    const offStatus = handle.onStatus((s) => {
      setStatus(s.status);
      setStatusMsg(s.message || '');
    });
    const offSeg = handle.onSegment((seg: LiveSegment) => {
      if (seg.speaker !== 'agent' && seg.speaker !== 'client') return;
      setEntries((prev) => {
        const key = `${seg.source}-${seg.segmentIdx}`;
        const idx = prev.findIndex((e) => e.key === key);
        const entry: FeedEntry = {
          key, speaker: seg.speaker as 'agent' | 'client',
          text: seg.text, status: seg.status === 'final' ? 'final' : 'partial', at: seg.at,
        };
        if (idx >= 0) { const copy = prev.slice(); copy[idx] = entry; return copy; }
        return [...prev, entry];
      });
    });
    return () => { offStatus(); offSeg(); handle.stop().catch(() => {}); };
  }, [active, callRecordId, organizationId]);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries]);

  const sorted = useMemo(() => [...entries].sort((a, b) => a.at - b.at), [entries]);

  const statusLabel = (() => {
    switch (status) {
      case 'connecting': return tx('Connexion…', 'Connecting…');
      case 'live':       return tx('En direct', 'Live');
      case 'error':      return tx(`Erreur${statusMsg ? `: ${statusMsg}` : ''}`, `Error${statusMsg ? `: ${statusMsg}` : ''}`);
      case 'stopped':    return tx('Terminé', 'Stopped');
      default:           return tx('Inactif', 'Idle');
    }
  })();
  const statusColor =
    status === 'live' ? colors.success :
    status === 'error' ? colors.danger :
    status === 'connecting' ? colors.warning : colors.graphite2;

  return (
    <div style={{
      margin: '8px 16px', padding: 12, borderRadius: radius.lg,
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${statusColor}55`,
      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120, maxHeight: 260,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: 800, color: statusColor, textTransform: 'uppercase' }}>
          {tx('Transcription en direct', 'Live transcript')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: statusColor }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: statusColor,
            boxShadow: status === 'live' ? `0 0 0 4px ${statusColor}33` : undefined }} />
          {statusLabel}
        </span>
      </div>
      <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.length === 0 && (
          <div style={{ fontSize: 12, color: colors.graphite2, fontStyle: 'italic' }}>
            {status === 'live'
              ? tx('En écoute…', 'Listening…')
              : tx('La transcription démarrera dès que l\'appel est connecté.', 'Transcript will start once the call is connected.')}
          </div>
        )}
        {sorted.map((e) => (
          <div key={e.key} style={{
            alignSelf: e.speaker === 'agent' ? 'flex-end' : 'flex-start',
            maxWidth: '85%', padding: '6px 10px', borderRadius: 12,
            background: e.speaker === 'agent' ? 'rgba(108, 92, 231, 0.18)' : 'rgba(0, 184, 217, 0.16)',
            border: `1px solid ${e.speaker === 'agent' ? 'rgba(108,92,231,0.45)' : 'rgba(0,184,217,0.45)'}`,
            opacity: e.status === 'partial' ? 0.75 : 1,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
              color: e.speaker === 'agent' ? '#b9aaff' : '#79e6f5',
              textTransform: 'uppercase', marginBottom: 2 }}>
              {e.speaker === 'agent' ? tx('Agent', 'Agent') : tx('Client', 'Client')}
              {e.status === 'partial' && ' · ' + tx('partiel', 'partial')}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.35, color: '#f4f6fb' }}>
              {e.text || (e.status === 'partial' ? '…' : '')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
