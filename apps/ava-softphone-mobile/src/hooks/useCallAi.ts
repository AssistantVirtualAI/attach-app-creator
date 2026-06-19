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
    if (ranRef.current === callId) {/* allow re-run */ }
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
      await mobileApi.analyzeCall(callId);
      await new Promise((r) => setTimeout(r, 1200));
      await load();
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
