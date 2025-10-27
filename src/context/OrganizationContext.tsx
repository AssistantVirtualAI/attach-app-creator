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
  organizations: Organization[];
  selectedOrg: Organization | null;
  selectedOrgId: string | null;
  userRole: UserRole | null;
  isLoading: boolean;
  selectOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (data: Partial<Organization>) => Promise<Organization | null>;
  isSuperAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Load organizations and user role
  useEffect(() => {
    if (user) {
      loadOrganizations();
      checkSuperAdmin();
    } else {
      setOrganizations([]);
      setSelectedOrg(null);
      setSelectedOrgId(null);
      setUserRole(null);
      setIsSuperAdmin(false);
      setIsLoading(false);
    }
  }, [user]);

  // Update selected organization when selectedOrgId changes
  useEffect(() => {
    if (selectedOrgId && organizations.length > 0) {
      const org = organizations.find(o => o.id === selectedOrgId);
      setSelectedOrg(org || null);
      loadUserRole(selectedOrgId);
      
      // Save to localStorage for persistence
      localStorage.setItem('selectedOrgId', selectedOrgId);
    }
  }, [selectedOrgId, organizations]);

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

  const loadOrganizations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Get organizations where user is a member
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;

      const orgIds = memberships?.map(m => m.organization_id) || [];

      if (orgIds.length > 0) {
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('*')
          .in('id', orgIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (orgsError) throw orgsError;

        setOrganizations(orgs || []);

        // Auto-select first org or restore from localStorage
        if (orgs && orgs.length > 0) {
          const savedOrgId = localStorage.getItem('selectedOrgId');
          const orgToSelect = orgs.find(o => o.id === savedOrgId) || orgs[0];
          setSelectedOrgId(orgToSelect.id);
        }
      } else {
        setOrganizations([]);
      }
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les organisations',
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

  const selectOrganization = (orgId: string) => {
    setSelectedOrgId(orgId);
  };

  const refreshOrganizations = async () => {
    await loadOrganizations();
  };

  const createOrganization = async (data: Partial<Organization>): Promise<Organization | null> => {
    if (!user) return null;

    try {
      // Generate slug from name
      const slug = data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          slug,
          logo_url: data.logo_url,
          primary_color: data.primary_color || '#8B5CF6',
          domain: data.domain,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add creator as member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          user_id: user.id,
          organization_id: org.id,
          accepted_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      // Assign org_admin role to creator
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          organization_id: org.id,
          role: 'org_admin',
        });

      if (roleError) throw roleError;

      toast({
        title: 'Organisation créée',
        description: `${org.name} a été créée avec succès`,
      });

      await refreshOrganizations();
      return org;
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer l\'organisation',
        variant: 'destructive',
      });
      return null;
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        selectedOrg,
        selectedOrgId,
        userRole,
        isLoading,
        selectOrganization,
        refreshOrganizations,
        createOrganization,
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
