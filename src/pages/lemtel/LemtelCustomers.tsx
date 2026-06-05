import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Building2, Loader2 } from 'lucide-react';
import { usePbxClients, LEMTEL_ORG } from '@/hooks/usePbxData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function LemtelCustomers() {
  const { data: customers = [], isLoading } = usePbxClients();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (customers as any[]).filter(c =>
      (c.name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s)
    );
  }, [customers, search]);

  const handleCreate = async () => {
    if (!form.name) return toast.error('Name required');
    setSaving(true);
    const { error } = await supabase.from('clients').insert({
      organization_id: LEMTEL_ORG, name: form.name, email: form.email || null, status: 'active',
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setForm({ name: '', email: '' });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['pbx', 'clients'] });
    toast.success('Customer added');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="w-7 h-7" /> Customers</h1>
          <p className="text-muted-foreground">End-clients hosted on the Lemtel platform</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Business Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No customers.</TableCell></TableRow>
                ) : filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email || '—'}</TableCell>
                    <TableCell><Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status || 'active'}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</TableCell>
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
