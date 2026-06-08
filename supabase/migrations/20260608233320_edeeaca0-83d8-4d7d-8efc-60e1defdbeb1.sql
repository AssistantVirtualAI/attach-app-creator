
-- 1. calendar_integrations: hide OAuth tokens from API; access via service role only
REVOKE SELECT (access_token, refresh_token) ON public.calendar_integrations FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.calendar_integrations FROM anon;

-- 2. organization_integrations: hide raw api_key; fix UPDATE policy
REVOKE SELECT (api_key) ON public.organization_integrations FROM authenticated;
REVOKE SELECT (api_key) ON public.organization_integrations FROM anon;

DROP POLICY IF EXISTS "Admins and creators can update integrations" ON public.organization_integrations;
CREATE POLICY "Admins and creators can update integrations"
ON public.organization_integrations FOR UPDATE TO authenticated
USING (
  (organization_id IS NOT NULL AND (public.has_role(auth.uid(), organization_id, 'org_admin'::app_role) OR public.is_super_admin(auth.uid())))
  OR (organization_id IS NULL AND user_id = auth.uid())
)
WITH CHECK (
  (organization_id IS NOT NULL AND (public.has_role(auth.uid(), organization_id, 'org_admin'::app_role) OR public.is_super_admin(auth.uid())))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- 3. webhook_endpoints: hide signing secret
REVOKE SELECT (secret) ON public.webhook_endpoints FROM authenticated;
REVOKE SELECT (secret) ON public.webhook_endpoints FROM anon;

-- 4. agent_platform_webhooks: hide signing secret
REVOKE SELECT (webhook_secret) ON public.agent_platform_webhooks FROM authenticated;
REVOKE SELECT (webhook_secret) ON public.agent_platform_webhooks FROM anon;

-- 5. lemtel_config: hide value column (may contain secrets)
REVOKE SELECT (value) ON public.lemtel_config FROM authenticated;
REVOKE SELECT (value) ON public.lemtel_config FROM anon;

-- 6. cc_agent_activity: restrict INSERT to cc agents / supervisors / admins
DROP POLICY IF EXISTS org_cc_agent_activity_insert ON public.cc_agent_activity;
CREATE POLICY org_cc_agent_activity_insert ON public.cc_agent_activity
FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (SELECT public.current_user_org_ids())
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
    OR public.is_cc_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pbx_softphone_users spu
      WHERE spu.portal_user_id = auth.uid()
        AND spu.organization_id = cc_agent_activity.organization_id
        AND spu.cc_role IN ('agent','supervisor','admin')
    )
  )
);

-- 7. pbx_voicemails: only owners of the extension, supervisors, and admins can read
DROP POLICY IF EXISTS "org members read voicemails" ON public.pbx_voicemails;
CREATE POLICY "voicemails owner or admin read" ON public.pbx_voicemails
FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT public.current_user_org_ids())
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
    OR public.is_cc_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pbx_softphone_users spu
      WHERE spu.organization_id = pbx_voicemails.organization_id
        AND spu.extension = pbx_voicemails.extension
        AND spu.portal_user_id = auth.uid()
    )
  )
);

-- 8. pbx_softphone_users: hide SIP infrastructure columns from non-admin reads
REVOKE SELECT (sip_domain, wss_url) ON public.pbx_softphone_users FROM authenticated;
REVOKE SELECT (sip_domain, wss_url) ON public.pbx_softphone_users FROM anon;
