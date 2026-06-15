import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, RefreshCw, Loader2, Play, Database } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSkeletonRows } from '@/components/admin/AdminSkeletonRows';
import { StatusBadge } from '@/components/admin/StatusBadge';

const toneFor = (s?: string) => s === 'success' ? 'on' : s === 'failed' ? 'err' : s === 'running' ? 'info' : 'off';

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

  // ---- Backfill state ----
  const [backfillPages, setBackfillPages] = useState(50);
  const [backfillPageSize, setBackfillPageSize] = useState(500);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);

  const integration = useQuery({
    queryKey: ['pbx-integration-cursor'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pbx_integrations')
        .select('id, organization_id, config, last_sync_at')
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: backfillRunning ? 3000 : 30000,
  });

  const cursor = (integration.data as any)?.config?.sync_cursor ?? 0;
  const cursorAt = (integration.data as any)?.config?.sync_cursor_updated_at;

  const runBackfill = async (fromBeginning: boolean) => {
    setBackfillRunning(true);
    setBackfillResult(null);
    toast.info(fromBeginning ? 'Starting backfill from offset 0…' : 'Resuming backfill from cursor…');
    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: {
          action: 'backfill-cdrs',
          params: { page_size: backfillPageSize, max_pages: backfillPages, from_beginning: fromBeginning },
        },
      });
      if (error) throw error;
      setBackfillResult(data);
      toast.success(`Backfill complete: ${(data as any)?.stats?.cdrs ?? 0} upserted`);
      jobs.refetch();
      integration.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Backfill failed');
    } finally {
      setBackfillRunning(false);
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <AdminPageHeader
        icon={Activity}
        title="Sync Health"
        subtitle="Last sync per PBX entity, with per-row resync."
        actions={
          <>
            <Button variant="outline" onClick={() => jobs.refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
            <Button onClick={resyncAll}><Play className="w-4 h-4 mr-2" /> Resync all</Button>
          </>
        }
      />

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
                  <TableRow key={e.key} className="hover:bg-muted/40">
                    <TableCell className="font-medium">{e.label}</TableCell>
                    <TableCell><StatusBadge tone={toneFor(j?.status) as any}>{j?.status || 'unknown'}</StatusBadge></TableCell>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead><TableHead>Status</TableHead>
                <TableHead>Started</TableHead><TableHead>Completed</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.isLoading ? <AdminSkeletonRows rows={5} cols={5} /> :
                (jobs.data || []).slice(0, 25).map((j: any) => (
                  <TableRow key={j.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
                    <TableCell><StatusBadge tone={toneFor(j.status) as any}>{j.status}</StatusBadge></TableCell>
                    <TableCell className="text-xs">{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-xs">{j.completed_at ? new Date(j.completed_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">{j.error || '—'}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
