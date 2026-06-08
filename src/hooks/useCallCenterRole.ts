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
      const [{ data: row }, { data: isSuper }, { data: isLemtelAdm }] = await Promise.all([
        supabase
          .from("pbx_softphone_users")
          .select("cc_role, cc_queues, extension, organization_id")
          .eq("portal_user_id", user.id)
          .maybeSingle(),
        supabase.rpc("is_super_admin", { _user_id: user.id }),
        supabase.rpc("is_lemtel_admin", { _user_id: user.id }),
      ]);
      if (cancelled) return;
      const baseRole = (row?.cc_role as CcRole) || "none";
      // Platform-level admins (super_admin or Lemtel org_admin) get full CC admin powers
      const effective: CcRole = (isSuper || isLemtelAdm) ? "admin" : baseRole;
      setData({
        role: effective,
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
