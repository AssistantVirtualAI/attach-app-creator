import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hides children (typically <SoftphoneWidget/>) when the current user has been
 * denied app access by an admin via `pbx_softphone_users.app_access_enabled`.
 * Defaults to ALLOWED while loading or if the user has no extension at all
 * (back-office users without a softphone are unaffected).
 */
export function AppAccessGate({ children }: { children: ReactNode }) {
  const { data: allowed = true } = useQuery({
    queryKey: ['app-access-allowed'],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('my_app_access_allowed');
      return data !== false;
    },
    staleTime: 60_000,
  });
  if (!allowed) return null;
  return <>{children}</>;
}
