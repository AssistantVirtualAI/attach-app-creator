import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function PlanipretDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brokers, setBrokers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/planipret/login", { replace: true }); return; }
      const { data: me } = await supabase
        .from("planipret_profiles").select("role").eq("user_id", user.id).maybeSingle();
      if (me?.role !== "admin") { navigate("/mplanipret", { replace: true }); return; }
      const { data } = await supabase
        .from("planipret_profiles").select("*").order("created_at", { ascending: false });
      setBrokers(data ?? []);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Chargement…</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-6 py-4 text-white" style={{ background: "#1F4E79" }}>
        <div className="text-xs opacity-80">AVA · Planiprêt</div>
        <h1 className="text-xl font-semibold">Tableau de bord Admin</h1>
      </header>
      <main className="p-6">
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-3" style={{ color: "#1F4E79" }}>Courtiers ({brokers.length})</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Nom</th><th>Courriel</th><th>Extension</th><th>Rôle</th><th>Mobile</th></tr>
            </thead>
            <tbody>
              {brokers.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="py-2">{b.full_name ?? "—"}</td>
                  <td>{b.email ?? "—"}</td>
                  <td>{b.extension ?? "—"}</td>
                  <td>{b.role}</td>
                  <td>{b.mobile_app_enabled ? "✓" : "—"}</td>
                </tr>
              ))}
              {brokers.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aucun courtier pour l'instant</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
