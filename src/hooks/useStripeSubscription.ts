import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { toast } from 'sonner';
import { useBillingConfig } from './useBillingConfig';

export function useStripeSubscription() {
  const { selectedOrg: selectedOrganization } = useOrganization();
  const { refetch } = useBillingConfig();
  const [isLoading, setIsLoading] = useState(false);

  const createCheckoutSession = async (priceId: string) => {
    if (!selectedOrganization?.id) {
      toast.error('Aucune organisation sélectionnée');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: {
          organizationId: selectedOrganization.id,
          priceId,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing?canceled=true`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error('Erreur lors de la création du paiement');
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    if (!selectedOrganization?.id) {
      toast.error('Aucune organisation sélectionnée');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: {
          organizationId: selectedOrganization.id,
          returnUrl: `${window.location.origin}/billing`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error('Erreur lors de l\'accès au portail');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSubscription = async () => {
    await refetch();
  };

  return {
    createCheckoutSession,
    openCustomerPortal,
    refreshSubscription,
    isLoading,
  };
}
