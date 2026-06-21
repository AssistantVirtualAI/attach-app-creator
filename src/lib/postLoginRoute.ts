import { supabase } from '@/integrations/supabase/client';

export type ResellerRole =
  | 'ava_admin'
  | 'master_admin'
  | 'reseller_admin'
  | 'customer_admin'
  | 'agent'
  | 'user';

/**
 * Determine where to send a user after they log in.
 * Uses the three-portal architecture:
 *   - super_admin / ava_admin / master_admin     → /platform
 *   - reseller_admin / customer_admin / org_admin / manager → /customer
 *   - everyone else                              → /my
 */
export async function getPostLoginRoute(userId: string): Promise<string> {
  try {
    const [superResult, lemtelResult, orgMembersResult, userRolesResult] = await Promise.allSettled([
      supabase.rpc('is_super_admin', { _user_id: userId }),
      supabase.rpc('is_lemtel_admin', { _user_id: userId }),
      supabase.from('org_members').select('role').eq('user_id', userId).limit(20),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);

    const isSuper = superResult.status === 'fulfilled' && superResult.value.data === true;
    const isLemtelAdmin = lemtelResult.status === 'fulfilled' && lemtelResult.value.data === true;
    const orgMemberRows = orgMembersResult.status === 'fulfilled' ? orgMembersResult.value.data : [];
    const userRoles = userRolesResult.status === 'fulfilled' ? userRolesResult.value.data : [];

    const orgRoles = (orgMemberRows || []).map((r: any) => r.role as string);
    const appRoles = (userRoles || []).map((r: any) => r.role as string);

    // Highest priority: platform/admin roles. Use direct role rows as fallback if RPC is slow or blocked.
    if (
      isSuper ||
      isLemtelAdmin ||
      appRoles.includes('super_admin') ||
      orgRoles.includes('ava_admin') ||
      orgRoles.includes('master_admin')
    ) {
      return '/platform';
    }

    if (orgRoles.includes('ava_admin') || orgRoles.includes('master_admin')) return '/platform';
    if (orgRoles.includes('reseller_admin') || orgRoles.includes('customer_admin')) return '/customer';

    if (appRoles.includes('org_admin') || appRoles.includes('reseller_admin') || appRoles.includes('manager')) {
      return '/customer';
    }

    return '/dashboard';
  } catch {
    return '/dashboard';

  }
}
