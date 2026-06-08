
CREATE TABLE IF NOT EXISTS public.pbx_ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_record_id uuid,
  kind text NOT NULL DEFAULT 'transcribe_analyze',
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pbx_ai_jobs TO authenticated;
GRANT ALL ON public.pbx_ai_jobs TO service_role;
ALTER TABLE public.pbx_ai_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_jobs_org_members_select" ON public.pbx_ai_jobs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.current_user_org_ids()));
CREATE POLICY "ai_jobs_org_members_insert" ON public.pbx_ai_jobs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.current_user_org_ids()));

CREATE TABLE IF NOT EXISTS public.pbx_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pbx_ai_conversations TO authenticated;
GRANT ALL ON public.pbx_ai_conversations TO service_role;
ALTER TABLE public.pbx_ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_conv_owner_select" ON public.pbx_ai_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ai_conv_owner_insert" ON public.pbx_ai_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND organization_id IN (SELECT public.current_user_org_ids()));
CREATE POLICY "ai_conv_owner_update" ON public.pbx_ai_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_conv_owner_delete" ON public.pbx_ai_conversations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pbx_ai_jobs_call ON public.pbx_ai_jobs(call_record_id);
CREATE INDEX IF NOT EXISTS idx_pbx_ai_jobs_org_status ON public.pbx_ai_jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_pbx_ai_conv_user ON public.pbx_ai_conversations(user_id, updated_at DESC);
