-- Restrict org_chat_channels UPDATE to creator, channel members, or org_admin
DROP POLICY IF EXISTS "org members update own channels" ON public.org_chat_channels;
CREATE POLICY "channel update restricted"
  ON public.org_chat_channels
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      created_by = auth.uid()
      OR auth.uid() = ANY(COALESCE(members, ARRAY[]::uuid[]))
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR public.is_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      created_by = auth.uid()
      OR auth.uid() = ANY(COALESCE(members, ARRAY[]::uuid[]))
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR public.is_super_admin(auth.uid())
    )
  );

-- Restrict cc_monitor_sessions write to supervisors/admins
DROP POLICY IF EXISTS org_cc_monitor_sessions_all ON public.cc_monitor_sessions;
CREATE POLICY org_cc_monitor_sessions_select
  ON public.cc_monitor_sessions
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY org_cc_monitor_sessions_write
  ON public.cc_monitor_sessions
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.is_cc_supervisor(auth.uid())
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR public.is_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.is_cc_supervisor(auth.uid())
      OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR public.is_super_admin(auth.uid())
    )
  );

-- Restrict cc_pause_reasons write to admins/managers
DROP POLICY IF EXISTS org_cc_pause_reasons_write ON public.cc_pause_reasons;
CREATE POLICY org_cc_pause_reasons_write
  ON public.cc_pause_reasons
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
      OR public.is_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.current_user_org_ids())
    AND (
      public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
      OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
      OR public.is_super_admin(auth.uid())
    )
  );