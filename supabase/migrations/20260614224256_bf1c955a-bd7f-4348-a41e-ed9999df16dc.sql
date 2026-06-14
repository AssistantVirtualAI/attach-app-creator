
-- 1. billing_config: revoke Stripe IDs from client roles
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.billing_config FROM authenticated, anon;

-- 2. organization_integrations: revoke api_key from client roles
REVOKE SELECT (api_key) ON public.organization_integrations FROM authenticated, anon;

-- 3. organizations: revoke sensitive credentials
REVOKE SELECT (stripe_customer_id, fusionpbx_domain_uuid, fusionpbx_domain_name, fusionpbx_server_url, api_key)
  ON public.organizations FROM authenticated, anon;

-- 4. pbx_conferences: revoke PINs
REVOKE SELECT (pin, moderator_pin) ON public.pbx_conferences FROM authenticated, anon;

-- 5. pbx_softphone_users: revoke sip_password
REVOKE SELECT (sip_password) ON public.pbx_softphone_users FROM authenticated, anon;

-- 6. pbx_extensions: remove from Realtime publication so SIP/voicemail passwords aren't broadcast
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pbx_extensions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.pbx_extensions';
  END IF;
END $$;

-- 7. Tighten Realtime topic policy: only the user's direct orgs (no child-org expansion)
DROP POLICY IF EXISTS "auth org members realtime read" ON realtime.messages;
CREATE POLICY "auth org members realtime read"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (realtime.topic())::uuid IN (SELECT public.current_user_org_ids())
  );
