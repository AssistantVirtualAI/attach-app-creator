import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function PlanipretMobile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/planipret/login", { replace: true }); return; }
      const { data } = await supabase
        .from("planipret_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) { navigate("/planipret/login", { replace: true }); return; }
      if (data.role === "admin") { navigate("/planipret/dashboard", { replace: true }); return; }
      setProfile(data);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Chargement…</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-4 py-4 text-white" style={{ background: "#1F4E79" }}>
        <div className="text-xs opacity-80">AVA · Planiprêt</div>
        <h1 className="text-lg font-semibold">Bonjour {profile?.full_name ?? "Courtier"}</h1>
      </header>
      <main className="p-4 space-y-3">
        {[
          { label: "Mes appels", to: "#" },
          { label: "Messagerie vocale", to: "#" },
          { label: "Contacts", to: "#" },
          { label: "Mon agent IA", to: "#" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
            <span className="font-medium text-slate-800">{item.label}</span>
            <span className="text-sm" style={{ color: "#2E86C1" }}>Ouvrir →</span>
          </div>
        ))}
      </main>
    </div>
  );
}
