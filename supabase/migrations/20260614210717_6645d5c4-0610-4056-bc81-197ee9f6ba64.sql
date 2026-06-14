-- Helper: check if a call record belongs to the caller's own softphone extension
CREATE OR REPLACE FUNCTION public.is_my_extension_call(_org_id uuid, _extension text, _caller text, _destination text, _source text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pbx_softphone_users s
    WHERE s.portal_user_id = auth.uid()
      AND s.organization_id = _org_id
      AND (
        s.extension = _extension
        OR s.extension = _caller
        OR s.extension = _destination
        OR s.extension = _source
      )
  )
$$;

-- pbx_call_records: replace broad SELECT policies
DROP POLICY IF EXISTS "Org members can view accessible call records" ON public.pbx_call_records;
DROP POLICY IF EXISTS "Managers and admins can view call records" ON public.pbx_call_records;
DROP POLICY IF EXISTS "Softphone users can view own call records" ON public.pbx_call_records;

CREATE POLICY "Admins managers view all org call records"
ON public.pbx_call_records
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
  OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
);

CREATE POLICY "Softphone users view own extension call records"
ON public.pbx_call_records
FOR SELECT
TO authenticated
USING (
  public.is_my_extension_call(
    organization_id, extension, caller_number, destination_number, source_number
  )
);

-- pbx_call_recordings: scope via parent call record
DROP POLICY IF EXISTS "org_members_select" ON public.pbx_call_recordings;

CREATE POLICY "Admins view all org call recordings"
ON public.pbx_call_recordings
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
  OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
);

CREATE POLICY "Softphone users view own call recordings"
ON public.pbx_call_recordings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pbx_call_records r
    WHERE r.id = pbx_call_recordings.call_record_id
      AND public.is_my_extension_call(
        r.organization_id, r.extension, r.caller_number, r.destination_number, r.source_number
      )
  )
);

-- pbx_sms_threads: scope by assigned user
DROP POLICY IF EXISTS "org_members_select" ON public.pbx_sms_threads;

CREATE POLICY "Admins view all org sms threads"
ON public.pbx_sms_threads
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
  OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
);

CREATE POLICY "Softphone users view assigned sms threads"
ON public.pbx_sms_threads
FOR SELECT
TO authenticated
USING (
  assigned_user_id = auth.uid()
);

-- pbx_sms_messages: scope via parent thread
DROP POLICY IF EXISTS "org_members_select" ON public.pbx_sms_messages;

CREATE POLICY "Admins view all org sms messages"
ON public.pbx_sms_messages
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
  OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
);

CREATE POLICY "Softphone users view own sms messages"
ON public.pbx_sms_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pbx_sms_threads t
    WHERE t.id = pbx_sms_messages.thread_id
      AND t.assigned_user_id = auth.uid()
  )
);