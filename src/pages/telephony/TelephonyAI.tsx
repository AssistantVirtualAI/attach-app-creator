import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, MessageSquare, Star } from 'lucide-react';
import { usePbxCallRecords } from '@/hooks/usePbxData';

export default function TelephonyAI() {
  const { data: cdrs = [] } = usePbxCallRecords(500);
  const all = cdrs as any[];
  const transcribed = all.filter(c => c.transcribed).length;
  const analyzed = all.filter(c => c.analyzed).length;
  const withSentiment = all.filter(c => c.raw_data?.sentiment);
  const sentiments = {
    positive: withSentiment.filter(c => /positive/i.test(c.raw_data?.sentiment)).length,
    neutral: withSentiment.filter(c => /neutral/i.test(c.raw_data?.sentiment)).length,
    negative: withSentiment.filter(c => /negative/i.test(c.raw_data?.sentiment)).length,
  };
  const topics = new Map<string, number>();
  all.forEach(c => (c.raw_data?.topics || []).forEach((t: string) => topics.set(t, (topics.get(t) || 0) + 1)));
  const topTopics = Array.from(topics.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const recent = all.filter(c => c.analyzed).slice(0, 8);

  const kpi = (label: string, value: string | number, Icon: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <Icon className="w-4 h-4 text-purple-500" />
      </CardHeader>
      <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Brain className="w-7 h-7" /> AI Intelligence</h1>
        <p className="text-muted-foreground">Conversation insights extracted by Claude</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpi('Calls Transcribed', transcribed, Sparkles)}
        {kpi('Calls Analyzed', analyzed, Brain)}
        {kpi('Positive Sentiment', sentiments.positive, Star)}
        {kpi('Negative Sentiment', sentiments.negative, MessageSquare)}
      </div>

      <Card>
        <CardHeader><CardTitle>Top Topics</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {topTopics.length === 0 ? <p className="text-sm text-muted-foreground">No topics extracted yet.</p> :
            topTopics.map(([t, n]) => <Badge key={t} variant="outline">{t} <span className="ml-1 opacity-60">{n}</span></Badge>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Analyses</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">Nothing analyzed yet.</p> :
            recent.map((c: any) => (
              <div key={c.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono">{c.caller_number || c.caller_name || '—'}</span>
                  <Badge variant="outline">{c.raw_data?.sentiment || 'analyzed'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.raw_data?.summary || '—'}</p>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
