/**
 * Shared logic for detecting a "stub" transcript and computing a
 * content-presence quality score. Mirrored in apps/ava-softphone-desktop
 * so both consoles report the same status everywhere.
 */

export type TranscriptStage =
  | 'idle'
  | 'downloading'   // pulling audio from PBX / Twilio / storage
  | 'transcribing'  // sending audio to AI
  | 'analyzing'     // analyzing transcript text
  | 'pending_sync'  // recording not yet available in storage; will auto-retry
  | 'complete'
  | 'unavailable'   // recording could not be retrieved
  | 'failed';

export const STUB_PROVIDER_PREFIX = 'stub';

export interface TranscriptLike {
  provider?: string | null;
  transcript_text?: string | null;
}

export interface InsightLike {
  ai_model?: string | null;
  summary?: string | null;
  quality_score?: number | null;
}

export function isStubProvider(provider?: string | null): boolean {
  if (!provider) return false;
  const p = String(provider).toLowerCase();
  return p.startsWith(STUB_PROVIDER_PREFIX) || p === 'skipped-no-transcript';
}

export function isStubTranscript(t?: TranscriptLike | null): boolean {
  if (!t) return true;
  if (isStubProvider(t.provider)) return true;
  const text = (t.transcript_text || '').trim();
  if (!text) return true;
  // Metadata-only fallback signature.
  return /^Call\s+(inbound|outbound|unknown)\s+from\b/i.test(text)
    && /Hangup cause:/i.test(text)
    && text.split(/\n+/).length <= 6;
}

export function isStubInsight(i?: InsightLike | null): boolean {
  if (!i) return true;
  if (isStubProvider(i.ai_model)) return true;
  const s = (i.summary || '').toLowerCase();
  return s.includes('transcript not yet available')
      || s.includes('ai analysis unavailable')
      || s.includes('only basic call metadata');
}

/**
 * Quality estimator based on content presence rather than a single AI score.
 * Returns 0–100 plus a breakdown the UI can render as a stack of meters.
 */
export interface QualityBreakdown {
  total: number; // 0..100
  reasons: string[];
  parts: {
    transcriptLength: number;     // 0..40
    speakerSegments: number;      // 0..25
    silenceRatio: number;         // 0..15
    aiSummary: number;            // 0..20
  };
  contentPresent: boolean;
}

export function estimateQuality(
  transcript: TranscriptLike | null | undefined,
  insight: InsightLike | null | undefined,
  durationSec?: number | null,
): QualityBreakdown {
  const reasons: string[] = [];
  const stubT = isStubTranscript(transcript);
  const stubI = isStubInsight(insight);
  if (stubT) reasons.push('Transcript incomplete or missing');
  if (stubI) reasons.push('AI analysis unavailable');

  const text = (transcript?.transcript_text || '').trim();
  const words = text ? text.split(/\s+/).length : 0;

  // 1. Transcript length (40)
  const expectedWords = Math.max(20, Math.round((durationSec || 0) * 2.2));
  const lenScore = stubT ? 0 : Math.min(40, Math.round((words / expectedWords) * 40));

  // 2. Speaker segments — labeled lines (Agent:/Caller:)
  const segments = (text.match(/^\s*(Agent|Caller|Speaker\s*\d+)\s*:/gim) || []).length;
  const segScore = stubT ? 0 : Math.min(25, segments * 3);

  // 3. Silence ratio — proxy: words / duration. Lower words/sec means more silence.
  let silenceScore = 0;
  if (!stubT && durationSec && durationSec > 0) {
    const wps = words / durationSec;
    // Healthy conversation ≈ 1.5–3 wps. <0.4 wps is mostly silence/noise.
    silenceScore = Math.max(0, Math.min(15, Math.round(((wps - 0.4) / 1.6) * 15)));
  }

  // 4. AI summary present and non-stub (20)
  const summaryScore = stubI ? 0 : 20;

  const total = lenScore + segScore + silenceScore + summaryScore;
  return {
    total,
    reasons,
    parts: { transcriptLength: lenScore, speakerSegments: segScore, silenceRatio: silenceScore, aiSummary: summaryScore },
    contentPresent: !stubT && words > 8,
  };
}

export const STAGE_LABEL: Record<TranscriptStage, string> = {
  idle: 'Idle',
  downloading: 'Téléchargement du fichier audio…',
  transcribing: 'Transcription en cours…',
  analyzing: 'Analyse en cours…',
  complete: 'Transcription et analyse terminées',
  unavailable: 'Enregistrement indisponible',
  failed: 'Échec',
};

export const STAGE_LABEL_EN: Record<TranscriptStage, string> = {
  idle: 'Idle',
  downloading: 'Downloading audio…',
  transcribing: 'Transcribing…',
  analyzing: 'Analyzing transcript…',
  complete: 'Transcribed and analyzed',
  unavailable: 'Recording unavailable',
  failed: 'Failed',
};

/**
 * Orchestrate a multi-stage transcribe+analyze run with progress callbacks.
 * Caller provides Supabase functions.invoke; this just wires the stages and
 * normalises the responses so every UI shows the same status.
 */
export async function runTranscribeAndAnalyze(opts: {
  invoke: (name: string, body: any) => Promise<{ data: any; error: any }>;
  callRecordId: string;
  organizationId: string;
  recordingUrl?: string | null;
  onStage: (stage: TranscriptStage, detail?: string) => void;
}): Promise<{ stage: TranscriptStage; transcriptStub: boolean; insightStub: boolean; reason?: string; data: any }> {
  const { invoke, callRecordId, organizationId, recordingUrl, onStage } = opts;
  try {
    onStage('downloading', 'Connexion à la source audio');
    onStage('transcribing');
    const t = await invoke('ai-transcribe-call', {
      call_record_id: callRecordId,
      organization_id: organizationId,
      ...(recordingUrl ? { recording_url: recordingUrl } : {}),
    });
    if (t.error) {
      onStage('failed', t.error.message);
      return { stage: 'failed', transcriptStub: true, insightStub: true, reason: t.error.message, data: t };
    }
    const tData: any = t.data || {};
    const transcriptStub = !!tData.stub;
    if (transcriptStub) {
      onStage('unavailable', tData.reason || 'no-audio');
    }

    onStage('analyzing');
    const a = await invoke('ai-analyze-call', {
      call_record_id: callRecordId,
      organization_id: organizationId,
    });
    if (a.error) {
      onStage('failed', a.error.message);
      return { stage: 'failed', transcriptStub, insightStub: true, reason: a.error.message, data: { t, a } };
    }
    const aData: any = a.data || {};
    const insightStub = !!aData.stub;
    if (transcriptStub) {
      onStage('unavailable', tData.reason);
      return { stage: 'unavailable', transcriptStub, insightStub, reason: tData.reason, data: aData };
    }
    onStage('complete');
    return { stage: 'complete', transcriptStub, insightStub, data: aData };
  } catch (e: any) {
    onStage('failed', e?.message || 'unknown');
    return { stage: 'failed', transcriptStub: true, insightStub: true, reason: e?.message, data: null };
  }
}
