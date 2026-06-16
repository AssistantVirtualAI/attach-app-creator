import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type DesktopRole = 'normal' | 'org_admin' | 'super_admin';

const LEMTEL_ORG_ID = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

export function useDesktopRole(orgId?: string | null) {
  const [role, setRole] = useState<DesktopRole>('normal');
  const [ccRole, setCcRole] = useState<'none' | 'agent' | 'supervisor' | 'admin'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) { setRole('normal'); setCcRole('none'); setLoading(false); } return; }

        // 1) super admin?
        try {
          const { data: isSuper } = await supabase.rpc('is_super_admin', { _user_id: user.id } as any);
          if (isSuper && !cancelled) { setRole('super_admin'); }
        } catch { /* noop */ }

        // 2) lemtel admin?
        let isLemtel = false;
        try {
          const { data } = await supabase.rpc('is_lemtel_admin', { _user_id: user.id } as any);
          isLemtel = !!data;
        } catch { /* noop */ }

        // 3) org_admin / manager / reseller_admin in the current org (or any)
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role, organization_id')
          .eq('user_id', user.id);
        const elevated = (roles || []).some((r: any) => {
          if (!['org_admin', 'manager', 'reseller_admin', 'super_admin'].includes(r.role)) return false;
          if (!orgId) return true;
          return r.organization_id === orgId || r.organization_id === LEMTEL_ORG_ID;
        });
        const superFromRoles = (roles || []).some((r: any) => r.role === 'super_admin');

        // 4) cc_role from softphone user row
        const { data: spu } = await supabase
          .from('pbx_softphone_users')
          .select('cc_role')
          .eq('portal_user_id', user.id)
          .maybeSingle();
        const cc = (spu?.cc_role || 'none') as any;

        if (cancelled) return;
        if (superFromRoles) setRole('super_admin');
        else if (isLemtel || elevated) setRole((prev) => prev === 'super_admin' ? prev : 'org_admin');
        else setRole((prev) => prev === 'super_admin' ? prev : 'normal');
        setCcRole(cc);
        setLoading(false);
      } catch {
        if (!cancelled) { setRole('normal'); setCcRole('none'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  return {
    role,
    ccRole,
    isAdmin: role === 'org_admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    isSupervisor: ccRole === 'supervisor' || ccRole === 'admin' || role === 'org_admin' || role === 'super_admin',
    loading,
  };
}
