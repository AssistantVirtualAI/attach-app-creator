import { useOutletContext, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Cloud, User } from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";

const PRIMARY = "#1F4E79";

export default function MMore() {
  const { profile } = useOutletContext<PlanipretMobileContext>();
  const [params] = useSearchParams();

  useEffect(() => {
    if (params.get("ms365") === "ok") toast.success("Microsoft 365 connecté ✅");
  }, [params]);

  const connectMs365 = async () => {
    const { data } = await supabase.from("planipret_integration_secrets").select("config").eq("provider", "microsoft").maybeSingle();
    const cfg = (data?.config ?? {}) as any;
    const clientId = cfg.client_id;
    const tenant = cfg.tenant_id ?? "common";
    if (!clientId) { toast.error("Microsoft 365 non configuré par l'admin"); return; }
    const redirect = `${window.location.origin}/auth/ms365/callback`;
    const scope = encodeURIComponent("openid offline_access Mail.ReadWrite Calendars.ReadWrite User.Read");
    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&response_mode=query&scope=${scope}`;
    window.location.href = url;
  };

  const logout = async () => { await supabase.auth.signOut(); window.location.href = "/planipret/login"; };

  return (
    <div className="p-4 space-y-4">
      <header className="pt-2">
        <h1 className="text-xl font-bold" style={{ color: "#1A1A2E" }}>Plus</h1>
      </header>
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${PRIMARY}15`, color: PRIMARY }}><User className="w-6 h-6" /></div>
          <div>
            <p className="font-semibold" style={{ color: "#1A1A2E" }}>{profile?.full_name ?? "Courtier"}</p>
            <p className="text-xs text-slate-500">{profile?.email ?? ""}</p>
            <p className="text-[11px] text-slate-400">Ext. {profile?.extension ?? "—"}</p>
          </div>
        </div>
      </section>
      <button onClick={connectMs365} className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-left active:bg-slate-50">
        <Cloud className="w-5 h-5" style={{ color: "#0078D4" }} />
        <span className="flex-1 text-sm font-medium" style={{ color: "#1A1A2E" }}>Microsoft 365</span>
        <span className="text-xs text-slate-400">{profile?.ms365_access_token ? "Connecté" : "Connecter"}</span>
      </button>
      <button onClick={logout} className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-left active:bg-slate-50">
        <LogOut className="w-5 h-5 text-red-500" />
        <span className="flex-1 text-sm font-medium text-red-600">Se déconnecter</span>
      </button>
    </div>
  );
}
