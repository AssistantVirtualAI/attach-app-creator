import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Building2, Loader2, Globe, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePbxClients, LEMTEL_ORG } from '@/hooks/usePbxData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BASE_DOMAIN = 'lemtel.tel';

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function LemtelCustomers() {
  const { data: customers = [], isLoading } = usePbxClients();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', domain: '' });
  const [domainTouched, setDomainTouched] = useState(false);
  const [createDomain, setCreateDomain] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: domains = [] } = useQuery({
    queryKey: ['pbx', 'pbx_domains'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pbx_domains' as any)
        .select('*').eq('organization_id', LEMTEL_ORG);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const domainByClient = useMemo(() => {
    const m = new Map<string, any>();
    for (const d of domains) if (d.client_id) m.set(d.client_id, d);
    return m;
  }, [domains]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (customers as any[]).filter(c =>
      (c.name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s)
    );
  }, [customers, search]);

  const onNameChange = (name: string) => {
    setForm(f => ({
      ...f,
      name,
      domain: domainTouched ? f.domain : (slugify(name) ? `${slugify(name)}.${BASE_DOMAIN}` : ''),
    }));
  };

  const handleCreate = async () => {
    if (!form.name) return toast.error('Name required');
    if (createDomain && !form.domain) return toast.error('Domain required');
    setSaving(true);
    try {
      // 1) Create the customer
      const { data: client, error } = await supabase.from('clients').insert({
        organization_id: LEMTEL_ORG, name: form.name, email: form.email || null, status: 'active',
      }).select().single();
      if (error) throw error;

      // 2) Create the dedicated PBX domain
      if (createDomain) {
        const { error: dErr } = await supabase.from('pbx_domains' as any).insert({
          organization_id: LEMTEL_ORG,
          name: form.domain,
          description: `Customer: ${form.name}`,
          enabled: true,
          client_id: client.id,
        } as any);
        if (dErr) toast.error(`Domain saved failed: ${dErr.message}`);

        // 3) Sync domain to FusionPBX (non-fatal)
        try {
          const { data: res, error: fnErr } = await supabase.functions.invoke('pbx-write', {
            body: {
              organizationId: LEMTEL_ORG,
              clientId: client.id,
              action: 'create-domain',
              params: { domain_name: form.domain, domain_enabled: true, domain_description: `Customer: ${form.name}` },
            },
          });
          if (fnErr || (res as any)?.error) {
            toast.warning('Customer created, but PBX domain sync failed — check Sync Health.');
          } else {
            toast.success(`Domain ${form.domain} created on PBX`);
          }
        } catch {
          toast.warning('Customer created, but PBX domain sync failed.');
        }
      }

      setForm({ name: '', email: '', domain: '' });
      setDomainTouched(false);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['pbx', 'clients'] });
      qc.invalidateQueries({ queryKey: ['pbx', 'pbx_domains'] });
      toast.success('Customer added');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: any) => {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    const { error } = await supabase.from('clients').delete().eq('id', c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['pbx', 'clients'] });
    toast.success('Customer deleted');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="w-7 h-7" /> Customers</h1>
          <p className="text-muted-foreground">End-clients hosted on the Lemtel platform — each with their own PBX domain</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Business Name</Label><Input value={form.name} onChange={e => onNameChange(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Create dedicated PBX domain</p>
                  <p className="text-xs text-muted-foreground">Provisions the domain on the phone system</p>
                </div>
                <Switch checked={createDomain} onCheckedChange={setCreateDomain} />
              </div>
              {createDomain && (
                <div>
                  <Label className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> SIP Domain</Label>
                  <Input
                    value={form.domain}
                    placeholder={`customer.${BASE_DOMAIN}`}
                    onChange={e => { setDomainTouched(true); setForm({ ...form, domain: e.target.value.trim().toLowerCase() }); }}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{filtered.length} customers</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>PBX Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No customers.</TableCell></TableRow>
                ) : filtered.map((c: any) => {
                  const dom = domainByClient.get(c.id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.email || '—'}</TableCell>
                      <TableCell>
                        {dom ? (
                          <Badge variant="outline" className="font-mono text-xs"><Globe className="w-3 h-3 mr-1" />{dom.name}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status || 'active'}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c)}>
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
