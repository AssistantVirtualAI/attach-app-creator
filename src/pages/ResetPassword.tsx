import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lock } from "lucide-react";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 bg-blue-50 text-blue-700">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Réinitialiser votre mot de passe</h1>
        {sent ? (
          <>
            <p className="text-sm text-slate-600 mt-3">
              Un lien de réinitialisation a été envoyé à <b>{email}</b>.
            </p>
            <Link to="/login" className="inline-block mt-5 text-sm text-blue-700 underline">Retour à la connexion</Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Courriel</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-medium bg-blue-700 hover:bg-blue-800 disabled:opacity-60">
              {loading ? "Envoi..." : "Envoyer le lien de réinitialisation"}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-xs text-slate-500 hover:text-slate-700">Retour à la connexion</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
