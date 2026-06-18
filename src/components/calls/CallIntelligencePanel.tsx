import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, RefreshCw, ChevronDown, ChevronUp, Clock, AlertCircle } from "lucide-react";
import { useCallIntelligence } from "@/hooks/useCallIntelligence";

interface Props {
  callId: string;
  canRegenerate?: boolean;
}

export function CallIntelligencePanel({ callId, canRegenerate = false }: Props) {
  const { data, isLoading, isPending, regenerate, isRegenerating } = useCallIntelligence(callId);
  const [showTranscript, setShowTranscript] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> AI Call Intelligence</CardTitle></CardHeader>
        <CardContent className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent>
      </Card>
    );
  }

  if (isPending || data.status === "pending_sync") {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> AI Call Intelligence</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-amber-500">
            <Clock className="h-4 w-4" /> Recording is syncing from the PBX. Analysis will run automatically.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.summary && data.status !== "cached") {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> AI Call Intelligence</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" /> No analysis yet for this call.
          </div>
        </CardContent>
      </Card>
    );
  }

  const sentimentColor =
    data.sentiment === "positive" ? "text-emerald-500" :
    data.sentiment === "negative" ? "text-red-500" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4" /> AI Call Intelligence
          {data.status === "cached" && <Badge variant="outline" className="text-xs">Cached</Badge>}
        </CardTitle>
        {canRegenerate && (
          <Button variant="ghost" size="sm" onClick={() => regenerate()} disabled={isRegenerating}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRegenerating ? "animate-spin" : ""}`} /> Re-analyze
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {data.summary && (
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Summary</div>
            <p>{data.summary}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {data.sentiment && <Badge variant="outline" className={sentimentColor}>Sentiment: {data.sentiment}</Badge>}
          {data.satisfaction_score != null && <Badge variant="outline">Satisfaction: {data.satisfaction_score}/5</Badge>}
          {data.quality_score != null && <Badge variant="outline">Quality: {data.quality_score}/5</Badge>}
          {data.coaching_score != null && <Badge variant="outline">Coaching: {data.coaching_score}/5</Badge>}
          {data.escalation_needed && <Badge variant="destructive">Escalation needed</Badge>}
        </div>

        {data.action_items.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Action items</div>
            <ul className="list-disc pl-5 space-y-1">{data.action_items.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}

        {data.coaching_notes.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Coaching notes
            </div>
            <ul className="list-disc pl-5 space-y-1">{data.coaching_notes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}

        {data.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.topics.map((t, i) => <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>)}
          </div>
        )}

        {data.transcript && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setShowTranscript((s) => !s)} className="px-0">
              {showTranscript ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              Transcript
            </Button>
            {showTranscript && (
              <pre className="mt-2 whitespace-pre-wrap text-xs bg-muted/50 p-3 rounded-md max-h-80 overflow-auto">
                {data.transcript}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
