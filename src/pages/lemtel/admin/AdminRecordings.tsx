import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { RecordingWavePlayer } from '@/components/portal/RecordingWavePlayer';
import { Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const LEMTEL_ORG_ID = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

type Rec = {
  id: string; start_at: string; duration_seconds: number | null;
  caller_number: string | null; destination_number: string | null;
  extension: string | null; recording_path: string | null;
  transcript: string | null; ai_summary: string | null;
  ai_sentiment: string | null;
};

export default function AdminRecordings({ scope = 'org' }: { scope?: 'org' | 'mine' }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      let query = (supabase as any).from('pbx_call_records')
        .select('id,start_at,duration_seconds,caller_number,destination_number,extension,recording_path,transcript,ai_summary,ai_sentiment')
        .eq('organization_id', LEMTEL_ORG_ID)
        .not('recording_path', 'is', null)
        .order('start_at', { ascending: false })
        .limit(100);
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

  const sign = async (path: string) => {
    if (signedUrls[path]) return signedUrls[path];
    const { data } = await supabase.storage.from('lemtel-recordings').createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      setSignedUrls(s => ({ ...s, [path]: data.signedUrl }));
      return data.signedUrl;
    }
  };

  const share = async (path: string) => {
    const { data } = await supabase.storage.from('lemtel-recordings').createSignedUrl(path, 7 * 24 * 3600);
    if (data?.signedUrl) {
      await navigator.clipboard.writeText(data.signedUrl);
      toast.success('Share link copied (valid 7 days)');
    }
  };

  const filtered = rows.filter(r =>
    !q || `${r.caller_number ?? ''} ${r.destination_number ?? ''} ${r.transcript ?? ''}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{scope === 'mine' ? 'My Recordings' : 'Call Recordings'}</h1>
        <Input placeholder="Search number, name, transcript…" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
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
                  {r.ai_sentiment && <Badge variant="outline">{r.ai_sentiment}</Badge>}
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (r.recording_path) {
                      await sign(r.recording_path);
                      setExpandedId(expandedId === r.id ? null : r.id);
                    }
                  }}>{expandedId === r.id ? 'Hide' : 'Open'}</Button>
                  {r.recording_path && <Button size="icon" variant="outline" onClick={() => share(r.recording_path!)}><Share2 className="h-4 w-4" /></Button>}
                  {r.recording_path && signedUrls[r.recording_path] && (
                    <Button size="icon" variant="outline" asChild><a href={signedUrls[r.recording_path]} download><Download className="h-4 w-4" /></a></Button>
                  )}
                </div>
              </div>

              {expandedId === r.id && r.recording_path && signedUrls[r.recording_path] && (
                <div className="space-y-3">
                  <RecordingWavePlayer url={signedUrls[r.recording_path]} />
                  {r.transcript && (
                    <div className="rounded-md bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                      <strong>Transcript:</strong>
                      <p className="mt-1">{r.transcript}</p>
                    </div>
                  )}
                  {r.ai_summary && (
                    <div className="rounded-md bg-muted/30 p-3 text-sm">
                      <strong>AI summary:</strong>
                      <p className="mt-1">{r.ai_summary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
