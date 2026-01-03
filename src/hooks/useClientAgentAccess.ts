import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ClientAgentAccess {
  hasAccess: boolean;
  role: 'admin' | 'viewer' | null;
  canEdit: boolean;
  apiKey: string | null;
  agentId: string | null;
  agentName: string | null;
  isLoading: boolean;
}

export const useClientAgentAccess = (clientId: string | undefined, agentId: string | undefined): ClientAgentAccess => {
  const { data, isLoading } = useQuery({
    queryKey: ['client-agent-access', clientId, agentId],
    queryFn: async () => {
      if (!clientId || !agentId) return null;

      // Check if client has access to this agent
      const { data: assignment, error: assignmentError } = await supabase
        .from('client_agent_assignments')
        .select('role')
        .eq('client_id', clientId)
        .eq('agent_id', agentId)
        .maybeSingle();

      if (assignmentError) {
        console.error('Error checking client agent access:', assignmentError);
        return null;
      }

      if (!assignment) return null;

      // Get agent details with API key
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, name, platform_api_key, config')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        console.error('Error fetching agent:', agentError);
        return null;
      }

      const config = agent.config as Record<string, any> | null;
      
      return {
        role: assignment.role as 'admin' | 'viewer',
        apiKey: agent.platform_api_key || null,
        agentId: config?.agent_id || null,
        agentName: agent.name,
      };
    },
    enabled: !!clientId && !!agentId,
  });

  return {
    hasAccess: !!data,
    role: data?.role || null,
    canEdit: data?.role === 'admin',
    apiKey: data?.apiKey || null,
    agentId: data?.agentId || null,
    agentName: data?.agentName || null,
    isLoading,
  };
};

// Hook to get all agents assigned to a client
export const useClientAssignedAgents = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-assigned-agents', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_agent_assignments')
        .select(`
          id,
          role,
          agent_id,
          agents:agent_id (
            id,
            name,
            platform,
            avatar_url,
            config
          )
        `)
        .eq('client_id', clientId);

      if (error) {
        console.error('Error fetching client assigned agents:', error);
        return [];
      }

      return data.map(item => ({
        assignmentId: item.id,
        role: item.role as 'admin' | 'viewer',
        agent: item.agents as any,
      }));
    },
    enabled: !!clientId,
  });
};
