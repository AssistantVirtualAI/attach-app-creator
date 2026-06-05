import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Play, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { usePbxCallRecords, usePbxSync, LEMTEL_ORG } from '@/hooks/usePbxData';
import { useQueryClient } from '@tanstack/react-query';

export default function LemtelPortalCalls() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: cdrs = [], isLoading } = usePbxCallRecords(100);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const sync = usePbxSync();

  const analyze = async (call_record_id: string) => {
    setAnalyzing(call_record_id);
    const { error } = await supabase.functions.invoke('ai-analyze-call', {
      body: { call_record_id, transcript_text: '', organization_id: LEMTEL_ORG },
    });
    setAnalyzing(null);
    if (error) toast({ title: 'Analysis failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Analyzed' }); qc.invalidateQueries({ queryKey: ['pbx', 'pbx_call_records'] }); }
  };

  const playRecording = async (c: any) => {
    setPlayingId(c.id); setAudioUrl(null);
    const raw = c.recording_url || '';
    const lastSlash = raw.lastIndexOf('/');
    const record_path = raw.slice(0, lastSlash);
    const record_name = raw.slice(lastSlash + 1);
    const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
      body: { action: 'get-recording', params: { record_path, record_name }, organization_id: LEMTEL_ORG },
    });
    if (error || !data) {
      toast({ title: 'Playback failed', description: error?.message, variant: 'destructive' });
      setPlayingId(null); return;
    }
    const blob = data instanceof Blob ? data : new Blob([data as any], { type: 'audio/wav' });
    setAudioUrl(URL.createObjectURL(blob));
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Call History</h1><p className="text-muted-foreground">{cdrs.length} calls</p></div>
        <Button onClick={() => sync.mutate('cdr')} disabled={sync.isPending} variant="outline">
          {sync.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Sync CDRs
        </Button>
      </div>

      {audioUrl && (
        <Card className="p-3">
          <audio src={audioUrl} controls autoPlay onEnded={() => { setPlayingId(null); setAudioUrl(null); }} className="w-full" />
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Direction</th>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">From</th>
              <th className="text-left p-3">To</th>
              <th className="text-left p-3">Duration</th>
              <th className="text-left p-3">Recording</th>
              <th className="text-left p-3">AI</th>
            </tr>
          </thead>
          <tbody>
            {cdrs.length === 0 ? (
              <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">
                No calls yet. Click <strong>Sync CDRs</strong> above to pull from FusionPBX.
              </td></tr>
            ) : (cdrs as any[]).map((c: any) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{c.direction === 'inbound' ? '🟢' : c.direction === 'outbound' ? '🔵' : c.missed_call ? '🔴' : '⚪'}</td>
                <td className="p-3">{c.start_at ? format(new Date(c.start_at), 'PP HH:mm') : '-'}</td>
                <td className="p-3">{c.caller_number || '-'}</td>
                <td className="p-3">{c.destination || '-'}</td>
                <td className="p-3">{Math.floor((c.duration_seconds || 0) / 60)}:{String((c.duration_seconds || 0) % 60).padStart(2, '0')}</td>
                <td className="p-3">
                  {c.has_recording ? (
                    <Button size="sm" variant="ghost" disabled={playingId === c.id && !audioUrl} onClick={() => playRecording(c)}>
                      {playingId === c.id && !audioUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    </Button>
                  ) : '-'}
                </td>
                <td className="p-3">
                  {c.analyzed ? <Badge variant="default">Analyzed</Badge> : (
                    <Button size="sm" variant="outline" onClick={() => analyze(c.id)} disabled={analyzing === c.id}>
                      {analyzing === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3 mr-1" />Analyze</>}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
