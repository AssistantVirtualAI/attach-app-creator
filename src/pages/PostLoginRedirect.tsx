import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

/**
 * Smart redirect after login based on the user's highest role.
 *  - super_admin / master_admin → /admin/dashboard
 *  - org_admin (Lemtel member)  → /org/<slug>/dashboard
 *  - org_admin (other org)      → /home (legacy AVA workspace)
 *  - everyone else              → /my/dashboard
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
          navigate('/admin/dashboard', { replace: true });
          return;
        }

        const { data: masterRow } = await supabase
          .from('org_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'master_admin')
          .maybeSingle();
        if (masterRow) {
          navigate('/admin/dashboard', { replace: true });
          return;
        }

        const { data: roles } = await supabase
          .from('user_roles')
          .select('role, organization_id, organizations!inner(slug)')
          .eq('user_id', user.id);

        const adminRow = roles?.find((r: any) => r.role === 'org_admin');
        if (adminRow) {
          const slug = (adminRow as any).organizations?.slug;
          navigate(slug ? `/org/${slug}/dashboard` : '/home', { replace: true });
          return;
        }

        navigate('/my/dashboard', { replace: true });
      } catch {
        navigate('/home', { replace: true });
      }
    })();
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Redirecting…
    </div>
  );
}
