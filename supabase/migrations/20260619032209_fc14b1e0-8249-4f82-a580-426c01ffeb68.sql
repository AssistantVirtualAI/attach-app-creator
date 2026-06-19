DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pbx_call_records'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pbx_call_records';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pbx_voicemails'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pbx_voicemails';
  END IF;
END $$;

ALTER TABLE public.pbx_call_records REPLICA IDENTITY FULL;
ALTER TABLE public.pbx_voicemails REPLICA IDENTITY FULL;