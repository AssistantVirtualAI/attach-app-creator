/**
 * useOrgId — resolve the current user's organization once via getMeContext
 * (cached server-side scope), so realtime subscriptions can filter to the
 * right tenant. Returns null while loading or if no scope is available.
 */
import { useEffect, useState } from 'react';
import { getMeContext } from './avaApi';

export function useOrgId(): string | null {
  const [orgId, setOrgId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMeContext().then((me) => { if (!cancelled) setOrgId(me.organization_id || null); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return orgId;
}
