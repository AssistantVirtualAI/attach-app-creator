import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { RecordingWavePlayer } from '@/components/portal/RecordingWavePlayer';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const LEMTEL_ORG_ID = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

type Rec = {
  id: string; start_at: string; duration_seconds: number | null;
  caller_number: string | null; destination_number: string | null;
  extension: string | null; recording_path: string | null;
  recording_name: string | null; has_recording: boolean | null;
  transcript?: string | null;
};

export default function AdminRecordings({ scope = 'org' }: { scope?: 'org' | 'mine' }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let query = (supabase as any).from('pbx_call_records')
        .select('id,start_at,duration_seconds,caller_number,destination_number,extension,recording_path,recording_name,has_recording')
        .eq('organization_id', LEMTEL_ORG_ID)
        .eq('has_recording', true)
        .order('start_at', { ascending: false })
        .limit(200);
      if (scope === 'mine') {
        const { data: auth } = await supabase.auth.getUser();
        const { data: spu } = await (supabase as any).from('pbx_softphone_users')
          .select('extension').eq('portal_user_id', auth.user?.id).maybeSingle();
        if (spu?.extension) query = query.eq('extension', spu.extension);
      }
      const { data } = await query;
      setRows((data ?? []) as Rec[]);
    })();
  }, [scope]);

  const fetchRecording = async (r: Rec): Promise<string | null> => {
    if (urls[r.id]) return urls[r.id];
    if (!r.recording_path || !r.recording_name) {
      toast.error('Missing recording metadata');
      return null;
    }
    setLoading(r.id);
    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'get-recording', params: { record_path: r.recording_path, record_name: r.recording_name } },
      });
      if (error) throw error;
      // invoke returns Blob for binary
      const blob = data instanceof Blob ? data : new Blob([data as any], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setUrls(s => ({ ...s, [r.id]: url }));
      return url;
    } catch (e: any) {
      toast.error('Could not load recording: ' + (e?.message || 'unknown'));
      return null;
    } finally {
      setLoading(null);
    }
  };

  const filtered = rows.filter(r =>
    !q || `${r.caller_number ?? ''} ${r.destination_number ?? ''} ${r.extension ?? ''}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{scope === 'mine' ? 'My Recordings' : 'Call Recordings'}</h1>
        <Input placeholder="Search number, extension…" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
      </div>

      <Card>
        <CardHeader><CardTitle>{filtered.length} recordings</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No recordings.</p>}
          {filtered.map(r => (
            <div key={r.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="font-medium">{r.caller_number ?? '—'} → {r.destination_number ?? '—'}</span>
                  <span className="text-muted-foreground ml-2">Ext {r.extension ?? '—'} · {Math.round((r.duration_seconds ?? 0))}s · {formatDistanceToNow(new Date(r.start_at), { addSuffix: true })}</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{r.recording_name?.split('.').pop() ?? 'wav'}</Badge>
                  <Button size="sm" variant="outline" disabled={loading === r.id} onClick={async () => {
                    const u = await fetchRecording(r);
                    if (u) setExpandedId(expandedId === r.id ? null : r.id);
                  }}>{loading === r.id ? 'Loading…' : expandedId === r.id ? 'Hide' : 'Play'}</Button>
                  {urls[r.id] && (
                    <Button size="icon" variant="outline" asChild>
                      <a href={urls[r.id]} download={r.recording_name ?? `${r.id}.wav`}><Download className="h-4 w-4" /></a>
                    </Button>
                  )}
                </div>
              </div>

              {expandedId === r.id && urls[r.id] && (
                <RecordingWavePlayer url={urls[r.id]} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
