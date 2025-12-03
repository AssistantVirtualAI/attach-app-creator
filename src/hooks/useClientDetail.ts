import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  login_id: string | null;
  language: string | null;
  theme: string | null;
  status: string | null;
  custom_css: string | null;
  access_controls: Record<string, boolean> | null;
  organization_id: string;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useClientDetail = (clientId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data as ClientDetail;
    },
    enabled: !!clientId,
  });

  const { data: clientMembers } = useQuery({
    queryKey: ['client-members', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('client_members')
        .select('*')
        .eq('client_id', clientId);

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: assignedAgents } = useQuery({
    queryKey: ['client-agents', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('client_id', clientId);

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: availableAgents } = useQuery({
    queryKey: ['available-agents', client?.organization_id],
    queryFn: async () => {
      if (!client?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('organization_id', client.organization_id)
        .is('client_id', null);

      if (error) throw error;
      return data;
    },
    enabled: !!client?.organization_id,
  });

  const updateClientMutation = useMutation({
    mutationFn: async (updates: Partial<ClientDetail>) => {
      if (!clientId) throw new Error('No client ID');
      
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-detail', clientId] });
      toast.success('Client mis à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const assignAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      if (!clientId) throw new Error('No client ID');
      
      const { error } = await supabase
        .from('agents')
        .update({ client_id: clientId })
        .eq('id', agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-agents', clientId] });
      queryClient.invalidateQueries({ queryKey: ['available-agents'] });
      toast.success('Agent assigné');
    },
    onError: () => {
      toast.error('Erreur lors de l\'assignation');
    },
  });

  const unassignAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase
        .from('agents')
        .update({ client_id: null })
        .eq('id', agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-agents', clientId] });
      queryClient.invalidateQueries({ queryKey: ['available-agents'] });
      toast.success('Agent détaché');
    },
    onError: () => {
      toast.error('Erreur lors du détachement');
    },
  });

  return {
    client,
    clientMembers,
    assignedAgents,
    availableAgents,
    isLoading,
    updateClient: updateClientMutation.mutate,
    assignAgent: assignAgentMutation.mutate,
    unassignAgent: unassignAgentMutation.mutate,
    isUpdating: updateClientMutation.isPending,
  };
};
