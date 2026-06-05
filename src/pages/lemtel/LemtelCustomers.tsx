import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Building2 } from 'lucide-react';
import { MOCK_CUSTOMERS, type LemtelCustomer } from '@/lib/lemtelMockData';
import { useLemtelMockMode } from '@/hooks/useLemtelMockMode';
import { toast } from 'sonner';

export default function LemtelCustomers() {
  const { useMock } = useLemtelMockMode();
  const [customers, setCustomers] = useState<LemtelCustomer[]>(MOCK_CUSTOMERS);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', contact_email: '', contact_phone: '' });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.name) return toast.error('Name required');
    const newCust: LemtelCustomer = {
      id: `c${Date.now()}`,
      name: form.name,
      industry: form.industry || 'Other',
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      extensions: 0,
      dids: 0,
      status: 'trial',
      created_at: new Date().toISOString().slice(0, 10),
    };
    setCustomers([newCust, ...customers]);
    setForm({ name: '', industry: '', contact_email: '', contact_phone: '' });
    setOpen(false);
    toast.success('Customer added' + (useMock ? ' (mock)' : ''));
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
              <div><Label>Industry</Label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Customers ({filtered.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Ext / DIDs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.industry}</TableCell>
                  <TableCell className="text-sm"><div>{c.contact_email}</div><div className="text-muted-foreground">{c.contact_phone}</div></TableCell>
                  <TableCell>{c.extensions} / {c.dids}</TableCell>
                  <TableCell><Badge variant={c.status === 'active' ? 'default' : c.status === 'trial' ? 'secondary' : 'destructive'}>{c.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{c.created_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
