import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Globe, Loader2, RefreshCw, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { RecordingWavePlayer } from '@/components/portal/RecordingWavePlayer';
import { formatDistanceToNow } from 'date-fns';
import { loadPbxRecordingAudio } from '@/lib/pbxRecordingAudio';

async function pbxList(action: string, domain_uuid: string) {
  const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
    body: { action, domain_uuid },
  });
  if (error) throw error;
  return data?.data || data?.[Object.keys(data || {})[0]] || [];
}

export default function CustomerDetail() {
  const { domainUuid = '' } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState('users');
  const [recUrls, setRecUrls] = useState<Record<string, string>>({});
  const [recLoading, setRecLoading] = useState<string | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  // Domain info + tenant org
  const { data: domain } = useQuery({
    queryKey: ['fpbx', 'domain', domainUuid],
    queryFn: async () => {
      const list = await pbxList('list-domains', domainUuid);
      return (list as any[]).find(d => d.domain_uuid === domainUuid) || null;
    },
  });

  const { data: org } = useQuery({
    queryKey: ['org', 'by-domain', domainUuid],
    queryFn: async () => {
      const { data } = await supabase.from('organizations')
        .select('id,name').eq('fusionpbx_domain_uuid', domainUuid).maybeSingle();
      return data;
    },
  });

  // Softphone users (DB-backed for app-access toggle)
  const { data: spUsers = [], refetch: refetchSP } = useQuery({
    queryKey: ['softphone_users', domainUuid, domain?.domain_name],
    enabled: !!domain,
    queryFn: async () => {
      const { data } = await (supabase as any).from('pbx_softphone_users')
        .select('id,extension,display_name,sip_domain,status,app_access_enabled,portal_user_id,account_status')
        .ilike('sip_domain', `%${domain.domain_name}%`)
        .order('extension');
      return data || [];
    },
  });

  // Extensions (live FusionPBX)
  const { data: extensions = [], isLoading: loadingExt } = useQuery({
    queryKey: ['fpbx', 'extensions', domainUuid],
    queryFn: () => pbxList('list-extensions', domainUuid),
    enabled: tab === 'extensions',
  });
  const { data: ivrs = [] } = useQuery({
    queryKey: ['fpbx', 'ivrs', domainUuid],
    queryFn: () => pbxList('list-ivrs', domainUuid),
    enabled: tab === 'ivr',
  });
  const { data: queues = [] } = useQuery({
    queryKey: ['fpbx', 'queues', domainUuid],
    queryFn: () => pbxList('list-queues', domainUuid),
    enabled: tab === 'queues',
  });
  const { data: ringGroups = [] } = useQuery({
    queryKey: ['fpbx', 'rg', domainUuid],
    queryFn: () => pbxList('list-ring-groups', domainUuid),
    enabled: tab === 'ringgroups',
  });
  const { data: moh = [] } = useQuery({
    queryKey: ['fpbx', 'moh', domainUuid],
    queryFn: () => pbxList('list-moh', domainUuid),
    enabled: tab === 'moh',
  });

  // Recordings: CDRs with has_recording for this domain
  const { data: recordings = [] } = useQuery({
    queryKey: ['cdr', 'recordings', domainUuid],
    queryFn: async () => {
      const { data } = await (supabase as any).from('pbx_call_records')
        .select('id,start_at,duration_seconds,caller_number,destination_number,extension,recording_path,recording_name,pbx_uuid,domain_uuid,domain_name')
        .eq('domain_uuid', domainUuid)
        .eq('has_recording', true)
        .order('start_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: tab === 'recordings',
  });

  const toggleAppAccess = async (id: string, enabled: boolean) => {
    const { error } = await (supabase as any).rpc('set_softphone_app_access', { _softphone_id: id, _enabled: enabled });
    if (error) return toast.error(error.message);
    toast.success(enabled ? 'App access enabled' : 'App access revoked');
    refetchSP();
  };

  const syncAll = async () => {
    toast.loading('Syncing…', { id: 'sync' });
    const { error } = await supabase.functions.invoke('fusionpbx-proxy', {
      body: { action: 'sync-all', resources: ['extensions', 'queues', 'ivrs', 'ring_groups'], organization_id: org?.id || '71755d33-ed64-4ad5-a828-61c9d2029eb7', domain_uuid: domainUuid },
    });
    toast.dismiss('sync');
    if (error) return toast.error(error.message);
    toast.success('Sync complete');
    qc.invalidateQueries({ queryKey: ['fpbx'] });
  };

  const impersonate = () => {
    if (!domain) return;
    sessionStorage.setItem('lemtel.activeDomain', JSON.stringify({ uuid: domainUuid, name: domain.domain_name, org_id: org?.id }));
    toast.success(`Now managing ${domain.domain_name}`);
    window.location.href = '/org/lemtel/admin/dashboard';
  };

  const fetchRecording = async (r: any) => {
    if (recUrls[r.id]) return recUrls[r.id];
    if (!r.pbx_uuid && !(r.recording_path && r.recording_name)) {
      toast.error('Missing recording metadata');
      return;
    }
    setRecLoading(r.id);
    try {
      const url = await loadPbxRecordingAudio(r, org?.id || '71755d33-ed64-4ad5-a828-61c9d2029eb7');
      setRecUrls(s => ({ ...s, [r.id]: url }));
      return url;
    } catch (e: any) {
      toast.error('Recording load failed: ' + (e?.message || ''));
    } finally { setRecLoading(null); }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/org/lemtel/admin/customers" className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> All customers
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6" /> {domain?.domain_name || domainUuid}
          </h1>
          <p className="text-sm text-muted-foreground">
            {org ? <>Tenant: <strong>{org.name}</strong></> : 'Not linked to a tenant'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncAll}><RefreshCw className="w-4 h-4 mr-2" /> Sync</Button>
          <Button onClick={impersonate}><LogIn className="w-4 h-4 mr-2" /> Manage as this tenant</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="users">Users ({spUsers.length})</TabsTrigger>
          <TabsTrigger value="extensions">Extensions</TabsTrigger>
          <TabsTrigger value="ivr">IVR</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="ringgroups">Ring Groups</TabsTrigger>
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="moh">Music on Hold</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ext</TableHead><TableHead>Name</TableHead><TableHead>SIP Domain</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">App Access</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {spUsers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No users. Run Sync.</TableCell></TableRow>}
                {spUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono">{u.extension}</TableCell>
                    <TableCell>{u.display_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{u.sip_domain}</TableCell>
                    <TableCell><Badge variant={u.status === 'online' ? 'default' : 'secondary'}>{u.status || 'offline'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Switch checked={u.app_access_enabled !== false} onCheckedChange={(v) => toggleAppAccess(u.id, v)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="extensions">
          <SimpleList loading={loadingExt} rows={extensions} fields={['extension', 'effective_caller_id_name', 'enabled']} />
        </TabsContent>
        <TabsContent value="ivr">
          <SimpleList rows={ivrs} fields={['ivr_menu_name', 'ivr_menu_extension', 'ivr_menu_enabled']} />
        </TabsContent>
        <TabsContent value="queues">
          <SimpleList rows={queues} fields={['queue_name', 'queue_extension', 'queue_strategy', 'queue_enabled']} />
        </TabsContent>
        <TabsContent value="ringgroups">
          <SimpleList rows={ringGroups} fields={['ring_group_name', 'ring_group_extension', 'ring_group_enabled']} />
        </TabsContent>
        <TabsContent value="moh">
          <SimpleList rows={moh} fields={['music_on_hold_name', 'music_on_hold_rate', 'music_on_hold_enabled']} />
        </TabsContent>

        <TabsContent value="recordings">
          <Card><CardContent className="space-y-2 p-4">
            {recordings.length === 0 && <p className="text-sm text-muted-foreground">No recordings.</p>}
            {recordings.map((r: any) => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{r.caller_number ?? '—'} → {r.destination_number ?? '—'}</span>
                    <span className="text-muted-foreground ml-2">Ext {r.extension ?? '—'} · {Math.round(r.duration_seconds ?? 0)}s · {formatDistanceToNow(new Date(r.start_at), { addSuffix: true })}</span>
                  </div>
                  <Button size="sm" variant="outline" disabled={recLoading === r.id} onClick={async () => {
                    const u = await fetchRecording(r);
                    if (u) setExpandedRec(expandedRec === r.id ? null : r.id);
                  }}>{recLoading === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : expandedRec === r.id ? 'Hide' : 'Play'}</Button>
                </div>
                {expandedRec === r.id && recUrls[r.id] && <RecordingWavePlayer key={r.id} url={recUrls[r.id]} autoPlay />}
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleList({ rows, fields, loading }: { rows: any[]; fields: string[]; loading?: boolean }) {
  if (loading) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!rows || rows.length === 0) return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Empty — try syncing.</CardContent></Card>;
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>{fields.map(f => <TableHead key={f}>{f.replace(/_/g, ' ')}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.id || r.uuid || i}>
              {fields.map(f => <TableCell key={f} className="font-mono text-xs">{String(r[f] ?? '—')}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
