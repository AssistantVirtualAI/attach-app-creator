CREATE OR REPLACE FUNCTION public.is_my_extension_call(
  _org_id uuid,
  _extension text,
  _extension_uuid uuid,
  _caller text,
  _destination_number text,
  _destination text,
  _source text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pbx_softphone_users s
    LEFT JOIN public.pbx_extensions e
      ON e.organization_id = s.organization_id
     AND (
       e.id = s.extension_id
       OR e.extension = s.extension
     )
    WHERE s.portal_user_id = auth.uid()
      AND s.organization_id = _org_id
      AND (
        s.extension = _extension
        OR s.extension = _caller
        OR s.extension = _destination_number
        OR s.extension = _destination
        OR s.extension = _source
        OR (e.pbx_uuid IS NOT NULL AND e.pbx_uuid = _extension_uuid::text)
      )
  )
$function$;

DROP POLICY IF EXISTS "Softphone users view own extension call records" ON public.pbx_call_records;
CREATE POLICY "Softphone users view own extension call records"
ON public.pbx_call_records
FOR SELECT
TO authenticated
USING (public.is_my_extension_call(organization_id, extension, extension_uuid, caller_number, destination_number, destination, source_number));

DROP POLICY IF EXISTS "Softphone users view own call recordings" ON public.pbx_call_recordings;
CREATE POLICY "Softphone users view own call recordings"
ON public.pbx_call_recordings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pbx_call_records r
    WHERE r.id = pbx_call_recordings.call_record_id
      AND public.is_my_extension_call(r.organization_id, r.extension, r.extension_uuid, r.caller_number, r.destination_number, r.destination, r.source_number)
  )
);