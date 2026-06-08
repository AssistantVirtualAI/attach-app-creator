
-- 1) REVOKE credential columns from client roles
REVOKE SELECT (sip_password) ON public.lemtel_softphone_users FROM authenticated, anon;
REVOKE SELECT (sip_password) ON public.pbx_softphone_users FROM authenticated, anon;
REVOKE SELECT (password, voicemail_password) ON public.pbx_extensions FROM authenticated, anon;

-- 2) cc_report_schedules: split read-all / write-restricted
DROP POLICY IF EXISTS org_cc_report_schedules_all ON public.cc_report_schedules;

CREATE POLICY cc_report_schedules_select
  ON public.cc_report_schedules FOR SELECT
  USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY cc_report_schedules_write
  ON public.cc_report_schedules FOR ALL
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_cc_supervisor(auth.uid())
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_cc_supervisor(auth.uid())
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
    )
  );

-- 3) pbx_queue_agent_state: restrict SELECT to own row or supervisor/admin
DROP POLICY IF EXISTS "org members read queue state" ON public.pbx_queue_agent_state;

CREATE POLICY "queue state read own or supervisor"
  ON public.pbx_queue_agent_state FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      organization_id IN (SELECT public.current_user_org_ids())
      AND (
        public.is_super_admin(auth.uid())
        OR public.is_cc_supervisor(auth.uid())
        OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
        OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
      )
    )
  );

-- 4) pbx_voicemails: restrict UPDATE/DELETE to owner or admin
DROP POLICY IF EXISTS "org members delete voicemails" ON public.pbx_voicemails;
DROP POLICY IF EXISTS "org members manage voicemails" ON public.pbx_voicemails;

CREATE POLICY "voicemails owner or admin update"
  ON public.pbx_voicemails FOR UPDATE
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.pbx_softphone_users spu
        WHERE spu.organization_id = pbx_voicemails.organization_id
          AND spu.extension = pbx_voicemails.extension
          AND spu.portal_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.pbx_softphone_users spu
        WHERE spu.organization_id = pbx_voicemails.organization_id
          AND spu.extension = pbx_voicemails.extension
          AND spu.portal_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "voicemails owner or admin delete"
  ON public.pbx_voicemails FOR DELETE
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.pbx_softphone_users spu
        WHERE spu.organization_id = pbx_voicemails.organization_id
          AND spu.extension = pbx_voicemails.extension
          AND spu.portal_user_id = auth.uid()
      )
    )
  );

-- 5) org_chat_channels SELECT: enforce private channel membership
DROP POLICY IF EXISTS "org members read channels" ON public.org_chat_channels;

CREATE POLICY "channel read membership"
  ON public.org_chat_channels FOR SELECT
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      channel_type = 'public'
      OR created_by = auth.uid()
      OR auth.uid() = ANY (members)
      OR public.is_super_admin(auth.uid())
    )
  );

-- Helper to check channel access without RLS recursion
CREATE OR REPLACE FUNCTION public.can_access_chat_channel(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_chat_channels c
    WHERE c.id = _channel_id
      AND c.organization_id IN (SELECT public.current_user_org_ids())
      AND (
        c.channel_type = 'public'
        OR c.created_by = _user_id
        OR _user_id = ANY (c.members)
        OR public.is_super_admin(_user_id)
      )
  );
$$;

-- 6) org_chat_messages SELECT/INSERT: require channel access
DROP POLICY IF EXISTS "org members read messages" ON public.org_chat_messages;
DROP POLICY IF EXISTS "org members send messages" ON public.org_chat_messages;

CREATE POLICY "messages read via channel"
  ON public.org_chat_messages FOR SELECT
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    AND public.can_access_chat_channel(channel_id, auth.uid())
  );

CREATE POLICY "messages insert via channel"
  ON public.org_chat_messages FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT public.current_user_org_ids())
    AND sender_id = auth.uid()
    AND public.can_access_chat_channel(channel_id, auth.uid())
  );

-- 7) two_factor_otps table for server-side hashed verification
CREATE TABLE IF NOT EXISTS public.two_factor_otps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  organization_id uuid NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.two_factor_otps TO service_role;
-- No grants to authenticated/anon: only service role (edge functions) accesses it.

ALTER TABLE public.two_factor_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only"
  ON public.two_factor_otps FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS two_factor_otps_email_org_idx
  ON public.two_factor_otps (email, organization_id, expires_at DESC);
