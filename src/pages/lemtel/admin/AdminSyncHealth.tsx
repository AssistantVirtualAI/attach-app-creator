import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, RefreshCw, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const ENTITIES = [
  { key: 'extensions', label: 'Extensions', action: 'sync-domains' },
  { key: 'gateways', label: 'Gateways', action: 'list-gateways-merged' },
  { key: 'ivr', label: 'IVRs', action: 'list-ivr_menus' },
  { key: 'destinations', label: 'Destinations', action: 'list-destinations' },
  { key: 'time-conditions', label: 'Time Conditions', action: 'list-time-conditions' },
  { key: 'conferences', label: 'Conferences', action: 'list-conferences' },
  { key: 'hold-music', label: 'Hold Music', action: 'list-hold-music' },
  { key: 'voicemail', label: 'Voicemail', action: 'sync-voicemail-messages' },
  { key: 'recordings', label: 'Recordings', action: 'list-recordings' },
  { key: 'cdrs', label: 'Call Records', action: 'sync-cdrs' },
];

export default function AdminSyncHealth() {
  const jobs = useQuery({
    queryKey: ['pbx-sync-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pbx_sync_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const resync = async (entity: typeof ENTITIES[number]) => {
    toast.info(`Resyncing ${entity.label}…`);
    try {
      const { error } = await supabase.functions.invoke('fusionpbx-proxy', { body: { action: entity.action } });
      if (error) throw error;
      toast.success(`${entity.label} resync started`);
      jobs.refetch();
    } catch (e: any) { toast.error(e?.message || 'Resync failed'); }
  };

  const resyncAll = async () => {
    toast.info('Running full sync…');
    try {
      const { error } = await supabase.functions.invoke('fusionpbx-proxy', { body: { action: 'sync-all' } });
      if (error) throw error;
      toast.success('Full sync triggered');
      jobs.refetch();
    } catch (e: any) { toast.error(e?.message || 'Sync failed'); }
  };

  const lastFor = (key: string) => jobs.data?.find((j: any) =>
    (j.job_type || '').toLowerCase().includes(key.replace('-', ''))
    || (j.job_type || '').toLowerCase().includes(key)
  );

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Activity className="w-7 h-7" /> Sync Health</h1>
          <p className="text-muted-foreground text-sm">Last sync per PBX entity, with per-row resync.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => jobs.refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
          <Button onClick={resyncAll}><Play className="w-4 h-4 mr-2" /> Resync all</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Entities</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENTITIES.map(e => {
                const j: any = lastFor(e.key);
                return (
                  <TableRow key={e.key}>
                    <TableCell className="font-medium">{e.label}</TableCell>
                    <TableCell>
                      <Badge variant={j?.status === 'success' ? 'default' : j?.status === 'failed' ? 'destructive' : 'secondary'}>
                        {j?.status || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {j?.completed_at ? formatDistanceToNow(new Date(j.completed_at), { addSuffix: true }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">{j?.error || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => resync(e)}><RefreshCw className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent sync jobs</CardTitle></CardHeader>
        <CardContent>
          {jobs.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead><TableHead>Status</TableHead>
                  <TableHead>Started</TableHead><TableHead>Completed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(jobs.data || []).slice(0, 25).map((j: any) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
                    <TableCell><Badge variant={j.status === 'success' ? 'default' : j.status === 'failed' ? 'destructive' : 'secondary'}>{j.status}</Badge></TableCell>
                    <TableCell className="text-xs">{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-xs">{j.completed_at ? new Date(j.completed_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">{j.error || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
