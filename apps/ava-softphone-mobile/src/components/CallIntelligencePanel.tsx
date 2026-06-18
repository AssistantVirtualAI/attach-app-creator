import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Intel {
  status: string;
  transcript: string | null;
  summary: string | null;
  sentiment: string | null;
  satisfaction_score: number | null;
  coaching_score: number | null;
  coaching_notes: string[];
  action_items: string[];
  topics: string[];
}

const EMPTY: Intel = {
  status: "missing", transcript: null, summary: null, sentiment: null,
  satisfaction_score: null, coaching_score: null,
  coaching_notes: [], action_items: [], topics: [],
};

export function CallIntelligencePanel({
  callId, supabase, canRegenerate = false,
}: { callId: string; supabase: SupabaseClient; canRegenerate?: boolean }) {
  const [data, setData] = useState<Intel>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadCached = async (): Promise<Intel | null> => {
    const [{ data: i }, { data: tr }] = await Promise.all([
      supabase.from("pbx_ai_insights").select("*").eq("call_record_id", callId).maybeSingle(),
      supabase.from("pbx_call_transcripts").select("transcript_text").eq("call_record_id", callId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!i || !(tr as any)?.transcript_text) return null;
    const x: any = i;
    return {
      status: "cached", transcript: (tr as any).transcript_text,
      summary: x.summary, sentiment: x.sentiment,
      satisfaction_score: x.satisfaction_score, coaching_score: x.coaching_score,
      coaching_notes: x.coaching_notes ?? [], action_items: x.action_items ?? [], topics: x.topics ?? [],
    };
  };

  const run = async (force = false) => {
    setBusy(true);
    try {
      if (!force) { const c = await loadCached(); if (c) { setData(c); return; } }
      const { data: res, error } = await supabase.functions.invoke("process-call-recording", { body: { callId, force } });
      if (!error && res) setData({ ...EMPTY, ...(res as any) });
    } finally { setBusy(false); setLoading(false); }
  };

  useEffect(() => { setLoading(true); run(false); /* eslint-disable-next-line */ }, [callId]);

  if (loading) return <div style={{ padding: 12, opacity: 0.7 }}>Loading AI analysis…</div>;
  if (data.status === "pending_sync") return <div style={{ padding: 12, color: "#f59e0b" }}>⏳ Recording syncing — analysis will run automatically.</div>;
  if (!data.summary) return <div style={{ padding: 12, opacity: 0.7 }}>No analysis yet.</div>;

  return (
    <div style={{ padding: 12, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>🧠 AI Call Intelligence</strong>
        {canRegenerate && <button onClick={() => run(true)} disabled={busy} style={{ fontSize: 12 }}>{busy ? "…" : "Re-analyze"}</button>}
      </div>
      <p style={{ margin: 0 }}>{data.summary}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
        {data.sentiment && <span>Sentiment: {data.sentiment}</span>}
        {data.satisfaction_score != null && <span>· Satisfaction: {data.satisfaction_score}/5</span>}
        {data.coaching_score != null && <span>· Coaching: {data.coaching_score}/5</span>}
      </div>
      {data.action_items.length > 0 && (
        <div><div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>Action items</div>
          <ul style={{ paddingLeft: 18, margin: 4 }}>{data.action_items.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
      )}
      {data.coaching_notes.length > 0 && (
        <div><div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>✨ Coaching</div>
          <ul style={{ paddingLeft: 18, margin: 4 }}>{data.coaching_notes.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      )}
    </div>
  );
}
