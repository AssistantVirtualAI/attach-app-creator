import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentWithPlatform {
  id: string;
  name: string;
  platform: string;
  platform_agent_id: string | null;
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

      // Get ALL agents for the organization using safe view (excludes platform_api_key)
      const { data: agents, error } = await supabase
        .from('agents_safe')
        .select('id, name, platform, platform_agent_id, description, config, organization_id')
        .eq('organization_id', orgMember.organization_id)
        .not('platform_agent_id', 'is', null);

      if (error) throw error;

      return {
        agents: (agents || []) as AgentWithPlatform[],
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

