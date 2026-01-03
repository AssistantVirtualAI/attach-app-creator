import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ElevenLabsAgent {
  id: string;
  name: string;
  platform_agent_id: string;
  platform_api_key: string | null;
  description: string | null;
  config: Record<string, any> | null;
}

export const useElevenLabsAgents = () => {
  return useQuery({
    queryKey: ['elevenlabs-agents'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get agents with ElevenLabs platform
      const { data: agents, error } = await supabase
        .from('agents')
        .select('id, name, platform_agent_id, platform_api_key, description, config')
        .eq('platform', 'elevenlabs')
        .not('platform_agent_id', 'is', null);

      if (error) throw error;

      // Also check organization integrations for fallback API key
      const { data: integration } = await supabase
        .from('organization_integrations')
        .select('api_key, agent_id')
        .eq('user_id', user.id)
        .eq('platform', 'elevenlabs')
        .eq('is_active', true)
        .single();

      return {
        agents: (agents || []) as ElevenLabsAgent[],
        fallbackApiKey: integration?.api_key || null,
        fallbackAgentId: integration?.agent_id || null,
      };
    },
  });
};
