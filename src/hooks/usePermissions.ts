import { useMemo } from 'react';
import { useOrganization } from '@/context/OrganizationContext';

export type Permission = 
  | 'read:conversations'
  | 'create:conversations'
  | 'edit:conversations'
  | 'delete:conversations'
  | 'read:analytics'
  | 'read:knowledge_base'
  | 'create:knowledge_base'
  | 'edit:knowledge_base'
  | 'delete:knowledge_base'
  | 'read:agent_config'
  | 'edit:agent_config'
  | 'read:integrations'
  | 'edit:integrations'
  | 'manage:members'
  | 'manage:roles'
  | 'manage:organization'
  | 'manage:api_keys';

export type Role = 'super_admin' | 'org_admin' | 'manager' | 'agent' | 'viewer';

// Permission matrix: what each role can do
const PERMISSIONS_MATRIX: Record<Role, Permission[]> = {
  super_admin: [
    'read:conversations',
    'create:conversations',
    'edit:conversations',
    'delete:conversations',
    'read:analytics',
    'read:knowledge_base',
    'create:knowledge_base',
    'edit:knowledge_base',
    'delete:knowledge_base',
    'read:agent_config',
    'edit:agent_config',
    'read:integrations',
    'edit:integrations',
    'manage:members',
    'manage:roles',
    'manage:organization',
    'manage:api_keys',
  ],
  org_admin: [
    'read:conversations',
    'create:conversations',
    'edit:conversations',
    'delete:conversations',
    'read:analytics',
    'read:knowledge_base',
    'create:knowledge_base',
    'edit:knowledge_base',
    'delete:knowledge_base',
    'read:agent_config',
    'edit:agent_config',
    'read:integrations',
    'edit:integrations',
    'manage:members',
    'manage:roles',
    'manage:organization',
    'manage:api_keys',
  ],
  manager: [
    'read:conversations',
    'create:conversations',
    'edit:conversations',
    'delete:conversations',
    'read:analytics',
    'read:knowledge_base',
    'create:knowledge_base',
    'edit:knowledge_base',
    'delete:knowledge_base',
    'read:agent_config',
    'edit:agent_config',
    'manage:members',
  ],
  agent: [
    'read:conversations',
    'create:conversations',
    'edit:conversations',
    'read:analytics',
    'read:knowledge_base',
    'create:knowledge_base',
    'edit:knowledge_base',
    'read:agent_config',
  ],
  viewer: [
    'read:conversations',
    'read:analytics',
    'read:knowledge_base',
    'read:agent_config',
  ],
};

export const usePermissions = () => {
  const { userRole, isSuperAdmin } = useOrganization();

  const permissions = useMemo(() => {
    if (isSuperAdmin) {
      return new Set(PERMISSIONS_MATRIX.super_admin);
    }
    
    if (!userRole) {
      return new Set<Permission>();
    }

    return new Set(PERMISSIONS_MATRIX[userRole.role] || []);
  }, [userRole, isSuperAdmin]);

  const can = (permission: Permission): boolean => {
    return permissions.has(permission);
  };

  const canAny = (...perms: Permission[]): boolean => {
    return perms.some(p => permissions.has(p));
  };

  const canAll = (...perms: Permission[]): boolean => {
    return perms.every(p => permissions.has(p));
  };

  const isRole = (...roles: Role[]): boolean => {
    if (isSuperAdmin && roles.includes('super_admin')) return true;
    if (!userRole) return false;
    return roles.includes(userRole.role);
  };

  return {
    can,
    canAny,
    canAll,
    isRole,
    role: userRole?.role,
    isSuperAdmin,
    permissions: Array.from(permissions),
  };
};
