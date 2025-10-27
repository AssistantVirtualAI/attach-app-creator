import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';

export const useAICredits = () => {
  const { selectedOrg } = useOrganization();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ai-credits', selectedOrg],
    queryFn: async () => {
      if (!selectedOrg) return { credits: 825, creditsUsed: 0 };

      const { data: billingData } = await supabase
        .from('billing_config')
        .select('ai_credits, credits_used')
        .eq('organization_id', selectedOrg)
        .single();

      return {
        credits: billingData?.ai_credits || 825,
        creditsUsed: billingData?.credits_used || 0,
      };
    },
    enabled: !!selectedOrg,
  });

  return {
    credits: data?.credits || 825,
    creditsUsed: data?.creditsUsed || 0,
    isLoading,
    refetch,
  };
};
