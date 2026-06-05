import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CDR {
  id: string;
  call_uuid: string;
  direction: string | null;
  caller_id_number: string | null;
  caller_destination: string | null;
  duration: number;
  start_stamp: string | null;
  record_path: string | null;
  analyzed: boolean;
  ai_processing: boolean;
}

export default function LemtelPortalCalls() {
  const { toast } = useToast();
  const [cdrs, setCdrs] = useState<CDR[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from('lemtel_cdrs_cache').select('*').order('start_stamp', { ascending: false }).limit(100);
    setCdrs((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const analyze = async (call_uuid: string) => {
    setAnalyzing(call_uuid);
    // Stub: real flow fetches recording, transcribes, analyzes. Here we send mock transcript.
    const { error } = await supabase.functions.invoke('ai-call-analysis', {
      body: { call_uuid, transcript: 'Agent: Hello, how can I help? Caller: I need support with my account.' },
    });
    setAnalyzing(null);
    if (error) toast({ title: 'Analysis failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Analyzed', description: 'AI analysis complete' }); load(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Call History</h1><p className="text-muted-foreground">{cdrs.length} calls</p></div>
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
              <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No calls yet. Configure FusionPBX to sync CDRs.</td></tr>
            ) : cdrs.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{c.direction === 'inbound' ? '🟢' : c.direction === 'outbound' ? '🔵' : '⚪'}</td>
                <td className="p-3">{c.start_stamp ? format(new Date(c.start_stamp), 'PP HH:mm') : '-'}</td>
                <td className="p-3">{c.caller_id_number || '-'}</td>
                <td className="p-3">{c.caller_destination || '-'}</td>
                <td className="p-3">{Math.floor(c.duration / 60)}:{String(c.duration % 60).padStart(2, '0')}</td>
                <td className="p-3">{c.record_path ? <Button size="sm" variant="ghost"><Play className="w-3 h-3" /></Button> : '-'}</td>
                <td className="p-3">
                  {c.analyzed ? <Badge variant="default">Analyzed</Badge> : (
                    <Button size="sm" variant="outline" onClick={() => analyze(c.call_uuid)} disabled={analyzing === c.call_uuid || c.ai_processing}>
                      {analyzing === c.call_uuid ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3 mr-1" />Analyze</>}
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
