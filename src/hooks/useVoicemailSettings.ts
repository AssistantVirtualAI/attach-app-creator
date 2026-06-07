import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useVoicemailSettings() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: row } = await supabase.from("pbx_voicemail_settings").select("*").eq("user_id", user.id).maybeSingle();
    setData(row);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: any) => {
    if (!user) return;
    await supabase.from("pbx_voicemail_settings").upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() });
    await load();
  }, [user, load]);

  return { data, loading, save };
}
