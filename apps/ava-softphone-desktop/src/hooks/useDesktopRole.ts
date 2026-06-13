import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type DesktopRole = 'normal' | 'org_admin' | 'super_admin';

export function useDesktopRole() {
  const [role, setRole] = useState<DesktopRole>('normal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) { setRole('normal'); setLoading(false); } return; }

        try {
          const { data: isSuper } = await supabase.rpc('is_super_admin', { _user_id: user.id } as any);
          if (isSuper && !cancelled) { setRole('super_admin'); setLoading(false); return; }
        } catch { /* fn may not exist in some envs */ }

        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const isSuper = (roles || []).some((r: any) => r.role === 'super_admin');
        if (isSuper) { if (!cancelled) { setRole('super_admin'); setLoading(false); } return; }
        const admin = (roles || []).some((r: any) =>
          r.role === 'org_admin' || r.role === 'reseller_admin' || r.role === 'manager'
        );
        if (!cancelled) { setRole(admin ? 'org_admin' : 'normal'); setLoading(false); }
      } catch {
        if (!cancelled) { setRole('normal'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return {
    role,
    isAdmin: role === 'org_admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    loading,
  };
}
