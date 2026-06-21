import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const BRAND = { primary: "#1F4E79", accent: "#2E86C1" };

export default function PlanipretLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr || !data.user) {
      setError(signErr?.message ?? "Échec de connexion");
      setLoading(false);
      return;
    }
    // Lookup planipret_profiles role
    const { data: profile } = await supabase
      .from("planipret_profiles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    setLoading(false);
    if (profile?.role === "admin") navigate("/planipret/dashboard", { replace: true });
    else navigate("/mplanipret", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8 border-t-4"
        style={{ borderTopColor: BRAND.primary }}
      >
        <div className="text-center mb-6">
          <div className="text-xs tracking-widest text-slate-500">AVA</div>
          <h1 className="text-2xl font-bold mt-1" style={{ color: BRAND.primary }}>
            Planiprêt
          </h1>
          <p className="text-sm text-slate-500 mt-1">Portail courtiers hypothécaires</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Courriel</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2"
              style={{ outlineColor: BRAND.accent }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2"
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white font-medium transition disabled:opacity-60"
            style={{ background: BRAND.primary }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
