import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import planipretLogo from "@/assets/planipret-logo.png.asset.json";
import avaWordmark from "@/assets/ava-wordmark.svg";
import { Eye, EyeOff, Mail, Lock, ShieldCheck, Smartphone, Sparkles, Loader2 } from "lucide-react";

export default function PlanipretLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    const { data: profile } = await supabase
      .from("planipret_profiles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    setLoading(false);

    // Honor explicit redirect (e.g. coming from /mplanipret) before role default.
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (profile?.role === "admin") navigate("/planipret/admin/overview", { replace: true });
    else navigate("/mplanipret", { replace: true });
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(1200px 700px at 15% -10%, rgba(46,155,220,0.18), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(0,212,170,0.12), transparent 60%), linear-gradient(180deg, #030810 0%, #061226 100%)",
      }}
    >
      {/* Decorative grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      <div className="relative w-full max-w-5xl grid md:grid-cols-[1.05fr_1fr] gap-6 md:gap-10 items-stretch">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between p-8 rounded-3xl border border-white/5"
             style={{ background: "linear-gradient(160deg, rgba(10,22,40,0.85), rgba(6,18,38,0.6))", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.6)" }}>
          <div>
            <div className="flex items-center gap-3">
              <img src={planipretLogo.url} alt="Planiprêt" className="w-12 h-12 rounded-xl object-cover shadow-lg" />
              <div>
                <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "#4A7FA5" }}>Planiprêt AI Portal</div>
                <div className="text-xl font-bold text-white" style={{ fontFamily: "Inter,sans-serif" }}>Portail courtiers</div>
              </div>
            </div>
            <h1 className="mt-10 text-4xl font-bold leading-tight text-white" style={{ fontFamily: "Inter,sans-serif" }}>
              Vos appels.<br />Vos clients.<br />
              <span style={{ background: "linear-gradient(90deg,#2E9BDC,#00D4AA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Une seule console.
              </span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed max-w-sm" style={{ color: "#94B4D4" }}>
              Téléphonie hébergée, CRM Maestro, intelligence IA et agent vocal AVA — réunis dans une expérience pensée pour les courtiers hypothécaires.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-10">
            <Feature icon={<Smartphone className="w-4 h-4" />} label="App mobile" />
            <Feature icon={<Sparkles className="w-4 h-4" />} label="Agent AVA" />
            <Feature icon={<ShieldCheck className="w-4 h-4" />} label="Loi 25" />
          </div>
        </div>

        {/* Form panel */}
        <div
          className="rounded-3xl p-8 md:p-10 border relative"
          style={{
            background: "linear-gradient(180deg, rgba(10,22,40,0.95), rgba(6,18,38,0.92))",
            borderColor: "rgba(46,155,220,0.18)",
            boxShadow: "0 40px 80px -20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-3xl"
               style={{ background: "linear-gradient(90deg, transparent, #2E9BDC, #00D4AA, transparent)" }} />

          <div className="md:hidden mb-6 text-center">
            <img src={planipretLogo.url} alt="Planiprêt" className="mx-auto w-16 h-16 rounded-2xl object-cover" />
          </div>

          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Inter,sans-serif" }}>Connexion</h2>
          <p className="text-sm mt-1" style={{ color: "#4A7FA5" }}>
            {redirectTo === "/mplanipret"
              ? "Accédez à votre application mobile"
              : "Accédez à votre portail Planiprêt"}
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <Field
              icon={<Mail className="w-4 h-4" />}
              type="email"
              autoComplete="email"
              placeholder="vous@planipret.ca"
              label="Courriel"
              value={email}
              onChange={setEmail}
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium tracking-wide" style={{ color: "#94B4D4" }}>Mot de passe</label>
                <Link to="/reset-password" className="text-xs hover:underline" style={{ color: "#2E9BDC" }}>
                  Oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4A7FA5" }} />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl pl-10 pr-11 py-3 text-sm text-white outline-none transition focus:ring-2"
                  style={{
                    background: "rgba(3,8,16,0.7)",
                    border: "1px solid rgba(46,155,220,0.18)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/5"
                  style={{ color: "#4A7FA5" }}
                  aria-label={showPw ? "Masquer" : "Afficher"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm rounded-xl px-3 py-2.5 flex items-start gap-2"
                   style={{ background: "rgba(232,76,76,0.08)", border: "1px solid rgba(232,76,76,0.25)", color: "#FFB4B4" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(90deg,#2E9BDC,#00D4AA)",
                color: "#03101A",
                boxShadow: "0 10px 28px -10px rgba(46,155,220,0.6)",
              }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Connexion...</>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t flex items-center justify-between text-[11px]"
               style={{ borderColor: "rgba(46,155,220,0.12)", color: "#4A7FA5" }}>
            <div className="flex items-center gap-2">
              <span>Powered by</span>
              <img src={avaWordmark} alt="AVA" className="h-3 opacity-80" />
            </div>
            <span>© {new Date().getFullYear()} Planiprêt</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl p-3 border flex flex-col items-center gap-1.5"
         style={{ background: "rgba(3,8,16,0.5)", borderColor: "rgba(46,155,220,0.15)", color: "#94B4D4" }}>
      <span style={{ color: "#2E9BDC" }}>{icon}</span>
      <span className="text-[11px]" style={{ fontFamily: "DM Sans,sans-serif" }}>{label}</span>
    </div>
  );
}

function Field({ icon, type, label, value, onChange, placeholder, autoComplete }: {
  icon: React.ReactNode; type: string; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium tracking-wide mb-1.5 block" style={{ color: "#94B4D4" }}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4A7FA5" }}>{icon}</span>
        <input
          type={type}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl pl-10 pr-3 py-3 text-sm text-white outline-none transition focus:ring-2"
          style={{ background: "rgba(3,8,16,0.7)", border: "1px solid rgba(46,155,220,0.18)" }}
        />
      </div>
    </div>
  );
}
