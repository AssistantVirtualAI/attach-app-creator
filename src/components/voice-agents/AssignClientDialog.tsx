import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { NeonButton } from '@/components/ui-cockpit';
import { Loader2, Phone, Users2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voiceAgent: { id: string; name: string; source: 'agents' | 'pbx_softphone_users' };
};

export function AssignClientDialog({ open, onOpenChange, voiceAgent }: Props) {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'phone' | 'voice'>('phone');

  const { data: phoneClients = [] } = useQuery({
    queryKey: ['clients-pick', selectedOrgId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('clients').select('id, name, email').eq('organization_id', selectedOrgId).order('name').limit(200);
      return data || [];
    },
    enabled: open && !!selectedOrgId,
  });

  const { data: vaClients = [] } = useQuery({
    queryKey: ['va-clients-pick', selectedOrgId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('voice_agent_clients').select('id, name, contact_email').eq('organization_id', selectedOrgId).order('name').limit(200);
      return data || [];
    },
    enabled: open && !!selectedOrgId,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ['va-assignments-for', voiceAgent.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('voice_agent_assignments')
        .select('id, client_id, phone_client_id, voice_agent_clients(name), clients(name)')
        .eq('voice_agent_id', voiceAgent.id);
      return data || [];
    },
    enabled: open,
  });

  const assign = useMutation({
    mutationFn: async (payload: { client_id?: string; phone_client_id?: string }) => {
      const { error } = await (supabase as any).from('voice_agent_assignments').insert({
        organization_id: selectedOrgId,
        voice_agent_id: voiceAgent.id,
        source: voiceAgent.source,
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Client assigned' });
      qc.invalidateQueries({ queryKey: ['va-assignments-for', voiceAgent.id] });
      qc.invalidateQueries({ queryKey: ['voice_agent_assignments'] });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const unassign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('voice_agent_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['va-assignments-for', voiceAgent.id] });
      qc.invalidateQueries({ queryKey: ['voice_agent_assignments'] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign clients to <span className="text-cockpit-cyan">{voiceAgent.name}</span></DialogTitle>
        </DialogHeader>

        {existing.length > 0 && (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Currently assigned</div>
            <div className="flex flex-wrap gap-2">
              {existing.map((e: any) => (
                <Badge key={e.id} variant="secondary" className="gap-1.5 py-1.5">
                  {e.voice_agent_clients?.name || e.clients?.name || 'Client'}
                  <button onClick={() => unassign.mutate(e.id)} className="hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="phone"><Phone className="w-4 h-4 mr-2" /> Phone-System Client</TabsTrigger>
            <TabsTrigger value="voice"><Users2 className="w-4 h-4 mr-2" /> Voice-Agent Client</TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="max-h-80 overflow-auto space-y-1 mt-3">
            {phoneClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No phone-system clients yet.</p>
            ) : phoneClients.map((c: any) => (
              <button
                key={c.id}
                onClick={() => assign.mutate({ phone_client_id: c.id })}
                disabled={assign.isPending}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-cockpit-surface/60 transition-colors text-left"
              >
                <div>
                  <div className="font-medium text-sm">{c.name}</div>
                  {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                </div>
                <span className="text-xs text-cockpit-cyan">+ Assign</span>
              </button>
            ))}
          </TabsContent>

          <TabsContent value="voice" className="max-h-80 overflow-auto space-y-1 mt-3">
            {vaClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No voice-agent clients. <a href="/org/lemtel/admin/voice-clients" className="text-cockpit-cyan underline">Create one</a>.
              </p>
            ) : vaClients.map((c: any) => (
              <button
                key={c.id}
                onClick={() => assign.mutate({ client_id: c.id })}
                disabled={assign.isPending}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-cockpit-surface/60 transition-colors text-left"
              >
                <div>
                  <div className="font-medium text-sm">{c.name}</div>
                  {c.contact_email && <div className="text-xs text-muted-foreground">{c.contact_email}</div>}
                </div>
                <span className="text-xs text-cockpit-cyan">+ Assign</span>
              </button>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <NeonButton variant="ghost" onClick={() => onOpenChange(false)}>Done</NeonButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
