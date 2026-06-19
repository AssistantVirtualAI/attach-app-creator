import { useEffect, useState } from 'react';
import { Store, Creds, hydrateSoftphoneCredentials } from '../lib/creds';

/**
 * Shared mobile credentials hook. Returns the SIP domain context every screen
 * needs (extension, domainUuid, sipDomain, organizationId, wssUrl, tokens).
 *
 * Reads stored creds first, then falls back to hydrating from the
 * `softphone-credentials` edge function if extension/domainUuid are missing.
 * Persists the hydrated value so subsequent calls are instant.
 */
export function useMobileCredentials() {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await Store.get();
      if (cancelled) return;
      if (stored?.extension && (stored.domainUuid || stored.fusionpbxDomainUuid) && stored.organizationId) {
        setCreds(stored);
        setLoading(false);
        return;
      }
      const hydrated = await hydrateSoftphoneCredentials('mobile').catch(() => null);
      if (cancelled) return;
      setCreds(hydrated || stored || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return {
    creds,
    loading,
    extension: creds?.extension || null,
    sipDomain: creds?.sipDomain || null,
    domainUuid: (creds?.domainUuid || creds?.fusionpbxDomainUuid) ?? null,
    organizationId: creds?.organizationId || null,
    wssUrl: creds?.wssUrl || null,
    userId: creds?.userId || null,
    accessToken: creds?.accessToken || null,
  };
}
