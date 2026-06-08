import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Portal = "platform" | "customer" | "my";

/**
 * Enforces role separation between portals.
 *  - platform: super_admin or master_admin only
 *  - customer: org_admin / reseller_admin / manager (or higher)
 *  - my: any authenticated user
 * Wrong-role users get redirected to the portal they DO have access to.
 */
export function RolePortalGuard({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { user, loading } = useAuth();
  const [state, setState] = useState<"checking" | "allow" | "deny-platform" | "deny-customer">("checking");

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    (async () => {
      try {
        const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: user.id });
        const { data: masterRow } = await supabase
          .from("org_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "master_admin")
          .maybeSingle();
        const isMaster = !!masterRow;

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const isAdmin = roles?.some((r: any) =>
          r.role === "org_admin" || r.role === "reseller_admin" || r.role === "manager"
        );

        if (portal === "platform") {
          setState(isSuper || isMaster ? "allow" : isAdmin ? "deny-platform" : "deny-customer");
        } else if (portal === "customer") {
          setState(isSuper || isMaster || isAdmin ? "allow" : "deny-customer");
        } else {
          setState("allow");
        }
      } catch {
        setState(portal === "my" ? "allow" : "deny-customer");
      }
    })();
  }, [user, loading, portal]);

  if (loading || state === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (state === "deny-platform") return <Navigate to="/customer" replace />;
  if (state === "deny-customer") return <Navigate to="/my" replace />;
  return <>{children}</>;
}
