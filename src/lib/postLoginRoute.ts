import { supabase } from '@/integrations/supabase/client';
import { PLANIPRET_ORG_ID, LEMTEL_ORG_ID, AVA_STANDALONE_ORG_ID } from '@/lib/avaOwner';

export type ResellerRole =
  | 'ava_admin'
  | 'master_admin'
  | 'reseller_admin'
  | 'customer_admin'
  | 'agent'
  | 'user';

/**
 * Determine where to send a user after they log in.
 * Routes to the dashboard for the org they belong to:
 *   - Planipret admin/member          → /planipret/admin/overview
 *   - Lemtel admin                    → /lemtel/dashboard
 *   - Lemtel end-user                 → /org/lemtel/my/dashboard
 *   - AVA super_admin / master_admin  → /dashboard (AVA platform)
 *   - Org admins of other orgs        → /dashboard
 *   - Fallback                        → /portals
 */
export async function getPostLoginRoute(userId: string): Promise<string> {
  try {
    const [
      superResult,
      planipretAdminResult,
      planipretMemberResult,
      lemtelAdminResult,
      lemtelMemberResult,
      orgMembersResult,
      userRolesResult,
    ] = await Promise.allSettled([
      supabase.rpc('is_super_admin', { _user_id: userId }),
      supabase.rpc('is_planipret_admin', { _user_id: userId }),
      supabase.rpc('is_planipret_member', { _user_id: userId }),
      supabase.rpc('is_lemtel_admin', { _user_id: userId }),
      supabase.rpc('is_lemtel_member', { _user_id: userId }),
      supabase.from('org_members').select('role, organization_id').eq('user_id', userId).limit(50),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);

    const ok = (r: any) => r.status === 'fulfilled' && r.value?.data === true;
    const isSuper = ok(superResult);
    const isPlanipretAdmin = ok(planipretAdminResult);
    const isPlanipretMember = ok(planipretMemberResult);
    const isLemtelAdmin = ok(lemtelAdminResult);
    const isLemtelMember = ok(lemtelMemberResult);

    const orgRows = orgMembersResult.status === 'fulfilled' ? (orgMembersResult.value.data || []) : [];
    const appRoles = userRolesResult.status === 'fulfilled'
      ? (userRolesResult.value.data || []).map((r: any) => r.role as string)
      : [];

    const inAvaStandalone = orgRows.some((r: any) => r.organization_id === AVA_STANDALONE_ORG_ID);

    // AVA super admin platform
    if (isSuper || appRoles.includes('super_admin')) {
      if (inAvaStandalone) return '/platform';
      return '/dashboard';
    }

    // Planipret org (admins and members both land on the Planipret admin portal)
    if (isPlanipretAdmin || isPlanipretMember) {
      return '/planipret/admin/overview';
    }

    // Lemtel routing
    if (isLemtelAdmin) return '/lemtel/dashboard';
    if (isLemtelMember) return '/org/lemtel/my/dashboard';

    // Generic org admin → unified dashboard with switcher
    const orgRoles = orgRows.map((r: any) => r.role as string);
    if (
      orgRoles.includes('ava_admin') ||
      orgRoles.includes('master_admin') ||
      orgRoles.includes('reseller_admin') ||
      orgRoles.includes('customer_admin') ||
      appRoles.includes('org_admin') ||
      appRoles.includes('manager')
    ) {
      return '/dashboard';
    }

    // Member of at least one org → dashboard with org switcher
    if (orgRows.length > 0) return '/dashboard';

    // No org context — let them pick
    return '/portals';
  } catch {
    return '/dashboard';
  }
}
