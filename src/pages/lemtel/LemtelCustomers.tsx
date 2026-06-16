import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Building2, Loader2, Globe, RefreshCw, ChevronRight, Pencil, Trash2, LogIn, Link2 } from 'lucide-react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LEMTEL_ORG } from '@/hooks/usePbxData';

const BASE_DOMAIN = 'lemtel.tel';
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

type Domain = {
  domain_uuid: string;
  domain_name: string;
  domain_description?: string;
  domain_enabled?: string | boolean;
};

type Ext = {
  extension: string;
  effective_cid_name: string | null;
  effective_cid_number: string | null;
  enabled: boolean | null;
  description: string | null;
  domain_uuid: string | null;
};

export default function LemtelCustomers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '' });
  const [domainTouched, setDomainTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 1) FusionPBX domains (live, via proxy)
  const { data: domains = [], isLoading: loadingDomains, refetch: refetchDomains } = useQuery({
    queryKey: ['fusionpbx', 'list-domains'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'list-domains' },
      });
      if (error) throw error;
      const arr = (data?.domains || data?.data?.domains || data?.data || []) as Domain[];
      return Array.isArray(arr) ? arr : [];
    },
  });

  // 2) Local extension cache (for counts + expand)
  const { data: extensions = [] } = useQuery({
    queryKey: ['pbx_extensions', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pbx_extensions')
        .select('extension,effective_cid_name,effective_cid_number,enabled,description,domain_uuid')
        .order('extension');
      if (error) throw error;
      return (data || []) as Ext[];
    },
  });

  // 3) Org map (link domain -> tenant)
  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations', 'fpbx-map'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_org_pbx_mapping');
      if (error) throw error;
      return data || [];
    },
  });

  const orgByDomain = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const o of orgs as any[]) {
      if (o.fusionpbx_domain_uuid) m.set(o.fusionpbx_domain_uuid, { id: o.id, name: o.name });
    }
    return m;
  }, [orgs]);

  const extsByDomain = useMemo(() => {
    const m = new Map<string, Ext[]>();
    for (const e of extensions) {
      const k = e.domain_uuid || '';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [extensions]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (domains as Domain[]).filter(d =>
      (d.domain_name || '').toLowerCase().includes(s) ||
      (d.domain_description || '').toLowerCase().includes(s) ||
      (orgByDomain.get(d.domain_uuid)?.name || '').toLowerCase().includes(s)
    );
  }, [domains, search, orgByDomain]);

  const onNameChange = (name: string) => {
    setForm(f => ({
      ...f,
      name,
      domain: domainTouched ? f.domain : (slugify(name) ? `${slugify(name)}.${BASE_DOMAIN}` : ''),
    }));
  };

  const handleCreate = async () => {
    if (!form.name || !form.domain) return toast.error('Name and domain required');
    setSaving(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke('pbx-write', {
        body: {
          organizationId: LEMTEL_ORG,
          action: 'create-domain',
          params: { domain_name: form.domain, domain_enabled: true, domain_description: `Customer: ${form.name}` },
        },
      });
      if (fnErr || (res as any)?.error) throw new Error((fnErr as any)?.message || (res as any)?.error || 'create-domain failed');
      toast.success(`Domain ${form.domain} created on FusionPBX`);
      setForm({ name: '', domain: '' });
      setDomainTouched(false);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['fusionpbx', 'list-domains'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create domain');
    } finally { setSaving(false); }
  };

  const toggleExpand = (uuid: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(uuid) ? n.delete(uuid) : n.add(uuid);
      return n;
    });
  };

  const syncDomain = async (d: Domain) => {
    setSyncing(d.domain_uuid);
    try {
      const org = orgByDomain.get(d.domain_uuid);
      await supabase.functions.invoke('fusionpbx-proxy', {
        body: {
          action: 'sync-all',
          resources: ['extensions', 'queues', 'ivrs', 'ring_groups'],
          organization_id: org?.id || LEMTEL_ORG,
          domain_uuid: d.domain_uuid,
        },
      });
      toast.success(`Synced ${d.domain_name}`);
      qc.invalidateQueries({ queryKey: ['pbx_extensions', 'all'] });
    } catch (e: any) {
      toast.error('Sync failed: ' + (e?.message || 'unknown'));
    } finally { setSyncing(null); }
  };

  const openEdit = (d: Domain) => {
    setEditDomain(d);
    setEditDesc(d.domain_description || '');
    setEditEnabled(d.domain_enabled === true || d.domain_enabled === 'true');
  };

  const saveEdit = async () => {
    if (!editDomain) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.functions.invoke('pbx-write', {
        body: {
          organizationId: LEMTEL_ORG,
          action: 'update-domain',
          params: {
            domain_uuid: editDomain.domain_uuid,
            domain_description: editDesc,
            domain_enabled: editEnabled,
          },
        },
      });
      if (error) throw error;
      toast.success('Domain updated');
      setEditDomain(null);
      qc.invalidateQueries({ queryKey: ['fusionpbx', 'list-domains'] });
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally { setEditSaving(false); }
  };

  const deleteDomain = async (d: Domain) => {
    if (!confirm(`Delete domain ${d.domain_name}? This removes all extensions on the PBX.`)) return;
    setDeleting(d.domain_uuid);
    try {
      const { error } = await supabase.functions.invoke('pbx-write', {
        body: {
          organizationId: LEMTEL_ORG,
          action: 'delete-domain',
          params: { domain_uuid: d.domain_uuid },
        },
      });
      if (error) throw error;
      toast.success(`Deleted ${d.domain_name}`);
      qc.invalidateQueries({ queryKey: ['fusionpbx', 'list-domains'] });
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally { setDeleting(null); }
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="w-7 h-7" /> Customers</h1>
          <p className="text-muted-foreground">Every FusionPBX domain on this server — each is a tenant with its own extensions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchDomains()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Customer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Customer (provisions FusionPBX domain)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Business Name</Label><Input value={form.name} onChange={e => onNameChange(e.target.value)} /></div>
                <div>
                  <Label className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> SIP Domain</Label>
                  <Input
                    value={form.domain}
                    placeholder={`customer.${BASE_DOMAIN}`}
                    onChange={e => { setDomainTouched(true); setForm({ ...form, domain: e.target.value.trim().toLowerCase() }); }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create on PBX
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>{filtered.length} domain{filtered.length === 1 ? '' : 's'}</CardTitle>
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search domains, tenants…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDomains ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>PBX Domain</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Extensions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No PBX domains returned. Check FusionPBX credentials.</TableCell></TableRow>
                ) : filtered.map((d) => {
                  const org = orgByDomain.get(d.domain_uuid);
                  const exts = extsByDomain.get(d.domain_uuid) || [];
                  
                  const enabled = d.domain_enabled === true || d.domain_enabled === 'true';
                  return (
                    <TableRow
                      key={d.domain_uuid}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => (window.location.href = `/org/lemtel/admin/customers/${d.domain_uuid}`)}
                    >
                      <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-muted-foreground" />{d.domain_name}</div>
                        {d.domain_description && <div className="text-xs text-muted-foreground mt-0.5">{d.domain_description}</div>}
                      </TableCell>
                      <TableCell>
                        {org ? <span className="font-medium">{org.name}</span> : <span className="text-xs text-muted-foreground">— not linked —</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{exts.length}</TableCell>
                      <TableCell>
                        <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="sm"
                          onClick={(e) => { e.stopPropagation(); syncDomain(d); }}
                          disabled={syncing === d.domain_uuid}
                        >
                          {syncing === d.domain_uuid ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                          Sync
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(d); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={(e) => { e.stopPropagation(); deleteDomain(d); }}
                          disabled={deleting === d.domain_uuid}
                        >
                          {deleting === d.domain_uuid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-destructive" />}
                        </Button>
                        <Button asChild variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                          <Link to={`/org/lemtel/admin/customers/${d.domain_uuid}`}>Manage</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editDomain} onOpenChange={(o) => !o && setEditDomain(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editDomain?.domain_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDomain(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
