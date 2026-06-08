CREATE TABLE IF NOT EXISTS public.org_business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  timezone text NOT NULL DEFAULT 'America/Toronto',
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  open_destination text,
  closed_destination text,
  fusionpbx_dialplan_uuid uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_business_hours TO authenticated;
GRANT ALL ON public.org_business_hours TO service_role;

ALTER TABLE public.org_business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view their org business hours" ON public.org_business_hours
  FOR SELECT TO authenticated
  USING (public.can_access_org(auth.uid(), organization_id));

CREATE POLICY "admins can manage org business hours" ON public.org_business_hours
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), organization_id, 'org_admin'::app_role) OR public.is_master_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), organization_id, 'org_admin'::app_role) OR public.is_master_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS org_business_hours_org_idx ON public.org_business_hours(organization_id);

CREATE TRIGGER update_org_business_hours_updated_at
  BEFORE UPDATE ON public.org_business_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();