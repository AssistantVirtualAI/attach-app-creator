
-- =========================================================
-- voice_agent_clients : customers reachable by AI voice agents
-- =========================================================
CREATE TABLE public.voice_agent_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  company text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vac_org ON public.voice_agent_clients(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_agent_clients TO authenticated;
GRANT ALL ON public.voice_agent_clients TO service_role;

ALTER TABLE public.voice_agent_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read voice_agent_clients"
  ON public.voice_agent_clients FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "members write voice_agent_clients"
  ON public.voice_agent_clients FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "members update voice_agent_clients"
  ON public.voice_agent_clients FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "admins delete voice_agent_clients"
  ON public.voice_agent_clients FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER trg_vac_updated_at
  BEFORE UPDATE ON public.voice_agent_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- voice_agent_assignments : voice agent <-> client link
-- =========================================================
CREATE TABLE public.voice_agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  voice_agent_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('agents', 'pbx_softphone_users')),
  client_id uuid REFERENCES public.voice_agent_clients(id) ON DELETE CASCADE,
  phone_client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  CHECK ((client_id IS NOT NULL) <> (phone_client_id IS NOT NULL))
);

CREATE INDEX idx_vaa_agent ON public.voice_agent_assignments(voice_agent_id);
CREATE INDEX idx_vaa_org ON public.voice_agent_assignments(organization_id);
CREATE UNIQUE INDEX uniq_vaa_agent_va_client ON public.voice_agent_assignments(voice_agent_id, client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_vaa_agent_phone_client ON public.voice_agent_assignments(voice_agent_id, phone_client_id) WHERE phone_client_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_agent_assignments TO authenticated;
GRANT ALL ON public.voice_agent_assignments TO service_role;

ALTER TABLE public.voice_agent_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read voice_agent_assignments"
  ON public.voice_agent_assignments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "members write voice_agent_assignments"
  ON public.voice_agent_assignments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "members delete voice_agent_assignments"
  ON public.voice_agent_assignments FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));
