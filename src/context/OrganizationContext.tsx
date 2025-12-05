import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  domain?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  gdpr_enabled?: boolean;
  hipaa_enabled?: boolean;
}

interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  invited_by?: string;
  invited_at: string;
  accepted_at?: string;
}

interface UserRole {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'super_admin' | 'org_admin' | 'manager' | 'agent' | 'viewer';
  created_at: string;
}

interface OrganizationContextType {
  selectedOrg: Organization | null;
  selectedOrgId: string | null;
  userRole: UserRole | null;
  isLoading: boolean;
  refreshOrganization: () => Promise<void>;
  isSuperAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Load organization and user role
  useEffect(() => {
    if (user) {
      loadOrganization();
      checkSuperAdmin();
    } else {
      setSelectedOrg(null);
      setSelectedOrgId(null);
      setUserRole(null);
      setIsSuperAdmin(false);
      setIsLoading(false);
    }
  }, [user]);

  // Load user role when organization changes
  useEffect(() => {
    if (selectedOrgId) {
      loadUserRole(selectedOrgId);
    }
  }, [selectedOrgId]);

  const checkSuperAdmin = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (error) throw error;
      setIsSuperAdmin(!!data);
    } catch (error) {
      console.error('Error checking super admin status:', error);
      setIsSuperAdmin(false);
    }
  };

  const loadOrganization = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Get the user's organization membership
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1);

      if (membershipError) throw membershipError;

      if (memberships && memberships.length > 0) {
        const orgId = memberships[0].organization_id;

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .eq('is_active', true)
          .single();

        if (orgError) throw orgError;

        setSelectedOrg(org);
        setSelectedOrgId(org.id);
      } else {
        setSelectedOrg(null);
        setSelectedOrgId(null);
      }
    } catch (error: any) {
      console.error('Error loading organization:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger l\'organisation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserRole = async (orgId: string) => {
    if (!user || !orgId) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .maybeSingle();

      if (error) throw error;
      setUserRole(data);
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole(null);
    }
  };

  const refreshOrganization = async () => {
    await loadOrganization();
  };

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrg,
        selectedOrgId,
        userRole,
        isLoading,
        refreshOrganization,
        isSuperAdmin,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
