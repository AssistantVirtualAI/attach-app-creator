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
 * Determine where to send a user after they log in, based on their highest-privilege
 * membership in `org_members`. Falls back to `/my/dashboard` if no membership exists.
 */
export async function getPostLoginRoute(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('org_members')
    .select('role, organizations:org_id(slug, org_type)')
    .eq('user_id', userId)
    .limit(20);

  if (error || !data?.length) return '/my/dashboard';

  const sorted = [...data].sort(
    (a, b) =>
      (ROLE_PRIORITY[a.role as ResellerRole] ?? 99) -
      (ROLE_PRIORITY[b.role as ResellerRole] ?? 99),
  );
  const primary = sorted[0] as any;
  const slug = primary.organizations?.slug;

  switch (primary.role as ResellerRole) {
    case 'ava_admin':
    case 'master_admin':
      return '/admin/dashboard';
    case 'reseller_admin':
    case 'customer_admin':
      return slug ? `/org/${slug}/dashboard` : '/dashboard';
    case 'agent':
    case 'user':
    default:
      return '/my/dashboard';
  }
}
