
ALTER TABLE public.pbx_extensions
  ADD COLUMN IF NOT EXISTS password text,
  ADD COLUMN IF NOT EXISTS voicemail_password text,
  ADD COLUMN IF NOT EXISTS accountcode text DEFAULT 'lemtel.lemtel.tel',
  ADD COLUMN IF NOT EXISTS effective_cid_name text,
  ADD COLUMN IF NOT EXISTS effective_cid_number text,
  ADD COLUMN IF NOT EXISTS outbound_cid_name text,
  ADD COLUMN IF NOT EXISTS outbound_cid_number text,
  ADD COLUMN IF NOT EXISTS emergency_cid_name text,
  ADD COLUMN IF NOT EXISTS emergency_cid_number text,
  ADD COLUMN IF NOT EXISTS directory_first_name text,
  ADD COLUMN IF NOT EXISTS directory_last_name text,
  ADD COLUMN IF NOT EXISTS directory_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS directory_exten_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS limit_max text DEFAULT '5',
  ADD COLUMN IF NOT EXISTS limit_destination text DEFAULT '!USER_BUSY',
  ADD COLUMN IF NOT EXISTS voicemail_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS voicemail_mail_to text,
  ADD COLUMN IF NOT EXISTS voicemail_transcription boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS voicemail_custom_prompt boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS voicemail_file text DEFAULT 'listen',
  ADD COLUMN IF NOT EXISTS voicemail_keep_local boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS missed_call_app text,
  ADD COLUMN IF NOT EXISTS missed_call_data text,
  ADD COLUMN IF NOT EXISTS call_timeout integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS call_group text,
  ADD COLUMN IF NOT EXISTS call_screen boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hold_music text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS extension_language text DEFAULT 'fr-ca',
  ADD COLUMN IF NOT EXISTS extension_dialect text DEFAULT 'june',
  ADD COLUMN IF NOT EXISTS extension_voice text,
  ADD COLUMN IF NOT EXISTS extension_type text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS toll_allow text,
  ADD COLUMN IF NOT EXISTS do_not_disturb boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS forward_all_destination text,
  ADD COLUMN IF NOT EXISTS forward_all_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS forward_busy_destination text,
  ADD COLUMN IF NOT EXISTS forward_busy_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS forward_no_answer_destination text,
  ADD COLUMN IF NOT EXISTS forward_no_answer_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS forward_user_not_registered_destination text,
  ADD COLUMN IF NOT EXISTS forward_user_not_registered_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_record text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS absolute_codec_string text,
  ADD COLUMN IF NOT EXISTS max_registrations integer,
  ADD COLUMN IF NOT EXISTS force_ping boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sip_force_contact text,
  ADD COLUMN IF NOT EXISTS sip_force_expires integer,
  ADD COLUMN IF NOT EXISTS sip_bypass_media text,
  ADD COLUMN IF NOT EXISTS cidr text,
  ADD COLUMN IF NOT EXISTS auth_acl text,
  ADD COLUMN IF NOT EXISTS assigned_user_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS device_lines jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw_data jsonb;

UPDATE public.pbx_extensions SET
  password = COALESCE(password, 'Lemtel300!'),
  accountcode = COALESCE(accountcode, 'lemtel.lemtel.tel'),
  effective_cid_name = COALESCE(effective_cid_name, 'Mohamad Hassoun'),
  effective_cid_number = COALESCE(effective_cid_number, '300'),
  directory_first_name = COALESCE(directory_first_name, 'Mohamad'),
  directory_last_name = COALESCE(directory_last_name, 'Hassoun'),
  directory_visible = true,
  directory_exten_visible = true,
  limit_max = COALESCE(limit_max, '5'),
  limit_destination = COALESCE(limit_destination, '!USER_BUSY'),
  voicemail_enabled = true,
  call_timeout = COALESCE(call_timeout, 30),
  hold_music = COALESCE(hold_music, 'default'),
  extension_language = COALESCE(extension_language, 'fr-ca'),
  extension_type = COALESCE(extension_type, 'default'),
  description = COALESCE(description, 'Mohamad Hassoun')
WHERE extension = '300';

CREATE INDEX IF NOT EXISTS idx_pbx_extensions_org_id ON public.pbx_extensions(org_id);
CREATE INDEX IF NOT EXISTS idx_pbx_extensions_portal_user_id ON public.pbx_extensions(portal_user_id);

ALTER TABLE public.pbx_extensions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pbx_extensions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pbx_extensions';
  END IF;
END $$;
