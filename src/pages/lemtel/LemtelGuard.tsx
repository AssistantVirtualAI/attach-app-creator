import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useLemtelAccess } from '@/hooks/useLemtelAccess';
import { AppLayout } from '@/components/layout/AppLayout';

/**
 * Guards Lemtel/telephony routes. AVA-only users (not a Lemtel member and
 * not a super admin) are redirected to /dashboard so they never see
 * phone-system pages or data.
 */
export function LemtelGuard({ children }: { children: ReactNode }) {
  const { isMember } = useLemtelAccess();
  if (!isMember) {
    return <Navigate to="/dashboard" replace />;
  }
  return <AppLayout>{children}</AppLayout>;
}
