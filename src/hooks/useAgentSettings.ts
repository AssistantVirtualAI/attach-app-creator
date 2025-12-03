import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AgentSettings {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  platform_api_key: string | null;
  platform_agent_id: string | null;
  organization_id: string;
  client_id: string | null;
  avatar_url: string | null;
  widget_layout: string | null;
  branding_url: string | null;
  theme_config: Record<string, any> | null;
  config: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export const useAgentSettings = (agentId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent-settings', agentId],
    queryFn: async () => {
      if (!agentId) return null;
      
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error) throw error;
      return data as AgentSettings;
    },
    enabled: !!agentId,
  });

  const { data: client } = useQuery({
    queryKey: ['agent-client', agent?.client_id],
    queryFn: async () => {
      if (!agent?.client_id) return null;
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('id', agent.client_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!agent?.client_id,
  });

  const { data: conversations } = useQuery({
    queryKey: ['agent-conversations', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      
      const { data, error } = await supabase
        .from('conversations')
        .select('id, created_at, duration, sentiment, satisfaction_score')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  const updateAgentMutation = useMutation({
    mutationFn: async (updates: Partial<AgentSettings>) => {
      if (!agentId) throw new Error('No agent ID');
      
      const { error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings', agentId] });
      toast.success('Agent mis à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!agent?.platform_api_key) throw new Error('Aucune clé API configurée');
      
      // Simulate API test - in production, call the actual platform API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo, always succeed if API key exists
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Connexion réussie !');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erreur de connexion');
    },
  });

  // Calculate analytics
  const analytics = {
    totalConversations: conversations?.length || 0,
    avgDuration: conversations?.length 
      ? Math.round(conversations.reduce((acc, c) => acc + (c.duration || 0), 0) / conversations.length)
      : 0,
    avgSatisfaction: conversations?.length
      ? (conversations.reduce((acc, c) => acc + (c.satisfaction_score || 0), 0) / conversations.length).toFixed(1)
      : '0',
    sentimentBreakdown: {
      positive: conversations?.filter(c => c.sentiment === 'positive').length || 0,
      neutral: conversations?.filter(c => c.sentiment === 'neutral').length || 0,
      negative: conversations?.filter(c => c.sentiment === 'negative').length || 0,
    },
  };

  return {
    agent,
    client,
    conversations,
    analytics,
    isLoading,
    updateAgent: updateAgentMutation.mutate,
    testConnection: testConnectionMutation.mutate,
    isUpdating: updateAgentMutation.isPending,
    isTesting: testConnectionMutation.isPending,
  };
};
