import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { toast } from 'sonner';

export interface AgentForTwilio {
  id: string;
  name: string;
  platform: string;
  platform_agent_id: string | null;
  twilio_number: string | null;
}

export function useAgentsForTwilio() {
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading, refetch: refetchAgents } = useQuery({
    queryKey: ['agents-for-twilio', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, platform, platform_agent_id, twilio_number')
        .eq('organization_id', selectedOrgId)
        .in('platform', ['elevenlabs', 'vapi', 'retell'])
        .order('name');
      
      if (error) throw error;
      return (data || []) as AgentForTwilio[];
    },
    enabled: !!selectedOrgId,
  });

  const assignTwilioNumber = useMutation({
    mutationFn: async ({ agentId, twilioNumber }: { agentId: string | null; twilioNumber: string }) => {
      // First, unassign the number from any other agent
      const { error: unassignError } = await supabase
        .from('agents')
        .update({ twilio_number: null })
        .eq('twilio_number', twilioNumber);
      
      if (unassignError) throw unassignError;

      // If agentId is provided, assign the number to the new agent
      if (agentId) {
        const { error: assignError } = await supabase
          .from('agents')
          .update({ twilio_number: twilioNumber })
          .eq('id', agentId);
        
        if (assignError) throw assignError;
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-for-twilio'] });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const getAgentByTwilioNumber = (twilioNumber: string): AgentForTwilio | undefined => {
    // Normalize phone numbers for comparison (remove spaces, dashes)
    const normalizePhone = (phone: string) => phone?.replace(/\s+/g, '').replace(/-/g, '') || '';
    const normalizedInput = normalizePhone(twilioNumber);
    
    return agents.find(agent => {
      if (!agent.twilio_number) return false;
      const normalizedAgent = normalizePhone(agent.twilio_number);
      return normalizedAgent === normalizedInput || agent.twilio_number === twilioNumber;
    });
  };

  return {
    agents,
    isLoading,
    assignTwilioNumber,
    getAgentByTwilioNumber,
    refetchAgents,
  };
}
