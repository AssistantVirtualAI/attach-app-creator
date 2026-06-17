import { supabase } from '@/integrations/supabase/client';

export type ResellerRole =
  | 'ava_admin'
  | 'master_admin'
  | 'reseller_admin'
  | 'customer_admin'
  | 'agent'
  | 'user';

const ROLE_PRIORITY: Record<ResellerRole, number> = {
  ava_admin: 0,
  master_admin: 1,
  reseller_admin: 2,
  customer_admin: 3,
  agent: 4,
  user: 5,
};

/**
 * Determine where to send a user after they log in.
 * Uses the three-portal architecture:
 *   - super_admin / ava_admin / master_admin     → /platform
 *   - reseller_admin / customer_admin / org_admin / manager → /customer
 *   - everyone else                              → /my
 */
export async function getPostLoginRoute(userId: string): Promise<string> {
  try {
    // 1. Super admin (global) or Lemtel admin — highest priority → platform portal
    const [{ data: isSuper }, { data: isLemtelAdmin }] = await Promise.all([
      supabase.rpc('is_super_admin', { _user_id: userId }),
      supabase.rpc('is_lemtel_admin', { _user_id: userId }),
    ]);
    if (isSuper === true || isLemtelAdmin === true) return '/platform';


    // 2. Reseller-tier roles from org_members
    const { data: orgMemberRows } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', userId)
      .limit(20);

    const orgRoles = (orgMemberRows || []).map((r: any) => r.role as ResellerRole);
    if (orgRoles.includes('ava_admin') || orgRoles.includes('master_admin')) return '/platform';
    if (orgRoles.includes('reseller_admin') || orgRoles.includes('customer_admin')) return '/customer';

    // 3. App-role from user_roles
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const appRoles = (userRoles || []).map((r: any) => r.role as string);
    if (appRoles.includes('org_admin') || appRoles.includes('reseller_admin') || appRoles.includes('manager')) {
      return '/customer';
    }

    return '/my';
  } catch {
    return '/my';
  }
}
