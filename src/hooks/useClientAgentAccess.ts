import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Platform = 'elevenlabs' | 'vapi' | 'retell';

interface ClientAgentAccess {
  hasAccess: boolean;
  role: 'admin' | 'viewer' | null;
  canEdit: boolean;
  apiKey: string | null;
  agentId: string | null;
  platformAgentId: string | null;
  agentName: string | null;
  platform: Platform | null;
  organizationId: string | null;
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

      // Get agent details with API key, platform_agent_id, and platform
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, name, platform, platform_api_key, platform_agent_id, organization_id, config')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        console.error('Error fetching agent:', agentError);
        return null;
      }

      const config = agent.config as Record<string, any> | null;
      const platform = (agent.platform as Platform) || 'elevenlabs';
      
      // Priority: platform_agent_id > config.agent_id
      const platformAgentId = agent.platform_agent_id || config?.agent_id || null;
      
      // Priority: platform_api_key > config.api_key > organization_integrations
      let apiKey = agent.platform_api_key || config?.api_key || null;
      
      // Fallback: try to get API key from organization_integrations using the correct platform
      if (!apiKey && agent.organization_id) {
        const { data: integration } = await supabase
          .from('organization_integrations')
          .select('api_key')
          .eq('organization_id', agent.organization_id)
          .eq('platform', platform)
          .eq('is_active', true)
          .maybeSingle();
        
        if (integration?.api_key) {
          apiKey = integration.api_key;
        }
      }
      
      return {
        role: assignment.role as 'admin' | 'viewer',
        apiKey: apiKey,
        agentId: agentId,
        platformAgentId: platformAgentId,
        agentName: agent.name,
        platform,
        organizationId: agent.organization_id,
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
    platformAgentId: data?.platformAgentId || null,
    agentName: data?.agentName || null,
    platform: data?.platform || null,
    organizationId: data?.organizationId || null,
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
