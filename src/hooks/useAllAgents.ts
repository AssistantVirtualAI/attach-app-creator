import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentWithPlatform {
  id: string;
  name: string;
  platform: string;
  platform_agent_id: string | null;
  platform_api_key: string | null;
  description: string | null;
  config: Record<string, any> | null;
  organization_id: string;
}

export const useAllAgents = () => {
  return useQuery({
    queryKey: ['all-agents'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's organization
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!orgMember) {
        return { agents: [], fallbackApiKey: null };
      }

      // Get ALL agents for the organization (no platform filter)
      const { data: agents, error } = await supabase
        .from('agents')
        .select('id, name, platform, platform_agent_id, platform_api_key, description, config, organization_id')
        .eq('organization_id', orgMember.organization_id)
        .not('platform_agent_id', 'is', null);

      if (error) throw error;

      // Get organization integrations for fallback API keys (all platforms)
      const { data: integrations } = await supabase
        .from('organization_integrations')
        .select('api_key, agent_id, platform')
        .eq('is_active', true)
        .or(`organization_id.eq.${orgMember.organization_id},user_id.eq.${user.id}`);

      // Build a map of platform -> fallback API key
      const fallbackApiKeys: Record<string, string> = {};
      if (integrations) {
        for (const integration of integrations) {
          if (integration.api_key && integration.platform) {
            fallbackApiKeys[integration.platform] = integration.api_key;
          }
        }
      }

      return {
        agents: (agents || []) as AgentWithPlatform[],
        fallbackApiKeys,
      };
    },
  });
};

// Helper to get platform display name
export const getPlatformDisplayName = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case 'elevenlabs':
      return 'ElevenLabs';
    case 'retell':
      return 'Retell';
    case 'vapi':
      return 'Vapi';
    default:
      return platform;
  }
};

// Helper to check if platform supports knowledge base
export const platformSupportsKnowledgeBase = (platform: string): boolean => {
  const p = platform.toLowerCase();
  return p === 'elevenlabs' || p === 'retell';
};

