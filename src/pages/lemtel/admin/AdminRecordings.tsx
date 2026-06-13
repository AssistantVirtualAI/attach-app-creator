import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { RecordingWavePlayer } from '@/components/portal/RecordingWavePlayer';
import { Download, RefreshCw, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { loadPbxRecordingAudio } from '@/lib/pbxRecordingAudio';

const LEMTEL_ORG_ID = '71755d33-ed64-4ad5-a828-61c9d2029eb7';
const PAGE_SIZE = 100;

type Rec = {
  id: string; start_at: string; duration_seconds: number | null;
  caller_name: string | null; caller_number: string | null;
  destination: string | null; destination_number: string | null;
  extension: string | null; direction: string | null;
  recording_path: string | null; recording_name: string | null;
  has_recording: boolean | null;
  pbx_uuid: string | null; domain_uuid: string | null; domain_name: string | null;
};

export default function AdminRecordings({ scope = 'org' }: { scope?: 'org' | 'mine' }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loadingRow, setLoadingRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  const loadPage = useCallback(async (pageNum: number, reset = false) => {
    setLoading(true);
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = (supabase as any).from('pbx_call_records')
        .select('id,start_at,duration_seconds,caller_name,caller_number,destination,destination_number,extension,direction,recording_path,recording_name,has_recording,pbx_uuid,domain_uuid,domain_name', { count: 'exact' })
        .eq('organization_id', LEMTEL_ORG_ID)
        .eq('has_recording', true)
        .order('start_at', { ascending: false })
        .range(from, to);
      if (scope === 'mine') {
        const { data: auth } = await supabase.auth.getUser();
        const { data: spu } = await (supabase as any).from('pbx_softphone_users')
          .select('extension').eq('portal_user_id', auth.user?.id).maybeSingle();
        if (spu?.extension) query = query.eq('extension', spu.extension);
      }
      const { data, count, error } = await query;
      if (error) throw error;
      const newRows = (data ?? []) as Rec[];
      setRows(prev => reset ? newRows : [...prev, ...newRows]);
      setTotal(count ?? null);
      setHasMore(newRows.length === PAGE_SIZE);
      setPage(pageNum);
    } catch (e: any) {
      toast.error('Failed to load: ' + (e?.message || 'unknown'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { loadPage(0, true); }, [loadPage]);

  const syncFromPbx = async () => {
    setSyncing(true);
    try {
      toast.info('Backfilling recordings from PBX… this can take a minute.');
      const { data, error } = await (supabase as any).functions.invoke('fusionpbx-proxy', {
        body: { action: 'backfill-cdrs', organization_id: LEMTEL_ORG_ID, page_size: 500, max_pages: 50 },
      });
      if (error) throw error;
      toast.success(`Synced ${data?.stats?.cdrs ?? 0} CDR rows (${data?.stats?.pages ?? 0} pages).`);
      await loadPage(0, true);
    } catch (e: any) {
      toast.error('Sync failed: ' + (e?.message || 'unknown'));
    } finally {
      setSyncing(false);
    }
  };

  const fetchRecording = async (r: Rec): Promise<string | null> => {
    if (urls[r.id]) return urls[r.id];
    if (!r.pbx_uuid && !(r.recording_path && r.recording_name)) {
      toast.error('Missing recording metadata');
      return null;
    }
    setLoadingRow(r.id);
    try {
      const url = await loadPbxRecordingAudio(r, LEMTEL_ORG_ID);
      setUrls(s => ({ ...s, [r.id]: url }));
      return url;
    } catch (e: any) {
      toast.error('Could not load recording: ' + (e?.message || 'unknown'));
      return null;
    } finally {
      setLoadingRow(null);
    }
  };

  const filtered = rows.filter(r =>
    !q || `${r.caller_name ?? ''} ${r.caller_number ?? ''} ${r.destination_number ?? ''} ${r.destination ?? ''} ${r.extension ?? ''}`
      .toLowerCase().includes(q.toLowerCase())
  );

  const fmtDur = (s: number | null) => {
    const n = s ?? 0;
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), sec = n % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{scope === 'mine' ? 'My Recordings' : 'Call Recordings'}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Input placeholder="Search caller, number, extension…" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
          {scope === 'org' && (
            <Button variant="outline" size="sm" disabled={syncing} onClick={syncFromPbx}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from PBX'}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {filtered.length} shown {total !== null ? `· ${total} total` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              No recordings yet. Click "Sync from PBX" to pull historical data.
            </p>
          )}
          {filtered.map(r => (
            <div key={r.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm min-w-0">
                  <div className="font-medium truncate">
                    {r.caller_name ? `${r.caller_name} · ` : ''}{r.caller_number ?? '—'} → {r.destination_number ?? r.destination ?? '—'}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Ext {r.extension ?? '—'} · {fmtDur(r.duration_seconds)} · {format(new Date(r.start_at), 'dd MMM yyyy hh:mm:ss a')} · {r.direction ?? '—'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{r.recording_name?.split('.').pop() ?? 'wav'}</Badge>
                  <Button size="sm" variant="outline" disabled={loadingRow === r.id} onClick={async () => {
                    const u = await fetchRecording(r);
                    if (u) setExpandedId(expandedId === r.id ? null : r.id);
                  }}>{loadingRow === r.id ? 'Loading…' : expandedId === r.id ? 'Hide' : 'Play'}</Button>
                  {urls[r.id] && (
                    <Button size="icon" variant="outline" asChild>
                      <a href={urls[r.id]} download={r.recording_name ?? `${r.id}.wav`}><Download className="h-4 w-4" /></a>
                    </Button>
                  )}
                </div>
              </div>
              {expandedId === r.id && urls[r.id] && <RecordingWavePlayer url={urls[r.id]} />}
            </div>
          ))}
          {hasMore && !q && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost" disabled={loading} onClick={() => loadPage(page + 1, false)}>
                <ChevronDown className="h-4 w-4 mr-2" />
                {loading ? 'Loading…' : `Load more (${PAGE_SIZE})`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
