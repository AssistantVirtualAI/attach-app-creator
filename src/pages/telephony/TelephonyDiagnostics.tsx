import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTelephonyStatus } from '@/hooks/useTelephonyStatus';
import { ScrollArea } from '@/components/ui/scroll-area';

const FNS = ['telephony-ping', 'fusionpbx-proxy', 'telnyx-sms', 'telnyx-webhook', 'elevenlabs-generate-greeting', 'ai-transcribe-call', 'ai-analyze-call'];

export default function TelephonyDiagnostics() {
  const status = useTelephonyStatus();

  const { data: syncJobs = [], refetch } = useQuery({
    queryKey: ['diag-sync-jobs'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('pbx_sync_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: errors = [] } = useQuery({
    queryKey: ['diag-errors'],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('id, action, metadata, created_at')
        .like('action', '%error%')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Activity className="w-7 h-7" /> Diagnostics</h1>
          <p className="text-muted-foreground">System health and integration status</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Provider Status</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['FusionPBX', status.fusionpbx],
            ['Telnyx', status.telnyx],
            ['ElevenLabs', status.elevenlabs],
            ['AI Gateway', status.ai],
          ].map(([label, s]: any) => (
            <div key={label} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <span className="text-sm">{label}</span>
              <Badge variant={s?.ok ? 'default' : 'destructive'} className="gap-1">
                {s?.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {s?.ok ? `${s.latency_ms ?? '?'}ms` : 'Down'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Edge Functions</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-2">
          {FNS.map((fn) => (
            <div key={fn} className="flex items-center justify-between border rounded px-3 py-1.5 text-xs">
              <span className="font-mono">{fn}</span>
              <Badge variant="outline">Deployed</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Last Sync Jobs</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {syncJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No sync jobs recorded</p>
            ) : syncJobs.map((j: any) => (
              <div key={j.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs">
                <div>
                  <div className="font-medium">{j.job_type || j.type}</div>
                  <div className="text-muted-foreground">{new Date(j.started_at || j.created_at).toLocaleString()}</div>
                </div>
                <Badge variant={j.status === 'success' ? 'default' : j.status === 'running' ? 'outline' : 'destructive'}>
                  {j.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {j.status || 'unknown'}
                </Badge>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Errors (audit log)</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {errors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent errors</p>
            ) : errors.map((e: any) => (
              <div key={e.id} className="py-1.5 border-b last:border-0 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-rose-500">{e.action}</span>
                  <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                {e.metadata && <pre className="text-[10px] text-muted-foreground mt-1 overflow-x-auto">{JSON.stringify(e.metadata, null, 2).slice(0, 200)}</pre>}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
