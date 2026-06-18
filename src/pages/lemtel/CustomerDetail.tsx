import { useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Globe, Loader2, RefreshCw, LogIn, Upload, UserPlus, Mail, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { RecordingWavePlayer } from '@/components/portal/RecordingWavePlayer';
import { formatDistanceToNow } from 'date-fns';
import { loadPbxRecordingAudio } from '@/lib/pbxRecordingAudio';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import SendAppInviteButtons from '@/components/lemtel/SendAppInviteButtons';

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
  const impersonation = useImpersonation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('users');
  const [recUrls, setRecUrls] = useState<Record<string, string>>({});
  const [recLoading, setRecLoading] = useState<string | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    extension: '', name: '', email: '',
    sip_password: '', assign_phone_number: '', send_welcome_email: true,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'org_admin' | 'manager'>('org_admin');
  const [inviteResult, setInviteResult] = useState<{ link?: string; email?: string } | null>(null);

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
      const { data } = await (supabase as any).rpc('get_org_by_fusionpbx_domain', { _domain_uuid: domainUuid });
      return Array.isArray(data) ? data[0] : data;
    },
  });

  // Softphone users (DB-backed for app-access toggle)
  const { data: spUsers = [], refetch: refetchSP } = useQuery({
    queryKey: ['softphone_users', domainUuid, domain?.domain_name],
    enabled: !!domain,
    queryFn: async () => {
      const { data } = await (supabase as any).from('pbx_softphone_users')
        .select('id,extension,display_name,sip_domain,status,app_access_enabled,desktop_access_enabled,mobile_access_enabled,portal_user_id,account_status')
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

  const togglePlatformAccess = async (id: string, platform: 'app' | 'desktop' | 'mobile', enabled: boolean) => {
    const { error } = await (supabase as any).rpc('set_softphone_platform_access', { _softphone_id: id, _platform: platform, _enabled: enabled });
    if (error) return toast.error(error.message);
    const label = platform === 'app' ? 'App' : platform === 'desktop' ? 'Desktop' : 'Mobile';
    toast.success(enabled ? `${label} access enabled` : `${label} access revoked`);
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

  const impersonate = async () => {
    if (!domain) return;
    if (!org) { toast.error('No tenant org linked'); return; }
    sessionStorage.setItem('lemtel.activeDomain', JSON.stringify({ uuid: domainUuid, name: domain.domain_name, org_id: org.id }));
    await impersonation.enter(org.id, org.name);
    toast.success(`Now managing ${domain.domain_name}`);
    window.location.href = '/console';
  };

  const copyPortalLink = () => {
    if (!domain) return;
    const url = `${window.location.origin}/c/${encodeURIComponent(domain.domain_name)}`;
    navigator.clipboard.writeText(url);
    toast.success('Portal link copied');
  };

  const parseCsv = (text: string): any[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim());
      const row: any = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ''; });
      return row;
    });
  };

  const handleCsvFile = async (f: File) => {
    if (!org || !domain) { toast.error('Tenant or domain missing'); return; }
    setImporting(true);
    setImportReport(null);
    try {
      const text = await f.text();
      const rows = parseCsv(text);
      if (!rows.length) { toast.error('CSV empty'); return; }
      const { data, error } = await supabase.functions.invoke('customer-users-import', {
        body: {
          organizationId: org.id,
          domain_uuid: domainUuid,
          domain_name: domain.domain_name,
          users: rows,
        },
      });
      if (error) throw error;
      setImportReport(data);
      toast.success(`Imported ${(data as any)?.succeeded || 0}/${(data as any)?.total || rows.length}`);
      refetchSP();
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleAddUser = async () => {
    if (!org || !domain || !addForm.extension) { toast.error('Extension required'); return; }
    const userPayload = {
      extension: addForm.extension,
      name: addForm.name || undefined,
      email: addForm.email || undefined,
      password: addForm.sip_password || undefined,
      assign_phone_number: addForm.assign_phone_number || undefined,
    };
    const { data, error } = await supabase.functions.invoke('customer-users-import', {
      body: {
        organizationId: org.id,
        domain_uuid: domainUuid,
        domain_name: domain.domain_name,
        send_welcome_email: addForm.send_welcome_email,
        users: [userPayload],
      },
    });
    if (error) return toast.error(error.message);
    const r = (data as any)?.results?.[0];
    if (r?.ok) {
      const genPass = (data as any)?.results?.[0]?.password;
      toast.success(`Extension ${addForm.extension} added`);
      if (genPass) {
        toast.message('SIP password (one-time view)', {
          description: genPass,
          action: { label: 'Copy', onClick: () => navigator.clipboard.writeText(genPass) },
        });
      }
      setAddOpen(false);
      setAddForm({ extension: '', name: '', email: '', sip_password: '', assign_phone_number: '', send_welcome_email: true });
      refetchSP();
    }
    else toast.error(r?.error || 'Add failed');
  };

  const handleInvite = async () => {
    if (!org || !inviteEmail) { toast.error('Email + linked tenant required'); return; }
    setInviteResult(null);
    const { data, error } = await supabase.functions.invoke('customer-invite-admin', {
      body: { organizationId: org.id, email: inviteEmail, role: inviteRole },
    });
    if (error) return toast.error(error.message);
    toast.success(`Invite sent · ${inviteRole} assigned to ${org.name}`);
    const link = (data as any)?.invite_url || (data as any)?.action_link;
    setInviteResult({ link, email: inviteEmail });
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyPortalLink}><Link2 className="w-4 h-4 mr-2" /> Portal link</Button>
          <Button variant="outline" size="sm" onClick={syncAll}><RefreshCw className="w-4 h-4 mr-2" /> Sync</Button>
          <Button size="sm" onClick={impersonate} disabled={!org}><LogIn className="w-4 h-4 mr-2" /> Manage as this tenant</Button>
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

        <TabsContent value="users" className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing || !org}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Import CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} disabled={!org}>
              <UserPlus className="w-4 h-4 mr-2" /> Add user
            </Button>
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} disabled={!org}>
              <Mail className="w-4 h-4 mr-2" /> Invite admin
            </Button>
            <span className="text-xs text-muted-foreground ml-2">
              CSV columns: <code>extension,name,email,password,voicemail_pin,outbound_cid</code>
            </span>
          </div>
          {importReport && (
            <Card><CardContent className="p-3 text-xs space-y-1">
              <div className="font-medium">Import: {importReport.succeeded}/{importReport.total} succeeded · {importReport.failed} failed</div>
              {importReport.results?.filter((r: any) => !r.ok).slice(0, 10).map((r: any, i: number) => (
                <div key={i} className="text-destructive">Ext {r.extension}: {r.error}</div>
              ))}
            </CardContent></Card>
          )}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ext</TableHead><TableHead>Name</TableHead><TableHead>SIP Domain</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">App</TableHead><TableHead className="text-right">Desktop</TableHead><TableHead className="text-right">Mobile</TableHead><TableHead className="text-right">Invite</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {spUsers.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No users. Run Sync.</TableCell></TableRow>}
                {spUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono">{u.extension}</TableCell>
                    <TableCell>{u.display_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{u.sip_domain}</TableCell>
                    <TableCell><Badge variant={u.status === 'online' ? 'default' : 'secondary'}>{u.status || 'offline'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Switch checked={u.app_access_enabled !== false} onCheckedChange={(v) => togglePlatformAccess(u.id, 'app', v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch checked={u.desktop_access_enabled !== false} disabled={u.app_access_enabled === false} onCheckedChange={(v) => togglePlatformAccess(u.id, 'desktop', v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch checked={u.mobile_access_enabled !== false} disabled={u.app_access_enabled === false} onCheckedChange={(v) => togglePlatformAccess(u.id, 'mobile', v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <SendAppInviteButtons portalUserId={u.portal_user_id} organizationId={org?.id} />
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add user / extension</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>Extension *</Label><Input value={addForm.extension} onChange={e => setAddForm({ ...addForm, extension: e.target.value })} placeholder="1001" /></div>
            <div><Label>Display name</Label><Input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} /></div>
            <div><Label>Email (optional — links portal user + receives welcome)</Label><Input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value.toLowerCase() })} /></div>
            <div>
              <Label>SIP password (leave blank to auto-generate)</Label>
              <Input value={addForm.sip_password} onChange={e => setAddForm({ ...addForm, sip_password: e.target.value })} placeholder="min 12 chars" />
            </div>
            <div>
              <Label>Assign phone number (optional, sets outbound CID)</Label>
              <Input value={addForm.assign_phone_number} onChange={e => setAddForm({ ...addForm, assign_phone_number: e.target.value.trim() })} placeholder="+15145551234" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addForm.send_welcome_email}
                onChange={e => setAddForm({ ...addForm, send_welcome_email: e.target.checked })}
              />
              Send welcome email with credentials (requires email)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) { setInviteResult(null); setInviteEmail(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Promote admin for {org?.name || 'tenant'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value.toLowerCase())} placeholder="admin@customer.com" />
            </div>
            <div>
              <Label>Role for this domain</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button type="button" variant={inviteRole === 'org_admin' ? 'default' : 'outline'} size="sm" onClick={() => setInviteRole('org_admin')}>
                  org_admin <span className="ml-1 text-[10px] opacity-70">(full)</span>
                </Button>
                <Button type="button" variant={inviteRole === 'manager' ? 'default' : 'outline'} size="sm" onClick={() => setInviteRole('manager')}>
                  manager <span className="ml-1 text-[10px] opacity-70">(ops only)</span>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              User is invited (or linked if registered) and granted <code>{inviteRole}</code> on this domain only. They'll see the "My Domain Cockpit" link in their sidebar.
            </p>
            {inviteResult?.link && (
              <div className="space-y-2 p-2 rounded border bg-muted/40">
                <div className="text-xs font-medium">Invite link (valid until accepted)</div>
                <div className="flex gap-2">
                  <Input readOnly value={inviteResult.link} className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteResult.link!); toast.success('Copied'); }}>Copy</Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Close</Button>
            <Button onClick={handleInvite}>{inviteResult ? 'Resend' : 'Send invite'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
