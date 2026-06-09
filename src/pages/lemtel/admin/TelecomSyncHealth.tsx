import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { GlassCard, SectionHeader, NeonButton, GlassTable, StatusChip, KpiCard, LiveBadge } from '@/components/ui-cockpit';
import { GTHead, GTRow, GTHeadCell, GTCell } from '@/components/ui-cockpit/GlassTable';
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, Loader2, PhoneCall, Voicemail, Disc, ListChecks } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

type SyncHealth = {
  source: string;
  status: string;
  last_run_at: string | null;
  last_heartbeat_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  rows_synced: number;
};

const SOURCES: { id: string; label: string; icon: any; fn: string }[] = [
  { id: 'extensions', label: 'Extensions', icon: ListChecks, fn: 'pbx-sync-extensions' },
  { id: 'cdr', label: 'Call Records', icon: PhoneCall, fn: 'pbx-sync-cdr' },
  { id: 'voicemail', label: 'Voicemail', icon: Voicemail, fn: 'pbx-sync-voicemail' },
  { id: 'recordings', label: 'Recordings', icon: Disc, fn: 'pbx-sync-recordings' },
  { id: 'live-events', label: 'Live Events', icon: Activity, fn: 'pbx-live-events' },
];

export default function TelecomSyncHealth() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();

  const { data: health = [], isLoading } = useQuery({
    queryKey: ['telecom_sync_health', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await (supabase as any)
        .from('telecom_sync_health')
        .select('*')
        .eq('organization_id', selectedOrgId);
      if (error) throw error;
      return (data || []) as SyncHealth[];
    },
    enabled: !!selectedOrgId,
    refetchInterval: 15000,
  });

  const runNow = useMutation({
    mutationFn: async (fn: string) => {
      const { error } = await supabase.functions.invoke(fn, { body: { organization_id: selectedOrgId } });
      if (error) throw error;
    },
    onSuccess: (_, fn) => { toast({ title: `Triggered ${fn}` }); setTimeout(() => qc.invalidateQueries({ queryKey: ['telecom_sync_health'] }), 2000); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Failed to trigger', description: e.message }),
  });

  const getHealth = (source: string) => health.find(h => h.source === source);
  const okCount = SOURCES.filter(s => getHealth(s.id)?.status === 'ok').length;
  const failCount = SOURCES.filter(s => (getHealth(s.id)?.consecutive_failures || 0) > 0).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Activity className="w-5 h-5" />}
        title="Telecom Sync Health"
        subtitle="Live status of FusionPBX synchronization jobs. Real-time heartbeats and per-source recovery."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Sources Healthy" value={`${okCount} / ${SOURCES.length}`} icon={<CheckCircle2 className="w-4 h-4" />} accent="cyan" />
        <KpiCard label="Failing" value={failCount} icon={<AlertTriangle className="w-4 h-4" />} accent={failCount > 0 ? 'danger' : 'success'} />
        <KpiCard label="Status" value={okCount > 0 ? 'Streaming' : 'Idle'} icon={<Activity className="w-4 h-4" />} accent="violet" live={okCount > 0} />
      </div>

      <GlassCard>
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-cockpit-cyan" /></div>
          ) : (
            <GlassTable>
              <GTHead>
                <GTRow>
                  <GTHeadCell>Source</GTHeadCell>
                  <GTHeadCell>Status</GTHeadCell>
                  <GTHeadCell>Last Run</GTHeadCell>
                  <GTHeadCell>Heartbeat</GTHeadCell>
                  <GTHeadCell className="text-right">Rows</GTHeadCell>
                  <GTHeadCell>Last Error</GTHeadCell>
                  <GTHeadCell className="text-right"></GTHeadCell>
                </GTRow>
              </GTHead>
              <tbody>
                {SOURCES.map(s => {
                  const h = getHealth(s.id);
                  const Icon = s.icon;
                  const alive = h?.last_heartbeat_at && Date.now() - new Date(h.last_heartbeat_at).getTime() < 120000;
                  return (
                    <GTRow key={s.id}>
                      <GTCell><span className="inline-flex items-center gap-2 font-medium"><Icon className="w-4 h-4 text-cockpit-cyan" />{s.label}</span></GTCell>
                      <GTCell><StatusChip tone={h?.status === 'ok' ? 'success' : h?.status === 'failed' ? 'danger' : 'idle'}>{h?.status || 'never run'}</StatusChip></GTCell>
                      <GTCell>{h?.last_run_at ? <span className="text-xs">{formatDistanceToNow(new Date(h.last_run_at), { addSuffix: true })}</span> : <span className="text-muted-foreground text-xs">—</span>}</GTCell>
                      <GTCell>{h?.last_heartbeat_at ? <span className="inline-flex items-center gap-2"><LiveBadge tone={alive ? 'success' : 'danger'} label={alive ? 'LIVE' : 'STALE'} /><span className="text-xs">{formatDistanceToNow(new Date(h.last_heartbeat_at), { addSuffix: true })}</span></span> : <span className="text-muted-foreground text-xs">—</span>}</GTCell>
                      <GTCell className="text-right font-mono text-xs">{h?.rows_synced ?? 0}</GTCell>
                      <GTCell>{h?.last_error ? <span className="text-xs text-cockpit-danger truncate block max-w-xs" title={h.last_error}>{h.last_error}</span> : <span className="text-muted-foreground text-xs">—</span>}</GTCell>
                      <GTCell className="text-right">
                        <NeonButton size="sm" variant="outline" onClick={() => runNow.mutate(s.fn)} disabled={runNow.isPending}><RefreshCw className={`w-3.5 h-3.5 ${runNow.isPending ? 'animate-spin' : ''}`} /> Run</NeonButton>
                      </GTCell>
                    </GTRow>
                  );
                })}
              </tbody>
            </GlassTable>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
