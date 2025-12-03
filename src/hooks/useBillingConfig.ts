import { useQuery } from '@tanstack/react-query';
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

export interface Plan {
  id: string;
  name: string;
  price: number; // Monthly price
  priceAnnual: number; // Annual price
  priceId: string | null;
  priceIdAnnual: string | null;
  clientsIncluded: number;
  additionalClientPrice: number | null;
  features: string[];
  popular?: boolean;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
  priceId: string;
  availableFor: string[];
  description: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    priceAnnual: 0,
    priceId: null,
    priceIdAnnual: null,
    clientsIncluded: 1,
    additionalClientPrice: null,
    features: [
      '1 client inclus',
      'Agents illimités',
      'Analytics basiques',
      'Support communauté',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 100,
    priceAnnual: 1200,
    priceId: 'price_starter_monthly',
    priceIdAnnual: 'price_starter_annual',
    clientsIncluded: 3,
    additionalClientPrice: 15,
    features: [
      '3 clients inclus ($15/client additionnel)',
      'Agents illimités',
      'Domaine personnalisé',
      'Facturation Stripe',
      'Support standard',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 250,
    priceAnnual: 3000,
    priceId: 'price_growth_monthly',
    priceIdAnnual: 'price_growth_annual',
    clientsIncluded: 5,
    additionalClientPrice: 12,
    popular: true,
    features: [
      '5 clients inclus ($12/client additionnel)',
      'Toutes fonctionnalités Starter',
      'Métriques KPI personnalisées',
      'Campagnes appels sortants',
      'Email white-label',
      'Support prioritaire',
    ],
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    price: 500,
    priceAnnual: 6000,
    priceId: 'price_ultimate_monthly',
    priceIdAnnual: 'price_ultimate_annual',
    clientsIncluded: 10,
    additionalClientPrice: 10,
    features: [
      '10 clients inclus ($10/client additionnel)',
      'Toutes fonctionnalités Growth',
      'Backend white-label',
      'Accès API complet',
      'Support dédié 24/7',
    ],
  },
];

export const ADDONS: Addon[] = [
  {
    id: 'hipaa',
    name: 'HIPAA Compliance',
    price: 200,
    priceId: 'price_hipaa_addon',
    availableFor: ['starter', 'growth', 'ultimate'],
    description: 'Conformité HIPAA pour données de santé',
  },
  {
    id: 'saas_configurator',
    name: 'SaaS Configurator',
    price: 200,
    priceId: 'price_saas_addon',
    availableFor: ['growth'],
    description: 'Configuration avancée SaaS (Growth uniquement)',
  },
];

export function useBillingConfig() {
  const { selectedOrg: selectedOrganization } = useOrganization();

  const { data: billingConfig, isLoading, refetch } = useQuery({
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

  // Calculate savings for annual plans
  const getAnnualSavings = (plan: Plan): number => {
    if (!plan.priceAnnual || !plan.price) return 0;
    return (plan.price * 12) - plan.priceAnnual;
  };

  return {
    billingConfig,
    currentPlan,
    isLoading,
    refetch,
    getAnnualSavings,
  };
}
