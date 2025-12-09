import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { toast } from 'sonner';

export const useCalendarIntegration = () => {
  const { selectedOrg } = useOrganization();
  const queryClient = useQueryClient();

  const { data: integration, isLoading } = useQuery({
    queryKey: ['calendar-integration', selectedOrg?.id],
    queryFn: async () => {
      if (!selectedOrg?.id) return null;
      
      const { data, error } = await supabase
        .from('calendar_integrations')
        .select('*')
        .eq('organization_id', selectedOrg.id)
        .eq('provider', 'google')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrg?.id,
  });

  const connectGoogle = useMutation({
    mutationFn: async () => {
      if (!selectedOrg?.id) throw new Error('No organization selected');

      const redirectUri = `${window.location.origin}/settings?tab=integrations&callback=google`;
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'get-auth-url',
          organizationId: selectedOrg.id,
          redirectUri
        }
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to initiate Google Calendar connection');
    }
  });

  const exchangeCode = useMutation({
    mutationFn: async (code: string) => {
      if (!selectedOrg?.id) throw new Error('No organization selected');

      const redirectUri = `${window.location.origin}/settings?tab=integrations&callback=google`;

      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'exchange-code',
          organizationId: selectedOrg.id,
          code,
          redirectUri
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-integration'] });
      toast.success('Google Calendar connecté avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to connect Google Calendar');
    }
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!selectedOrg?.id) throw new Error('No organization selected');

      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'disconnect',
          organizationId: selectedOrg.id
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-integration'] });
      toast.success('Google Calendar déconnecté');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disconnect calendar');
    }
  });

  return {
    integration,
    isLoading,
    isConnected: !!integration?.is_active,
    connectGoogle,
    exchangeCode,
    disconnect
  };
};
