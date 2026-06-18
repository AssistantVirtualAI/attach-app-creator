import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Intel {
  status: string;
  transcript: string | null;
  summary: string | null;
  sentiment: string | null;
  satisfaction_score: number | null;
  quality_score: number | null;
  coaching_score: number | null;
  coaching_notes: string[];
  action_items: string[];
  topics: string[];
  intent: string | null;
  escalation_needed: boolean;
}

const EMPTY: Intel = {
  status: "missing", transcript: null, summary: null, sentiment: null,
  satisfaction_score: null, quality_score: null, coaching_score: null,
  coaching_notes: [], action_items: [], topics: [], intent: null, escalation_needed: false,
};

async function loadCached(callId: string): Promise<Intel | null> {
  const [{ data: insight }, { data: tr }] = await Promise.all([
    supabase.from("pbx_ai_insights").select("*").eq("call_record_id", callId).maybeSingle(),
    supabase.from("pbx_call_transcripts").select("transcript_text").eq("call_record_id", callId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!insight || !(tr as any)?.transcript_text) return null;
  const i: any = insight;
  return {
    status: "cached", transcript: (tr as any).transcript_text,
    summary: i.summary, sentiment: i.sentiment,
    satisfaction_score: i.satisfaction_score, quality_score: i.quality_score,
    coaching_score: i.coaching_score, coaching_notes: i.coaching_notes ?? [],
    action_items: i.action_items ?? [], topics: i.topics ?? [],
    intent: i.intent, escalation_needed: i.escalation_needed ?? false,
  };
}

export function CallIntelligencePanel({ callId, canRegenerate = false }: { callId: string; canRegenerate?: boolean }) {
  const [data, setData] = useState<Intel>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const run = async (force = false) => {
    setBusy(true);
    try {
      if (!force) {
        const cached = await loadCached(callId);
        if (cached) { setData(cached); return; }
      }
      const { data: res, error } = await supabase.functions.invoke("process-call-recording", { body: { callId, force } });
      if (!error && res) setData({ ...EMPTY, ...(res as any) });
    } finally { setBusy(false); setLoading(false); }
  };

  useEffect(() => { setLoading(true); run(false); /* eslint-disable-next-line */ }, [callId]);

  if (loading) return <div className="rounded-md border p-3 text-sm opacity-70">Loading AI analysis…</div>;
  if (data.status === "pending_sync") return <div className="rounded-md border p-3 text-sm text-amber-500">⏳ Recording syncing from PBX — analysis will run automatically.</div>;
  if (!data.summary) return <div className="rounded-md border p-3 text-sm opacity-70">No analysis yet.</div>;

  const sColor = data.sentiment === "positive" ? "text-emerald-500" : data.sentiment === "negative" ? "text-red-500" : "opacity-70";

  return (
    <div className="rounded-md border p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold flex items-center gap-2">🧠 AI Call Intelligence
          {data.status === "cached" && <span className="text-xs px-1.5 py-0.5 border rounded">cached</span>}
        </div>
        {canRegenerate && (
          <button className="text-xs underline" onClick={() => run(true)} disabled={busy}>
            {busy ? "…" : "Re-analyze"}
          </button>
        )}
      </div>
      <p>{data.summary}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {data.sentiment && <span className={`px-2 py-0.5 border rounded ${sColor}`}>Sentiment: {data.sentiment}</span>}
        {data.satisfaction_score != null && <span className="px-2 py-0.5 border rounded">Satisfaction: {data.satisfaction_score}/5</span>}
        {data.quality_score != null && <span className="px-2 py-0.5 border rounded">Quality: {data.quality_score}/5</span>}
        {data.coaching_score != null && <span className="px-2 py-0.5 border rounded">Coaching: {data.coaching_score}/5</span>}
        {data.escalation_needed && <span className="px-2 py-0.5 border rounded text-red-500">Escalation needed</span>}
      </div>
      {data.action_items.length > 0 && (
        <div><div className="text-xs uppercase opacity-60 mb-1">Action items</div>
          <ul className="list-disc pl-5">{data.action_items.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
      )}
      {data.coaching_notes.length > 0 && (
        <div><div className="text-xs uppercase opacity-60 mb-1">✨ Coaching</div>
          <ul className="list-disc pl-5">{data.coaching_notes.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      )}
      {data.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">{data.topics.map((t, i) => <span key={i} className="text-xs px-1.5 py-0.5 border rounded">{t}</span>)}</div>
      )}
      {data.transcript && (
        <div>
          <button className="text-xs underline" onClick={() => setShowTranscript(s => !s)}>
            {showTranscript ? "Hide" : "Show"} transcript
          </button>
          {showTranscript && <pre className="mt-2 whitespace-pre-wrap text-xs bg-black/20 p-2 rounded max-h-72 overflow-auto">{data.transcript}</pre>}
        </div>
      )}
    </div>
  );
}
