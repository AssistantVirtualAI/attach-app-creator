import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/context/OrganizationContext';

interface InviteMemberParams {
  email: string;
  organizationId: string;
  role: 'org_admin' | 'manager' | 'agent' | 'viewer';
}

interface UpdateOrganizationParams {
  organizationId: string;
  data: {
    name?: string;
    logo_url?: string;
    primary_color?: string;
    domain?: string;
    is_active?: boolean;
  };
}

export const useOrganizations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshOrganization, selectedOrgId } = useOrganization();
  const [isLoading, setIsLoading] = useState(false);

  const inviteMember = async ({ email, organizationId, role }: InviteMemberParams) => {
    if (!user) {
      toast({
        title: 'Erreur',
        description: 'Vous devez être connecté',
        variant: 'destructive',
      });
      return { success: false };
    }

    try {
      setIsLoading(true);

      // Check if user exists (by email)
      // Note: In production, you'd want to send an invitation email
      // For now, we'll just check if the email exists in auth.users
      const { data: invitedUser, error: userError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (userError) throw userError;

      if (!invitedUser) {
        toast({
          title: 'Utilisateur introuvable',
          description: 'Cet utilisateur n\'existe pas. Invitez-le à créer un compte.',
          variant: 'destructive',
        });
        return { success: false };
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', invitedUser.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (existingMember) {
        toast({
          title: 'Membre existant',
          description: 'Cet utilisateur est déjà membre de l\'organisation',
          variant: 'destructive',
        });
        return { success: false };
      }

      // Add as member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          user_id: invitedUser.id,
          organization_id: organizationId,
          invited_by: user.id,
          accepted_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      // Assign role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: invitedUser.id,
          organization_id: organizationId,
          role,
        });

      if (roleError) throw roleError;

      toast({
        title: 'Membre ajouté',
        description: `${email} a été ajouté avec le rôle ${role}`,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'inviter le membre',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const removeMember = async (userId: string, organizationId: string) => {
    try {
      setIsLoading(true);

      // Remove role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (roleError) throw roleError;

      // Remove membership
      const { error: memberError } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (memberError) throw memberError;

      toast({
        title: 'Membre retiré',
        description: 'Le membre a été retiré de l\'organisation',
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de retirer le membre',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const updateMemberRole = async (
    userId: string,
    organizationId: string,
    newRole: 'org_admin' | 'manager' | 'agent' | 'viewer'
  ) => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: 'Rôle mis à jour',
        description: `Le rôle a été changé en ${newRole}`,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour le rôle',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrganization = async ({ organizationId, data }: UpdateOrganizationParams) => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: 'Organisation mise à jour',
        description: 'Les modifications ont été enregistrées',
      });

      await refreshOrganization();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour l\'organisation',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const getOrganizationMembers = async (organizationId?: string) => {
    const orgId = organizationId || selectedOrgId;
    if (!orgId) return [];

    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            full_name,
            avatar_url
          ),
          user_roles!inner (
            role
          )
        `)
        .eq('organization_id', orgId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching members:', error);
      return [];
    }
  };

  return {
    inviteMember,
    removeMember,
    updateMemberRole,
    updateOrganization,
    getOrganizationMembers,
    isLoading,
  };
};
