import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { toast } from 'sonner';

interface CreateAppointmentParams {
  agentId?: string;
  clientId?: string;
  conversationId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
}

export const useAppointments = () => {
  const { selectedOrg } = useOrganization();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', selectedOrg?.id],
    queryFn: async () => {
      if (!selectedOrg?.id) return [];
      
      const { data, error } = await supabase.functions.invoke('book-appointment', {
        body: {
          action: 'list',
          organizationId: selectedOrg.id
        }
      });

      if (error) throw error;
      return data.appointments || [];
    },
    enabled: !!selectedOrg?.id,
  });

  const createAppointment = useMutation({
    mutationFn: async (params: CreateAppointmentParams) => {
      if (!selectedOrg?.id) throw new Error('No organization selected');

      const { data, error } = await supabase.functions.invoke('book-appointment', {
        body: {
          action: 'create',
          organizationId: selectedOrg.id,
          ...params
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Rendez-vous créé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création du rendez-vous');
    }
  });

  const cancelAppointment = useMutation({
    mutationFn: async (appointmentId: string) => {
      if (!selectedOrg?.id) throw new Error('No organization selected');

      const { data, error } = await supabase.functions.invoke('book-appointment', {
        body: {
          action: 'cancel',
          organizationId: selectedOrg.id,
          appointmentId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Rendez-vous annulé');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de l\'annulation');
    }
  });

  const checkAvailability = async (startTime: string, endTime: string) => {
    if (!selectedOrg?.id) return { available: true };

    const { data, error } = await supabase.functions.invoke('book-appointment', {
      body: {
        action: 'check-availability',
        organizationId: selectedOrg.id,
        startTime,
        endTime
      }
    });

    if (error) throw error;
    return data;
  };

  return {
    appointments,
    isLoading,
    createAppointment,
    cancelAppointment,
    checkAvailability
  };
};
