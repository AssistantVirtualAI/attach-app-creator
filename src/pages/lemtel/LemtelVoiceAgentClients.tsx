import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { GlassCard, SectionHeader, NeonButton, GlassTable, StatusChip, EmptyStateBranded } from '@/components/ui-cockpit';
import { GTHead, GTRow, GTHeadCell, GTCell } from '@/components/ui-cockpit/GlassTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users2, Mail, Phone, Building2, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type VAClient = {
  id: string;
  organization_id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export default function LemtelVoiceAgentClients() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VAClient | null>(null);
  const [form, setForm] = useState({ name: '', contact_email: '', contact_phone: '', company: '', notes: '' });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['voice_agent_clients', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await (supabase as any)
        .from('voice_agent_clients')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as VAClient[];
    },
    enabled: !!selectedOrgId,
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('No organization');
      const payload = { ...form, organization_id: selectedOrgId };
      if (editing) {
        const { error } = await (supabase as any).from('voice_agent_clients').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('voice_agent_clients').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? 'Client updated' : 'Client created' });
      setOpen(false); setEditing(null); setForm({ name: '', contact_email: '', contact_phone: '', company: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['voice_agent_clients'] });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('voice_agent_clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Client deleted' }); qc.invalidateQueries({ queryKey: ['voice_agent_clients'] }); },
  });

  const openCreate = () => { setEditing(null); setForm({ name: '', contact_email: '', contact_phone: '', company: '', notes: '' }); setOpen(true); };
  const openEdit = (c: VAClient) => {
    setEditing(c);
    setForm({
      name: c.name, contact_email: c.contact_email || '', contact_phone: c.contact_phone || '',
      company: c.company || '', notes: c.notes || '',
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Users2 className="w-5 h-5" />}
        title="Voice Agent Clients"
        subtitle="Customers reachable by your AI voice agents — independent from phone-system clients."
        actions={<NeonButton onClick={openCreate}><Plus className="w-4 h-4" /> New Client</NeonButton>}
      />

      <GlassCard>
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cockpit-cyan" /></div>
          ) : clients.length === 0 ? (
            <EmptyStateBranded
              icon={<Users2 className="w-8 h-8" />}
              title="No voice-agent clients yet"
              description="Add customers your voice agents will speak with. Kept separate from phone-system accounts."
              action={<NeonButton onClick={openCreate}><Plus className="w-4 h-4" /> Add first client</NeonButton>}
            />
          ) : (
            <GlassTable>
              <GTHead>
                <GTRow>
                  <GTHeadCell>Name</GTHeadCell>
                  <GTHeadCell>Company</GTHeadCell>
                  <GTHeadCell>Contact</GTHeadCell>
                  <GTHeadCell>Status</GTHeadCell>
                  <GTHeadCell className="text-right"></GTHeadCell>
                </GTRow>
              </GTHead>
              <tbody>
                {clients.map(c => (
                  <GTRow key={c.id}>
                    <GTCell className="font-medium">{c.name}</GTCell>
                    <GTCell>{c.company ? <span className="inline-flex items-center gap-1.5 text-sm"><Building2 className="w-3.5 h-3.5 text-cockpit-cyan" />{c.company}</span> : <span className="text-muted-foreground">—</span>}</GTCell>
                    <GTCell>
                      <div className="text-xs space-y-0.5">
                        {c.contact_email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.contact_email}</div>}
                        {c.contact_phone && <div className="flex items-center gap-1 font-mono"><Phone className="w-3 h-3" />{c.contact_phone}</div>}
                      </div>
                    </GTCell>
                    <GTCell><StatusChip tone={c.status === 'active' ? 'success' : 'idle'}>{c.status}</StatusChip></GTCell>
                    <GTCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <NeonButton size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></NeonButton>
                        <NeonButton size="sm" variant="danger" onClick={() => confirm(`Delete ${c.name}?`) && remove.mutate(c.id)}><Trash2 className="w-3.5 h-3.5" /></NeonButton>
                      </div>
                    </GTCell>
                  </GTRow>
                ))}
              </tbody>
            </GlassTable>
          )}
        </div>
      </GlassCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Voice Agent Client' : 'New Voice Agent Client'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" /></div>
            <div><Label>Company</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Acme Inc." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="contact@acme.com" /></div>
              <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="+1 555 0100" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <NeonButton variant="ghost" onClick={() => setOpen(false)}>Cancel</NeonButton>
            <NeonButton onClick={() => upsert.mutate()} disabled={!form.name || upsert.isPending}>
              {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Save' : 'Create'}
            </NeonButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
