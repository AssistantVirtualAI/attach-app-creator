import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Disc, Loader2, Play, Pause, ChevronDown, Sparkles } from 'lucide-react';
import { usePbxCallRecords, LEMTEL_ORG } from '@/hooks/usePbxData';
import { usePbxRealtime } from '@/hooks/usePbxRealtime';
import { SyncEverythingButton } from '@/components/lemtel/SyncEverythingButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const isRecordingListChange = (payload: any) => {
  if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') return true;
  const oldRow = payload.old || {};
  const newRow = payload.new || {};
  const hasComparableOldRow = Object.prototype.hasOwnProperty.call(oldRow, 'has_recording')
    || Object.prototype.hasOwnProperty.call(oldRow, 'recording_url')
    || Object.prototype.hasOwnProperty.call(oldRow, 'recording_path')
    || Object.prototype.hasOwnProperty.call(oldRow, 'recording_name');
  if (!hasComparableOldRow) return false;
  return oldRow.has_recording !== newRow.has_recording
    || oldRow.recording_url !== newRow.recording_url
    || oldRow.recording_path !== newRow.recording_path
    || oldRow.recording_name !== newRow.recording_name;
};

function sentimentBadge(s?: string) {
  if (!s) return null;
  const v = s.toLowerCase();
  if (v.includes('positive')) return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400">🟢 Positive</Badge>;
  if (v.includes('negative')) return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400">🔴 Negative</Badge>;
  return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">🟡 Neutral</Badge>;
}

export default function TelephonyRecordings({ scope = 'org' }: { scope?: 'org' | 'mine' }) {
  const qc = useQueryClient();
  usePbxRealtime(['pbx_call_records', 'pbx_call_recordings'], ['pbx'], {
    throttleMs: 30_000,
    shouldInvalidate: isRecordingListChange,
  });
  const { data: myExt } = useQuery({
    queryKey: ['recordings-my-extension'],
    enabled: scope === 'mine',
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await (supabase as any).from('pbx_softphone_users')
        .select('extension').eq('portal_user_id', auth.user.id).maybeSingle();
      return data?.extension ?? null;
    },
  });
  const { data: cdrs = [], isLoading } = usePbxCallRecords(200, {
    extension: scope === 'mine' ? myExt : undefined,
    enabled: scope !== 'mine' || !!myExt,
  });
  const recordings = (cdrs as any[]).filter(c => c.has_recording || c.recording_url);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const transcribeAndAnalyze = async (id: string) => {
    setWorking(id);
    try {
      const t = await supabase.functions.invoke('ai-transcribe-call', {
        body: { call_record_id: id, organization_id: LEMTEL_ORG },
      });
      if (t.error) throw new Error(`Transcription: ${t.error.message}`);
      const tData: any = t.data || {};
      if (tData.stub) toast.message('Transcript unavailable', { description: tData.reason || 'Using metadata fallback' });

      const a = await supabase.functions.invoke('ai-analyze-call', {
        body: { call_record_id: id, organization_id: LEMTEL_ORG },
      });
      if (a.error) throw new Error(`Analysis: ${a.error.message}`);
      const aData: any = a.data || {};
      if (aData.ok === false) throw new Error(aData.error || 'Analysis returned no result');
      if (aData.stub) toast.message('AI analysis unavailable', { description: aData.reason || 'Showing metadata only' });
      else toast.success('Transcribed and analyzed');

      qc.setQueriesData({ queryKey: ['pbx'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((row) => row?.id === id ? {
          ...row,
          transcribed: true,
          analyzed: !aData.stub,
          raw_data: { ...(row.raw_data || {}), ai: aData.insights || aData },
        } : row);
      });
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally { setWorking(null); }
  };


  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Disc className="w-7 h-7" /> Recordings</h1>
          <p className="text-muted-foreground">Call recordings with AI transcription and analysis</p>
        </div>
        <SyncEverythingButton />
      </div>

      {recordings.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No recordings yet.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recordings.map((c: any) => (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-mono">{c.caller_number || c.caller_name || '—'}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{c.start_at ? new Date(c.start_at).toLocaleString() : ''}</p>
                  </div>
                  <Badge variant="outline">{c.duration_seconds || 0}s</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col">
                {c.recording_url ? (
                  <audio controls src={c.recording_url} className="w-full" onPlay={() => setPlaying(c.id)} onPause={() => setPlaying(null)} />
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-2 border rounded">Recording URL not available</div>
                )}
                <div className="flex items-center justify-between">
                  {sentimentBadge(c.raw_data?.sentiment) || <Badge variant="outline">Not analyzed</Badge>}
                  {!c.transcribed && (
                    <Button size="sm" variant="outline" onClick={() => transcribeAndAnalyze(c.id)} disabled={working === c.id}>
                      {working === c.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                      Transcribe & Analyze
                    </Button>
                  )}
                </div>
                {c.transcribed && (
                  <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                    <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${expanded === c.id ? 'rotate-180' : ''}`} /> Details
                  </Button>
                )}
                {expanded === c.id && (
                  <div className="space-y-2 text-sm border-t pt-3">
                    <div><span className="font-semibold">Summary:</span> <p className="text-muted-foreground mt-1">{c.raw_data?.summary || '—'}</p></div>
                    {c.raw_data?.topics && <div className="flex flex-wrap gap-1">{(c.raw_data.topics as string[]).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
