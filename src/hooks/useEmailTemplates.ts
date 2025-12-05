import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { toast } from 'sonner';

export interface EmailTemplate {
  id: string;
  organization_id: string;
  template_type: string;
  subject: string | null;
  greeting: string | null;
  body: string | null;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_TYPES = [
  { value: 'welcome', label: 'Bienvenue', description: 'Email envoyé aux nouveaux utilisateurs' },
  { value: 'password_reset', label: 'Réinitialisation mot de passe', description: 'Email de réinitialisation' },
  { value: '2fa', label: 'Authentification 2FA', description: 'Code OTP pour authentification à deux facteurs' },
  { value: 'invitation', label: 'Invitation', description: 'Invitation à rejoindre l\'organisation' },
  { value: 'notification', label: 'Notification', description: 'Notifications générales' },
  { value: 'report', label: 'Rapport', description: 'Rapports périodiques' },
];

export const TEMPLATE_VARIABLES = [
  { variable: '{{name}}', description: 'Nom du destinataire' },
  { variable: '{{email}}', description: 'Email du destinataire' },
  { variable: '{{company}}', description: 'Nom de l\'entreprise' },
  { variable: '{{link}}', description: 'Lien d\'action' },
  { variable: '{{date}}', description: 'Date actuelle' },
  { variable: '{{otp_code}}', description: 'Code OTP à 6 chiffres' },
  { variable: '{{token}}', description: 'Token de validation' },
];

export function useEmailTemplates() {
  const { selectedOrg: selectedOrganization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates', selectedOrganization?.id],
    queryFn: async () => {
      if (!selectedOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('organization_id', selectedOrganization.id)
        .order('template_type');

      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: !!selectedOrganization?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Partial<EmailTemplate>) => {
      if (!selectedOrganization?.id) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          organization_id: selectedOrganization.id,
          template_type: template.template_type,
          subject: template.subject || '',
          greeting: template.greeting || '',
          body: template.body || '',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template créé avec succès');
    },
    onError: (error: Error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template mis à jour');
    },
    onError: (error: Error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template supprimé');
    },
    onError: (error: Error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
