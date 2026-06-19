import { useCallback, useEffect, useRef, useState } from 'react';
import { mobileApi, CallDetail } from '../lib/mobileApi';

export type AiStage = 'idle' | 'transcribing' | 'analyzing' | 'done' | 'error';

export interface CallAiMeta {
  recording_path?: string | null;
  recording_name?: string | null;
  domain_uuid?: string | null;
  xml_cdr_uuid?: string | null;
  organization_id?: string | null;
}

/**
 * Shared hook to load a call's transcript + AI insights and (re)run
 * `ai-transcribe-call` → `ai-analyze-call`. Used by the recording row in
 * RecordingsScreen and by CallDetailScreen.
 */
export function useCallAi(callId: string | null, meta: CallAiMeta | undefined, opts: { autoLoad?: boolean } = {}) {
  const { autoLoad = true } = opts;
  const [data, setData] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<AiStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!callId) return null;
    setLoading(true);
    try {
      const d = await mobileApi.callDetail(callId);
      setData(d);
      return d;
    } catch (e: any) {
      setError(e?.message || 'Failed to load call');
      return null;
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    if (autoLoad && callId) { load(); }
  }, [autoLoad, callId, load]);

  const run = useCallback(async () => {
    if (!callId || running) return;
    setRunning(true);
    setError(null);
    setStage('transcribing');
    try {
      const t = await mobileApi.transcribeCall(callId, {
        recording_path: meta?.recording_path,
        recording_name: meta?.recording_name,
        domain_uuid: meta?.domain_uuid,
        xml_cdr_uuid: meta?.xml_cdr_uuid || callId,
        organization_id: meta?.organization_id,
      });
      if (t?.stub || t?.error) {
        const detail = [t.error || t.reason || 'transcription unavailable', ...(t.fetchErrors || [])].filter(Boolean).join(' · ');
        throw new Error(detail);
      }
      setStage('analyzing');
      const a: any = await mobileApi.analyzeCall(callId);
      if (a?.ok === false || a?.error) {
        throw new Error(a?.error || a?.reason || 'analysis failed');
      }
      // Merge analyze response directly so the UI updates even if the
      // downstream callDetail roundtrip is slow or eventually consistent.
      const ai = a?.insights || a?.analysis || a || {};
      const transcriptText: string = a?.transcript_text || a?.transcript || (t as any)?.transcript_text || '';
      const transcriptLines = transcriptText
        ? transcriptText.split(/\r?\n/).filter(Boolean).map((ln: string, i: number) => {
            const m = ln.match(/^\s*(agent|caller|customer|client|user)\s*[:\-]\s*(.+)$/i);
            const speaker = (m?.[1] || '').toLowerCase();
            return {
              speaker: speaker === 'agent' ? 'agent' : speaker ? 'customer' : (i % 2 === 0 ? 'customer' : 'agent'),
              text: m?.[2] || ln,
              t: i,
            } as { speaker: 'agent' | 'customer'; text: string; t: number };
          })
        : [];
      setData((prev) => ({
        ...(prev || {} as any),
        transcript: transcriptLines.length ? transcriptLines : (prev?.transcript || []),
        summary: ai.summary || prev?.summary || '',
        topics: ai.topics || prev?.topics || [],
        actionItems: ai.action_items || ai.actionItems || prev?.actionItems || [],
        qualityScore: ai.quality_score ?? ai.qualityScore ?? prev?.qualityScore ?? 0,
        coachingScore: ai.coaching_score ?? ai.coachingScore ?? prev?.coachingScore ?? null,
        coachingNotes: ai.coaching_notes || ai.coachingNotes || prev?.coachingNotes || [],
        sentiment: ai.sentiment || prev?.sentiment,
        intent: ai.intent || prev?.intent || '',
      } as any));
      // Best-effort: refresh from server but don't block UI on it.
      load().catch(() => {});
      ranRef.current = callId;
      setStage('done');
    } catch (e: any) {
      setError(e?.message || 'Transcription failed');
      setStage('error');
    } finally {
      setRunning(false);
    }
  }, [callId, running, meta, load]);


  return { data, loading, running, stage, error, load, run, setData };
}
