import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CcRole = "none" | "agent" | "supervisor" | "admin";

export function useCallCenterRole() {
  const { user } = useAuth();
  const [data, setData] = useState<{ role: CcRole; queues: string[]; extension: string | null; organization_id: string | null }>({
    role: "none", queues: [], extension: null, organization_id: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("pbx_softphone_users")
        .select("cc_role, cc_queues, extension, organization_id")
        .eq("portal_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setData({
        role: (row?.cc_role as CcRole) || "none",
        queues: (row?.cc_queues as string[]) || [],
        extension: row?.extension || null,
        organization_id: row?.organization_id || null,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { ...data, loading, isAgent: data.role === "agent", isSupervisor: data.role === "supervisor" || data.role === "admin", isAdmin: data.role === "admin" };
}
