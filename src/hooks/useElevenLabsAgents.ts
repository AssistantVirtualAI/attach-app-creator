import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ElevenLabsAgent {
  id: string;
  name: string;
  platform_agent_id: string;
  description: string | null;
  config: Record<string, any> | null;
}

export const useElevenLabsAgents = () => {
  return useQuery({
    queryKey: ['elevenlabs-agents'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get agents with ElevenLabs platform using safe view (excludes platform_api_key)
      const { data: agents, error } = await supabase
        .from('agents_safe')
        .select('id, name, platform_agent_id, description, config')
        .eq('platform', 'elevenlabs')
        .not('platform_agent_id', 'is', null);

      if (error) throw error;

      // Also check organization integrations for fallback API key
      const { data: integration } = await supabase
        .from('organization_integrations_safe')
        .select('agent_id')
        .eq('user_id', user.id)
        .eq('platform', 'elevenlabs')
        .eq('is_active', true)
        .single();

      return {
        agents: (agents || []) as ElevenLabsAgent[],
        fallbackAgentId: integration?.agent_id || null,
      };
    },
  });
};
