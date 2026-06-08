import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Three-portal post-login routing:
 *  - super_admin / master_admin           → /platform
 *  - org_admin / reseller_admin           → /customer
 *  - agent / user / everyone else         → /my
 */
export default function PostLoginRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: superAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
        if (superAdmin) {
          navigate('/platform', { replace: true });
          return;
        }

        const { data: masterRow } = await supabase
          .from('org_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'master_admin')
          .maybeSingle();
        if (masterRow) {
          navigate('/platform', { replace: true });
          return;
        }

        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const isAdmin = roles?.some((r: any) =>
          r.role === 'org_admin' || r.role === 'reseller_admin' || r.role === 'manager'
        );
        if (isAdmin) {
          navigate('/customer', { replace: true });
          return;
        }

        navigate('/my', { replace: true });
      } catch {
        navigate('/my', { replace: true });
      }
    })();
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Redirecting…
    </div>
  );
}
