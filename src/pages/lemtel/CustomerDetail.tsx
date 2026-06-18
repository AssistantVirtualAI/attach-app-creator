import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Globe, Loader2, RefreshCw, LogIn, Link2, Trash2, Power, Mail, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { RecordingWavePlayer } from '@/components/portal/RecordingWavePlayer';
import { formatDistanceToNow } from 'date-fns';
import { loadPbxRecordingAudio } from '@/lib/pbxRecordingAudio';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { IvrCreateDialog } from '@/components/lemtel/IvrCreateDialog';
import { RingGroupCreateDialog } from '@/components/lemtel/RingGroupCreateDialog';
import { QueueCreateDialog } from '@/components/lemtel/QueueCreateDialog';
import { PhoneNumbersTab } from '@/components/lemtel/PhoneNumbersTab';
import { IvrOptionsDialog } from '@/components/lemtel/IvrOptionsDialog';
import { ExtensionsPanel, type LiveState } from '@/components/lemtel/ExtensionsPanel';
import { LEMTEL_ORG_ID } from '@/hooks/useLemtelAccess';

async function pbxList(action: string, domain_uuid: string) {
  const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
    body: { action, domain_uuid },
  });
  if (error) throw error;
  return data?.data || data?.[Object.keys(data || {})[0]] || [];
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function CustomerDetail() {
  const { domainUuid = '' } = useParams();
  const qc = useQueryClient();
  const impersonation = useImpersonation();
  const [tab, setTab] = useState('extensions');
  const [recUrls, setRecUrls] = useState<Record<string, string>>({});
  const [recLoading, setRecLoading] = useState<string | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const [ivrOpen, setIvrOpen] = useState(false);
  const [manageIvr, setManageIvr] = useState<any | null>(null);
  const [rgOpen, setRgOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'org_admin' | 'manager'>('org_admin');

  const { data: domain } = useQuery({
    queryKey: ['fpbx', 'domain', domainUuid],
    queryFn: async () => {
      const list = await pbxList('list-domains', domainUuid);
      return (list as any[]).find(d => d.domain_uuid === domainUuid) || null;
    },
  });

  const { data: org, refetch: refetchOrg } = useQuery({
    queryKey: ['org', 'by-domain', domainUuid],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('get_org_by_fusionpbx_domain', { _domain_uuid: domainUuid });
      return Array.isArray(data) ? data[0] : data;
    },
  });

  const orgId = org?.id || LEMTEL_ORG_ID;

  // Live PBX data per tab
  const { data: extensions = [], refetch: refetchExt, isLoading: loadingExt } = useQuery({
    queryKey: ['fpbx', 'extensions', domainUuid],
    queryFn: () => pbxList('list-extensions', domainUuid),
    enabled: !!domain,
  });
  const liveExtState: LiveState = { exts: (extensions as any[]) || [] };

  const { data: ivrs = [], refetch: refetchIvrs } = useQuery({
    queryKey: ['fpbx', 'ivrs', domainUuid],
    queryFn: () => pbxList('list-ivrs', domainUuid),
    enabled: tab === 'ivr' && !!domain,
  });
  const { data: queues = [], refetch: refetchQueues } = useQuery({
    queryKey: ['fpbx', 'queues', domainUuid],
    queryFn: () => pbxList('list-queues', domainUuid),
    enabled: (tab === 'queues' || tab === 'ivr' || tab === 'numbers') && !!domain,
  });
  const { data: ringGroups = [], refetch: refetchRG } = useQuery({
    queryKey: ['fpbx', 'rg', domainUuid],
    queryFn: () => pbxList('list-ring-groups', domainUuid),
    enabled: (tab === 'ringgroups' || tab === 'ivr' || tab === 'numbers') && !!domain,
  });
  const { data: devices = [], refetch: refetchDevices } = useQuery({
    queryKey: ['fpbx', 'devices', domainUuid],
    queryFn: () => pbxList('list-devices', domainUuid),
    enabled: tab === 'devices' && !!domain,
  });
  const { data: destinations = [], refetch: refetchDest } = useQuery({
    queryKey: ['fpbx', 'destinations', domainUuid],
    queryFn: () => pbxList('list-destinations', domainUuid),
    enabled: tab === 'destinations' && !!domain,
  });
  const { data: moh = [] } = useQuery({
    queryKey: ['fpbx', 'moh', domainUuid],
    queryFn: () => pbxList('list-moh', domainUuid),
    enabled: tab === 'moh' && !!domain,
  });

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

  const { data: callHistory = [] } = useQuery({
    queryKey: ['cdr', 'history', domainUuid],
    queryFn: async () => {
      const { data } = await (supabase as any).from('pbx_call_records')
        .select('id,start_at,duration_seconds,caller_number,destination_number,extension,hangup_cause,direction')
        .eq('domain_uuid', domainUuid)
        .order('start_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: tab === 'history',
  });

  // Full sync from PBX
  const syncAll = async () => {
    setSyncing(true);
    toast.loading('Syncing all resources from PBX…', { id: 'sync' });
    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: {
          action: 'sync-all',
          resources: ['extensions', 'devices', 'ivrs', 'queues', 'ring_groups', 'gateways', 'destinations', 'users', 'cdrs'],
          organization_id: orgId,
          domain_uuid: domainUuid,
        },
      });
      if (error) throw error;
      // Best-effort additional syncs
      await Promise.allSettled([
        supabase.functions.invoke('fusionpbx-proxy', { body: { action: 'sync-ivr-options', organization_id: orgId, domain_uuid: domainUuid } }),
        supabase.functions.invoke('fusionpbx-proxy', { body: { action: 'sync-voicemail-messages', organization_id: orgId, domain_uuid: domainUuid } }),
      ]);
      const stats = (data as any)?.stats || {};
      const parts = Object.entries(stats).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${v} ${k}`);
      toast.success(parts.length ? `Synced: ${parts.join(', ')}` : 'Sync complete', { id: 'sync' });
      qc.invalidateQueries({ queryKey: ['fpbx'] });
      qc.invalidateQueries({ queryKey: ['cdr'] });
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed', { id: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  const impersonate = async () => {
    if (!domain || !org) { toast.error('No tenant org linked'); return; }
    sessionStorage.setItem('lemtel.activeDomain', JSON.stringify({ uuid: domainUuid, name: domain.domain_name, org_id: org.id }));
    await impersonation.enter(org.id, org.name);
    toast.success(`Now managing ${domain.domain_name}`);
    window.location.href = org.slug ? `/domain/${org.slug}/admin/dashboard` : '/console';
  };

  const linkTenantOrg = async () => {
    if (!domain || !linkName) { toast.error('Name required'); return; }
    setLinking(true);
    try {
      const { error } = await (supabase as any).rpc('setup_customer_organization', {
        _name: linkName,
        _slug: slugify(linkName),
        _domain_uuid: domainUuid,
        _domain_name: domain.domain_name,
        _admin_email: linkEmail || null,
      });
      if (error) throw error;
      toast.success('Tenant organization linked');
      setLinkOpen(false);
      refetchOrg();
    } catch (e: any) {
      toast.error(e?.message || 'Link failed');
    } finally {
      setLinking(false);
    }
  };

  const copyPortalLink = () => {
    if (!domain) return;
    const url = `${window.location.origin}/c/${encodeURIComponent(domain.domain_name)}`;
    navigator.clipboard.writeText(url);
    toast.success('Portal link copied');
  };

  const handleInvite = async () => {
    if (!org || !inviteEmail) { toast.error('Email + linked tenant required'); return; }
    const { error } = await supabase.functions.invoke('customer-invite-admin', {
      body: { organizationId: org.id, email: inviteEmail, role: inviteRole },
    });
    if (error) return toast.error(error.message);
    toast.success(`Invite sent · ${inviteRole}`);
    setInviteOpen(false);
    setInviteEmail('');
  };

  // Generic per-row PBX write
  const pbxWrite = async (action: string, params: any, label: string) => {
    try {
      const { error } = await supabase.functions.invoke('pbx-write', {
        body: { organizationId: orgId, action, params: { domain_uuid: domainUuid, ...params } },
      });
      if (error) throw error;
      toast.success(label);
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
      return false;
    }
  };

  const fetchRecording = async (r: any) => {
    if (recUrls[r.id]) return recUrls[r.id];
    if (!r.pbx_uuid && !(r.recording_path && r.recording_name)) { toast.error('Missing recording metadata'); return; }
    setRecLoading(r.id);
    try {
      const url = await loadPbxRecordingAudio(r, orgId);
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
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
            {org ? (
              <Badge variant="default" className="text-[10px]">Linked · {org.name}</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300">No tenant org — click Link tenant</Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyPortalLink}><Link2 className="w-4 h-4 mr-2" /> Portal link</Button>
          <Button variant="outline" size="sm" onClick={syncAll} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Full sync from PBX
          </Button>
          {org ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}><Mail className="w-4 h-4 mr-2" /> Invite admin</Button>
              <Button size="sm" onClick={impersonate}><LogIn className="w-4 h-4 mr-2" /> Manage as this tenant</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => { setLinkName(domain?.domain_description || (domain?.domain_name || '').split('.')[0] || ''); setLinkOpen(true); }}>
              <LinkIcon className="w-4 h-4 mr-2" /> Link tenant org
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="extensions">Extensions ({(extensions as any[]).length})</TabsTrigger>
          <TabsTrigger value="ivr">IVR ({(ivrs as any[]).length})</TabsTrigger>
          <TabsTrigger value="queues">Queues ({(queues as any[]).length})</TabsTrigger>
          <TabsTrigger value="ringgroups">Ring Groups ({(ringGroups as any[]).length})</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="destinations">Destinations</TabsTrigger>
          <TabsTrigger value="numbers">Phone Numbers</TabsTrigger>
          <TabsTrigger value="history">Call History</TabsTrigger>
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="moh">Music on Hold</TabsTrigger>
        </TabsList>

        <TabsContent value="extensions">
          <Card><CardContent className="p-4">
            <ExtensionsPanel
              domainUuid={domainUuid}
              domainName={domain?.domain_name || ''}
              organizationId={orgId}
              live={liveExtState}
              loading={loadingExt}
              onChanged={() => refetchExt()}
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ivr" className="space-y-2">
          <div className="flex justify-end"><Button size="sm" onClick={() => setIvrOpen(true)}>+ New IVR</Button></div>
          <Card><CardContent className="p-0">
            {(!ivrs || (ivrs as any[]).length === 0) ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No IVR menus.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Extension</TableHead><TableHead>Enabled</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(ivrs as any[]).map((r: any) => {
                    const en = String(r.ivr_menu_enabled) === 'true';
                    return (
                      <TableRow key={r.ivr_menu_uuid}>
                        <TableCell>{r.ivr_menu_name}</TableCell>
                        <TableCell className="font-mono">{r.ivr_menu_extension}</TableCell>
                        <TableCell><Badge variant={en ? 'default' : 'secondary'}>{en ? 'on' : 'off'}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setManageIvr(r)}>Options</Button>
                          <Button size="sm" variant="ghost" title={en ? 'Disable' : 'Enable'}
                            onClick={async () => { if (await pbxWrite('update-ivr', { ivr_menu_uuid: r.ivr_menu_uuid, ivr_menu_enabled: en ? 'false' : 'true' }, 'IVR updated')) refetchIvrs(); }}>
                            <Power className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Delete"
                            onClick={async () => { if (confirm(`Delete IVR ${r.ivr_menu_name}?`) && await pbxWrite('delete-ivr', { ivr_menu_uuid: r.ivr_menu_uuid }, 'IVR deleted')) refetchIvrs(); }}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-2">
          <div className="flex justify-end"><Button size="sm" onClick={() => setQueueOpen(true)}>+ New Queue</Button></div>
          <EditableList
            rows={queues as any[]}
            idKey="queue_uuid"
            fields={['queue_name', 'queue_extension', 'queue_strategy']}
            enabledKey="queue_enabled"
            onToggle={async (r, en) => { if (await pbxWrite('update-queue', { queue_uuid: r.queue_uuid, queue_enabled: en ? 'true' : 'false' }, 'Queue updated')) refetchQueues(); }}
            onDelete={async (r) => { if (confirm(`Delete queue ${r.queue_name}?`) && await pbxWrite('delete-queue', { queue_uuid: r.queue_uuid }, 'Queue deleted')) refetchQueues(); }}
          />
        </TabsContent>

        <TabsContent value="ringgroups" className="space-y-2">
          <div className="flex justify-end"><Button size="sm" onClick={() => setRgOpen(true)}>+ New Ring Group</Button></div>
          <EditableList
            rows={ringGroups as any[]}
            idKey="ring_group_uuid"
            fields={['ring_group_name', 'ring_group_extension']}
            enabledKey="ring_group_enabled"
            onToggle={async (r, en) => { if (await pbxWrite('update-ring-group', { ring_group_uuid: r.ring_group_uuid, ring_group_enabled: en ? 'true' : 'false' }, 'Ring group updated')) refetchRG(); }}
            onDelete={async (r) => { if (confirm(`Delete ring group ${r.ring_group_name}?`) && await pbxWrite('delete-ring-group', { ring_group_uuid: r.ring_group_uuid }, 'Ring group deleted')) refetchRG(); }}
          />
        </TabsContent>

        <TabsContent value="devices">
          <EditableList
            rows={devices as any[]}
            idKey="device_uuid"
            fields={['device_mac_address', 'device_template', 'device_label']}
            enabledKey="device_enabled"
            onToggle={async (r, en) => { if (await pbxWrite('update-device', { device_uuid: r.device_uuid, device_enabled: en ? 'true' : 'false' }, 'Device updated')) refetchDevices(); }}
            onDelete={async (r) => { if (confirm(`Delete device ${r.device_mac_address || r.device_uuid}?`) && await pbxWrite('delete-device', { device_uuid: r.device_uuid }, 'Device deleted')) refetchDevices(); }}
          />
        </TabsContent>

        <TabsContent value="destinations">
          <EditableList
            rows={destinations as any[]}
            idKey="destination_uuid"
            fields={['destination_number', 'destination_context', 'destination_actions']}
            enabledKey="destination_enabled"
            onToggle={async (r, en) => { if (await pbxWrite('update-destination', { destination_uuid: r.destination_uuid, destination_enabled: en ? 'true' : 'false' }, 'Destination updated')) refetchDest(); }}
            onDelete={async (r) => { if (confirm(`Delete destination ${r.destination_number}?`) && await pbxWrite('delete-destination', { destination_uuid: r.destination_uuid }, 'Destination deleted')) refetchDest(); }}
          />
        </TabsContent>

        <TabsContent value="numbers">
          <PhoneNumbersTab domainUuid={domainUuid} domainName={domain?.domain_name || ''} organizationId={org?.id}
            extensions={extensions as any[]} ivrs={ivrs as any[]} ringGroups={ringGroups as any[]} />
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="p-0">
            {callHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No call history. Run Full sync to pull CDRs.</div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>When</TableHead><TableHead>Dir</TableHead><TableHead>From</TableHead><TableHead>To</TableHead>
                  <TableHead>Ext</TableHead><TableHead className="text-right">Sec</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {callHistory.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{formatDistanceToNow(new Date(c.start_at), { addSuffix: true })}</TableCell>
                      <TableCell className="text-xs">{c.direction || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{c.caller_number || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{c.destination_number || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{c.extension || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{Math.round(c.duration_seconds ?? 0)}</TableCell>
                      <TableCell className="text-xs">{c.hangup_cause || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
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

        <TabsContent value="moh">
          <ReadOnlyList rows={moh as any[]} fields={['music_on_hold_name', 'music_on_hold_rate', 'music_on_hold_enabled']} />
        </TabsContent>
      </Tabs>

      {domain && (
        <>
          <IvrCreateDialog open={ivrOpen} onOpenChange={setIvrOpen}
            domainUuid={domainUuid} domainName={domain.domain_name}
            extensions={extensions as any[]} ringGroups={ringGroups as any[]} queues={queues as any[]}
            onCreated={() => qc.invalidateQueries({ queryKey: ['fpbx', 'ivrs', domainUuid] })} />
          <RingGroupCreateDialog open={rgOpen} onOpenChange={setRgOpen}
            domainUuid={domainUuid} domainName={domain.domain_name}
            extensions={extensions as any[]}
            onCreated={() => qc.invalidateQueries({ queryKey: ['fpbx', 'rg', domainUuid] })} />
          <QueueCreateDialog open={queueOpen} onOpenChange={setQueueOpen}
            domainUuid={domainUuid} extensions={extensions as any[]}
            onCreated={() => qc.invalidateQueries({ queryKey: ['fpbx', 'queues', domainUuid] })} />
          <IvrOptionsDialog open={!!manageIvr} onOpenChange={(o) => !o && setManageIvr(null)}
            ivr={manageIvr} domainUuid={domainUuid} domainName={domain.domain_name}
            extensions={extensions as any[]} ringGroups={ringGroups as any[]} queues={queues as any[]} />
        </>
      )}

      {/* Link tenant org dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link tenant organization</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Organization name</Label><Input value={linkName} onChange={e => setLinkName(e.target.value)} /></div>
            <div><Label>Admin email (optional)</Label><Input type="email" value={linkEmail} onChange={e => setLinkEmail(e.target.value.toLowerCase())} /></div>
            <p className="text-xs text-muted-foreground">Creates a tenant organization linked to PBX domain <code>{domain?.domain_name}</code>. After linking, "Manage as this tenant" becomes active.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={linkTenantOrg} disabled={linking}>
              {linking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite admin dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite admin for {org?.name || 'tenant'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value.toLowerCase())} /></div>
            <div>
              <Label>Role</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button type="button" variant={inviteRole === 'org_admin' ? 'default' : 'outline'} size="sm" onClick={() => setInviteRole('org_admin')}>org_admin</Button>
                <Button type="button" variant={inviteRole === 'manager' ? 'default' : 'outline'} size="sm" onClick={() => setInviteRole('manager')}>manager</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Close</Button>
            <Button onClick={handleInvite}>Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditableList({
  rows, idKey, fields, enabledKey, onToggle, onDelete,
}: {
  rows: any[]; idKey: string; fields: string[]; enabledKey: string;
  onToggle: (row: any, enabled: boolean) => Promise<void>;
  onDelete: (row: any) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!rows || rows.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Empty — try Full sync from PBX.</CardContent></Card>;
  }
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          {fields.map(f => <TableHead key={f}>{f.replace(/_/g, ' ')}</TableHead>)}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => {
            const id = r[idKey];
            const en = String(r[enabledKey]) === 'true' || r[enabledKey] === true;
            const isBusy = busy === id;
            return (
              <TableRow key={id}>
                {fields.map(f => <TableCell key={f} className="font-mono text-xs">{String(r[f] ?? '—').slice(0, 80)}</TableCell>)}
                <TableCell><Badge variant={en ? 'default' : 'secondary'} className="text-[10px]">{en ? 'on' : 'off'}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" title={en ? 'Disable' : 'Enable'} disabled={isBusy}
                    onClick={async () => { setBusy(id); try { await onToggle(r, !en); } finally { setBusy(null); } }}>
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" title="Delete" disabled={isBusy}
                    onClick={async () => { setBusy(id); try { await onDelete(r); } finally { setBusy(null); } }}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function ReadOnlyList({ rows, fields }: { rows: any[]; fields: string[] }) {
  if (!rows || rows.length === 0) return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Empty — try Full sync from PBX.</CardContent></Card>;
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
