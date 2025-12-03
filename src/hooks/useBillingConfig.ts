import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';

export interface BillingConfig {
  organization_id: string;
  plan_tier: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  credits_limit: number;
  credits_used: number;
  ai_credits: number;
  subscription_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      '3 clients max',
      '100 conversations/mois',
      'Analytics basiques',
      'Support email',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    priceId: 'price_starter',
    features: [
      '10 clients',
      '1 000 conversations/mois',
      'Analytics avancés',
      'Templates email',
      'Support prioritaire',
    ],
    popular: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 49,
    priceId: 'price_growth',
    features: [
      '50 clients',
      '5 000 conversations/mois',
      'Analytics complets',
      'Templates email illimités',
      'Webhooks personnalisés',
      'Support dédié',
    ],
    popular: true,
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    price: 149,
    priceId: 'price_ultimate',
    features: [
      'Clients illimités',
      'Conversations illimitées',
      'Toutes les fonctionnalités',
      'API complète',
      'Domaine personnalisé',
      'SLA garanti',
      'Account manager',
    ],
    popular: false,
  },
];

export function useBillingConfig() {
  const { selectedOrg: selectedOrganization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: billingConfig, isLoading } = useQuery({
    queryKey: ['billing-config', selectedOrganization?.id],
    queryFn: async () => {
      if (!selectedOrganization?.id) return null;

      const { data, error } = await supabase
        .from('billing_config')
        .select('*')
        .eq('organization_id', selectedOrganization.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as BillingConfig | null;
    },
    enabled: !!selectedOrganization?.id,
  });

  const currentPlan = PLANS.find(p => p.id === billingConfig?.plan_tier) || PLANS[0];

  return {
    billingConfig,
    currentPlan,
    isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['billing-config'] }),
  };
}
