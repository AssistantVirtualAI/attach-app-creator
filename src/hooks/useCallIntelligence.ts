import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CallIntelligence {
  status: "cached" | "created" | "regenerated" | "pending_sync" | "missing";
  transcript: string | null;
  summary: string | null;
  sentiment: string | null;
  satisfaction_score: number | null;
  quality_score: number | null;
  coaching_score: number | null;
  coaching_notes: string[];
  action_items: string[];
  topics: string[];
  key_phrases: string[];
  intent: string | null;
  risks: string[];
  sales_opportunities: string[];
  escalation_needed: boolean;
}

const EMPTY: CallIntelligence = {
  status: "missing",
  transcript: null,
  summary: null,
  sentiment: null,
  satisfaction_score: null,
  quality_score: null,
  coaching_score: null,
  coaching_notes: [],
  action_items: [],
  topics: [],
  key_phrases: [],
  intent: null,
  risks: [],
  sales_opportunities: [],
  escalation_needed: false,
};

async function loadCached(callId: string): Promise<CallIntelligence | null> {
  const [{ data: insight }, { data: tr }] = await Promise.all([
    supabase.from("pbx_ai_insights").select("*").eq("call_record_id", callId).maybeSingle(),
    supabase
      .from("pbx_call_transcripts")
      .select("transcript_text")
      .eq("call_record_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!insight || !tr?.transcript_text) return null;
  return {
    status: "cached",
    transcript: tr.transcript_text,
    summary: (insight as any).summary ?? null,
    sentiment: (insight as any).sentiment ?? null,
    satisfaction_score: (insight as any).satisfaction_score ?? null,
    quality_score: (insight as any).quality_score ?? null,
    coaching_score: (insight as any).coaching_score ?? null,
    coaching_notes: (insight as any).coaching_notes ?? [],
    action_items: (insight as any).action_items ?? [],
    topics: (insight as any).topics ?? [],
    key_phrases: (insight as any).key_phrases ?? [],
    intent: (insight as any).intent ?? null,
    risks: (insight as any).risks ?? [],
    sales_opportunities: (insight as any).sales_opportunities ?? [],
    escalation_needed: (insight as any).escalation_needed ?? false,
  };
}

async function process(callId: string, force = false): Promise<CallIntelligence> {
  const { data, error } = await supabase.functions.invoke("process-call-recording", {
    body: { callId, force },
  });
  if (error) throw error;
  return { ...EMPTY, ...(data as Partial<CallIntelligence>) };
}

export function useCallIntelligence(callId: string | null | undefined) {
  const qc = useQueryClient();
  const key = ["call-intel", callId];

  const query = useQuery({
    queryKey: key,
    enabled: !!callId,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      if (!callId) return EMPTY;
      const cached = await loadCached(callId);
      if (cached) return cached;
      return await process(callId, false);
    },
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      if (!callId) throw new Error("no call");
      return await process(callId, true);
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  return {
    data: query.data ?? EMPTY,
    isLoading: query.isLoading,
    error: query.error,
    isPending: query.data?.status === "pending_sync",
    refetch: query.refetch,
    regenerate: regenerate.mutate,
    isRegenerating: regenerate.isPending,
  };
}
