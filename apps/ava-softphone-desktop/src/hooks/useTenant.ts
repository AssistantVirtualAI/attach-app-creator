import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Resolves the current user's primary tenant (organization) the same way the web portal does.
 * Single-tenant model: returns the first org the user belongs to.
 */
export function useTenant() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [extension, setExtension] = useState<string | null>(null);
  const [domainUuid, setDomainUuid] = useState<string | null>(null);
  const [domainName, setDomainName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) { setOrgId(null); setDomainUuid(null); setDomainName(null); setLoading(false); }
          return;
        }

        // Prefer pbx_softphone_users (the actual softphone tenant binding)
        const { data: spu } = await supabase
          .from('pbx_softphone_users')
          .select('organization_id, extension')
          .eq('portal_user_id', user.id)
          .limit(1)
          .maybeSingle();

        let resolvedOrg: string | null = spu?.organization_id ?? null;
        if (spu?.extension && !cancelled) setExtension(spu.extension);

        if (!resolvedOrg) {
          const { data: mem } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          resolvedOrg = mem?.organization_id ?? null;
        }

        if (resolvedOrg) {
          const { data: org } = await supabase
            .from('organizations')
            .select('name,fusionpbx_domain_uuid,fusionpbx_domain_name')
            .eq('id', resolvedOrg)
            .maybeSingle();
          if (!cancelled) {
            setOrgName(org?.name ?? null);
            if (org?.fusionpbx_domain_uuid) setDomainUuid(org.fusionpbx_domain_uuid);
            if (org?.fusionpbx_domain_name) setDomainName(org.fusionpbx_domain_name);
          }
        }

        if (!cancelled) { setOrgId(resolvedOrg); setLoading(false); }
      } catch {
        if (!cancelled) { setOrgId(null); setDomainUuid(null); setDomainName(null); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { orgId, orgName, extension, domainUuid, domainName, loading };
}
