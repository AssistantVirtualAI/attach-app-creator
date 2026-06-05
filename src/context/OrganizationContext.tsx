import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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

interface UserRole {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'super_admin' | 'org_admin' | 'manager' | 'agent' | 'viewer';
  created_at: string;
}

export interface OrganizationMembershipStatus {
  organization: Organization;
  role: UserRole['role'] | null;
  accepted_at: string | null;
  isSelected: boolean;
}

interface OrganizationContextType {
  selectedOrg: Organization | null;
  selectedOrgId: string | null;
  organizations: Organization[];
  organizationMemberships: OrganizationMembershipStatus[];
  userRole: UserRole | null;
  isLoading: boolean;
  refreshOrganization: () => Promise<void>;
  setSelectedOrgId: (id: string) => void;
  isSuperAdmin: boolean;
}

const SELECTED_ORG_KEY = 'selected_organization_id';

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationMemberships, setOrganizationMemberships] = useState<OrganizationMembershipStatus[]>([]);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      loadOrganizations();
      checkSuperAdmin();
    } else {
      setOrganizations([]);
      setOrganizationMemberships([]);
      setSelectedOrg(null);
      setSelectedOrgIdState(null);
      setUserRole(null);
      setIsSuperAdmin(false);
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedOrgId) {
      const org = organizations.find((o) => o.id === selectedOrgId) || null;
      setSelectedOrg(org);
      loadUserRole(selectedOrgId);
      try { localStorage.setItem(SELECTED_ORG_KEY, selectedOrgId); } catch {}
    }
  }, [selectedOrgId, organizations]);

  const checkSuperAdmin = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();
      setIsSuperAdmin(!!data);
    } catch {
      setIsSuperAdmin(false);
    }
  };

  const loadOrganizations = async () => {
    if (!user) return;
    try {
      setIsLoading(true);

      const { data: memberships, error: mErr } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);

      if (mErr) throw mErr;

      const orgIds = (memberships || []).map((m) => m.organization_id);
      if (orgIds.length === 0) {
        setOrganizations([]);
        setSelectedOrg(null);
        setSelectedOrgIdState(null);
        return;
      }

      const { data: orgs, error: oErr } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)
        .eq('is_active', true)
        .order('name');

      if (oErr) throw oErr;
      const list = (orgs || []) as Organization[];
      setOrganizations(list);

      // Pick selected: localStorage > current > first
      const stored = (() => { try { return localStorage.getItem(SELECTED_ORG_KEY); } catch { return null; } })();
      const next =
        (stored && list.find((o) => o.id === stored)) ||
        (selectedOrgId && list.find((o) => o.id === selectedOrgId)) ||
        list[0];
      if (next) {
        setSelectedOrgIdState(next.id);
        setSelectedOrg(next);
      }
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      toast({
        title: 'Erreur',
        description: "Impossible de charger les organisations",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserRole = async (orgId: string) => {
    if (!user || !orgId) return;
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .maybeSingle();
      setUserRole(data);
    } catch {
      setUserRole(null);
    }
  };

  const setSelectedOrgId = (id: string) => {
    setSelectedOrgIdState(id);
  };

  const refreshOrganization = async () => {
    await loadOrganizations();
  };

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrg,
        selectedOrgId,
        organizations,
        userRole,
        isLoading,
        refreshOrganization,
        setSelectedOrgId,
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
