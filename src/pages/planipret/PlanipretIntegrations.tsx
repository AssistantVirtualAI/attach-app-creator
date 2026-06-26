import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AVA_OWNER_USER_ID } from "@/lib/avaOwner";
import ElevenLabsManagementCard from "@/components/planipret/admin/integrations/ElevenLabsManagementCard";
import { Phone, Mic, Sparkles, Database, Cloud, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ExternalLink, X, Bell } from "lucide-react";

type Provider = "nsapi" | "elevenlabs" | "anthropic" | "maestro" | "microsoft" | "webpush";

type StoredItem = { provider: Provider; updated_at: string | null; config_masked: Record<string, string>; has_keys: string[] };

const CARDS: Array<{
  id: Provider; name: string; description: string; color: string; Icon: any;
  fields: { key: string; label: string; secret?: boolean; readonly?: boolean; defaultValue?: string }[];
  testAction?: string;
  note?: string;
  features?: string[];
  critical?: boolean;
}> = [
  {
    id: "nsapi", name: "NS-API (NetSapiens)", description: "Téléphonie cloud Planiprêt",
    color: "#1F4E79", Icon: Phone, critical: true,
    fields: [
      { key: "base_url", label: "NS_API_BASE_URL", readonly: true, defaultValue: "https://voice.ava-telecom.ca/ns-api/v2" },
      { key: "domain", label: "NS_DEFAULT_DOMAIN", readonly: true, defaultValue: "planipret.ca" },
    ],
    testAction: "test_nsapi",
  },
  {
    id: "elevenlabs", name: "ElevenLabs", description: "Agent vocal IA",
    color: "#6C3CE1", Icon: Mic, critical: true,
    fields: [
      { key: "api_key", label: "API Key", secret: true },
      { key: "default_agent_id", label: "Default Agent ID" },
      { key: "agent_name", label: "Agent Name (ex: AVA - Planiprêt)" },
    ],
    testAction: "test_elevenlabs",
    note: "L'agent vocal sera activé par broker depuis Gestion Utilisateurs",
  },
  {
    id: "anthropic", name: "Anthropic (Claude AI)", description: "Analyse d'appels & coaching",
    color: "#D97706", Icon: Sparkles, critical: true,
    fields: [{ key: "api_key", label: "API Key", secret: true }],
    testAction: "test_anthropic",
  },
  {
    id: "maestro", name: "Maestro CRM", description: "Tâches, rendez-vous, contacts",
    color: "#059669", Icon: Database,
    fields: [
      { key: "api_url", label: "API Base URL", defaultValue: "https://api.maestrocrm.com" },
      { key: "api_key", label: "API Key", secret: true },
      { key: "account_id", label: "Account ID" },
    ],
    testAction: "test_maestro",
    features: ["Création de tâches automatique", "Création de rendez-vous", "Recherche de contacts", "Sync après chaque appel analysé"],
  },
  {
    id: "microsoft", name: "Microsoft 365", description: "Courriels & Calendrier",
    color: "#0078D4", Icon: Cloud,
    fields: [
      { key: "client_id", label: "Azure App Client ID" },
      { key: "client_secret", label: "Azure App Client Secret", secret: true },
      { key: "tenant_id", label: "Tenant ID", defaultValue: "common" },
    ],
    note: "Chaque courtier connecte son compte M365 individuellement depuis l'app mobile (More → Microsoft 365)",
  },
  {
    id: "webpush", name: "Web Push (VAPID)", description: "Notifications push navigateur & PWA",
    color: "#2E9BDC", Icon: Bell,
    fields: [
      { key: "public_key", label: "VAPID Public Key" },
      { key: "private_key", label: "VAPID Private Key", secret: true },
      { key: "subject", label: "Subject (mailto:...)", defaultValue: "mailto:noreply@avastatistic.ca" },
    ],
    note: "Générer les clés avec: npx web-push generate-vapid-keys",
    features: ["Notifications appels entrants", "Nouveaux SMS", "Nouveaux voicemails", "Analyses IA prêtes"],
  },
];

export default function PlanipretIntegrations() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [items, setItems] = useState<Record<string, StoredItem>>({});
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [showAzureModal, setShowAzureModal] = useState(false);

  const reload = async () => {
    const { data } = await supabase.functions.invoke("pp-integration-secrets");
    const map: Record<string, StoredItem> = {};
    for (const it of (data as any)?.items ?? []) map[it.provider] = it;
    setItems(map);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== AVA_OWNER_USER_ID) { setAuthorized(false); return; }
      setAuthorized(true);
      reload();
      // Tests run on-demand via the "Re-tester" button to avoid noisy 403/404/500 on mount
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isConfigured = (id: Provider) => {
    const item = items[id];
    if (id === "nsapi") return true; // env-backed
    return (item?.has_keys?.length ?? 0) > 0;
  };

  const configuredCount = CARDS.filter((c) => isConfigured(c.id)).length;

  const save = async (provider: Provider) => {
    setSaving(provider); setMsg(null);
    const { error } = await supabase.functions.invoke("pp-integration-secrets", { body: { provider, config: forms[provider] ?? {} } });
    setSaving(null);
    if (error) setMsg(error.message);
    else { setMsg(`✓ ${provider} sauvegardé`); setForms((f) => ({ ...f, [provider]: {} })); await reload(); testOne(provider); }
  };

  const safeInvoke = async (name: string, body?: any) => {
    try {
      const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);
      if (error) {
        // Try to parse FunctionsHttpError body for the real message
        let parsed: any = null;
        try { parsed = await (error as any).context?.json?.(); } catch { /* ignore */ }
        return { data: parsed ?? null, error: parsed?.error ?? error.message };
      }
      return { data, error: null as string | null };
    } catch (e: any) {
      return { data: null, error: e?.message ?? "Erreur réseau" };
    }
  };

  const testOne = async (provider: Provider) => {
    setTesting(provider);
    try {
      let result: { ok: boolean; msg: string };
      if (provider === "nsapi") {
        const { data, error } = await safeInvoke("ns-auth");
        result = { ok: !!(data as any)?.success, msg: (data as any)?.success ? "Connecté" : (error ?? (data as any)?.error ?? "Erreur") };
      } else if (provider === "elevenlabs") {
        const cfg = items.elevenlabs?.config_masked;
        const apiKey = forms.elevenlabs?.api_key;
        if (!apiKey && !cfg?.api_key) result = { ok: false, msg: "Saisir la clé d'abord" };
        else {
          if (apiKey) {
            const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": apiKey } });
            const d = await r.json().catch(() => ({}));
            result = { ok: r.ok, msg: r.ok ? `Compte: ${d.subscription?.tier ?? "OK"}` : "Clé invalide" };
          } else {
            result = { ok: true, msg: "Clé stockée (entrez à nouveau pour tester)" };
          }
        }
      } else if (provider === "anthropic") {
        const { data, error } = await safeInvoke("ai-analyze-call", { call_id: "test", transcript: "test" });
        const errStr = error ?? (data as any)?.error ?? "";
        const ok = (data as any)?.success === true || /Appel introuvable/i.test(errStr);
        result = { ok, msg: ok ? "Claude API opérationnelle" : (errStr || "Erreur") };
      } else if (provider === "maestro") {
        const { data, error } = await safeInvoke("maestro-actions", { action: "test" });
        result = { ok: !!(data as any)?.success, msg: (data as any)?.success ? "Maestro CRM connecté" : (error ?? (data as any)?.error ?? "Non configuré") };
      } else {
        result = { ok: isConfigured(provider), msg: isConfigured(provider) ? "Configuré" : "Non configuré" };
      }
      setTestResults((p) => ({ ...p, [provider]: result }));
    } catch (e: any) {
      setTestResults((p) => ({ ...p, [provider]: { ok: false, msg: e?.message ?? "Erreur" } }));
    } finally {
      setTesting(null);
    }
  };

  const runAllTests = async () => { for (const c of CARDS) await testOne(c.id); };

  if (authorized === false) return <div className="min-h-screen flex items-center justify-center text-slate-600">Accès refusé.</div>;
  if (authorized === null) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-6 py-4 text-white flex items-center gap-3" style={{ background: "#1F4E79" }}>
        <button onClick={() => navigate("/planipret/dashboard")} className="p-1.5 hover:bg-white/10 rounded"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="text-xs opacity-80">AVA · Planiprêt</div>
          <h1 className="text-xl font-semibold">Intégrations</h1>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-5">
        {msg && <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2">{msg}</div>}

        {/* Summary bar */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-700">{configuredCount}/{CARDS.length} intégrations configurées</h2>
            <button onClick={runAllTests} className="text-xs text-slate-500 hover:text-slate-700">Re-tester</button>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${(configuredCount / CARDS.length) * 100}%`, background: "#1F4E79" }} />
          </div>
          {CARDS.filter((c) => c.critical && !isConfigured(c.id)).map((c) => (
            <div key={c.id} className="mt-3 text-xs flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
              <AlertCircle className="w-3.5 h-3.5" /> {c.name} est requise mais non configurée
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {CARDS.map((card) => {
            if (card.id === "elevenlabs") {
              return <div id="elevenlabs" key="elevenlabs" className="scroll-mt-24"><ElevenLabsManagementCard userId={AVA_OWNER_USER_ID} /></div>;
            }
            const stored = items[card.id];
            const tested = testResults[card.id];
            const configured = isConfigured(card.id);
            const status = tested ? (tested.ok ? "Connecté" : "Erreur") : (configured ? "Configuré" : "Non configuré");
            const statusClass = tested?.ok ? "bg-emerald-100 text-emerald-700" : tested && !tested.ok ? "bg-red-100 text-red-700" : configured ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500";
            return (
              <div key={card.id} id={card.id} className="bg-white rounded-xl shadow border-t-4 overflow-hidden scroll-mt-24" style={{ borderTopColor: card.color }}>
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg flex-shrink-0" style={{ background: `${card.color}15`, color: card.color }}>
                      <card.Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800">{card.name}</h3>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusClass}`}>{status}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{card.description}</p>
                    </div>
                  </div>
                  {card.critical && !configured && (
                    <div className="mb-3 rounded-xl p-3 flex items-start gap-2"
                         style={{ background: "rgba(232,76,76,0.08)", border: "1px solid rgba(232,76,76,0.3)" }}>
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#E84C4C" }} />
                      <div className="text-xs" style={{ color: "#B83A3A" }}>
                        <div className="font-semibold mb-0.5">Configuration requise</div>
                        <div>Cette intégration est critique pour le bon fonctionnement de la plateforme.</div>
                      </div>
                    </div>
                  )}




                  {/* NetSapiens webhook helper */}
                  {card.id === "nsapi" && <NSWebhookHelper />}
                  {card.id === "maestro" && <MaestroPanel />}



                  <div className="space-y-2.5 mb-3">
                    {card.fields.map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                        <input
                          type={f.secret ? "password" : "text"}
                          disabled={f.readonly}
                          value={f.readonly ? (f.defaultValue ?? "") : (forms[card.id]?.[f.key] ?? "")}
                          placeholder={stored?.config_masked?.[f.key] || f.defaultValue || "—"}
                          onChange={(e) => setForms((s) => ({ ...s, [card.id]: { ...(s[card.id] ?? {}), [f.key]: e.target.value } }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono disabled:bg-slate-50 disabled:text-slate-500"
                          autoComplete="off"
                        />
                        {stored?.has_keys?.includes(f.key) && !f.readonly && (
                          <div className="text-[10px] text-emerald-600 mt-0.5">✓ valeur stockée</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {card.features && configured && (
                    <ul className="text-xs text-slate-600 space-y-1 mb-3">
                      {card.features.map((f) => (<li key={f} className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-600" />{f}</li>))}
                    </ul>
                  )}

                  {card.note && <p className="text-[11px] text-slate-500 italic mb-3">{card.note}</p>}

                  <div className="flex flex-wrap gap-2">
                    {!card.fields.every((f) => f.readonly) && (
                      <button onClick={() => save(card.id)} disabled={saving === card.id} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-60" style={{ background: card.color }}>
                        {saving === card.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sauvegarder"}
                      </button>
                    )}
                    {card.testAction && (
                      <button onClick={() => testOne(card.id)} disabled={testing === card.id} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                        {testing === card.id ? "Test…" : "Tester la connexion"}
                      </button>
                    )}
                    {card.id === "microsoft" && (
                      <button onClick={() => setShowAzureModal(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Instructions Azure
                      </button>
                    )}
                  </div>

                  {tested && (
                    <div className={`mt-2 text-xs ${tested.ok ? "text-emerald-700" : "text-red-700"}`}>{tested.msg}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {showAzureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowAzureModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-lg" style={{ color: "#0078D4" }}>Configuration Azure App Registration</h3>
              <button onClick={() => setShowAzureModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
              <li>Aller sur <a href="https://portal.azure.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">portal.azure.com</a></li>
              <li>Azure Active Directory → App registrations → <b>New registration</b></li>
              <li>Nom : <code className="bg-slate-100 px-1 rounded">Planiprêt AI Portal</code></li>
              <li>Redirect URI (Web) : <code className="bg-slate-100 px-1 rounded text-xs break-all">{window.location.origin}/auth/ms365/callback</code></li>
              <li>API Permissions (Microsoft Graph, Delegated) :
                <ul className="list-disc list-inside ml-4 text-xs mt-1 text-slate-600">
                  <li>Mail.ReadWrite</li><li>Calendars.ReadWrite</li><li>User.Read</li><li>offline_access</li>
                </ul>
              </li>
              <li>Cliquer <b>Grant admin consent</b></li>
              <li>Certificates & secrets → New client secret → copier la valeur</li>
              <li>Coller <b>Client ID</b> et <b>Client Secret</b> dans la carte ci-contre</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function NSWebhookHelper() {
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const receiverUrl = `${baseUrl}/functions/v1/ns-webhook-receiver`;

  const check = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ns-webhook-setup", { body: { action: "list" } });
      if (error) throw error;
      const types = ["CDR", "SMS", "Voicemail"];
      const present: Record<string, boolean> = {};
      const list: any[] = (data as any)?.subscriptions ?? [];
      types.forEach((t) => { present[t] = list.some((s) => String(s.event_type || s.type || "").toLowerCase().includes(t.toLowerCase())); });
      setStatus(present);
    } catch (e: any) {
      setMsg(e.message || "Erreur de vérification");
    } finally { setBusy(false); }
  };

  const register = async () => {
    setBusy(true); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("ns-webhook-setup", { body: { action: "register" } });
      if (error) throw error;
      setMsg(`✅ ${((data as any)?.registered ?? 3)} webhooks enregistrés`);
      await check();
    } catch (e: any) {
      setMsg(`❌ ${e.message || "Échec d'enregistrement"}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-700">Webhooks NS-API</p>
        <button onClick={check} disabled={busy} className="text-[11px] underline text-slate-600 disabled:opacity-50">Vérifier</button>
      </div>
      <div className="flex flex-col gap-1">
        {["CDR", "SMS", "Voicemail"].map((t) => (
          <div key={t} className="flex items-center justify-between">
            <span className="text-slate-600">{t}</span>
            <span>{status === null ? "—" : status[t] ? "✅" : "❌"}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span className="truncate font-mono">{receiverUrl}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(receiverUrl); setMsg("URL copiée"); }}
          className="px-2 py-0.5 border rounded text-slate-600"
        >📋</button>
      </div>
      <button onClick={register} disabled={busy} className="w-full px-3 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-60" style={{ background: "#1F4E79" }}>
        {busy ? "…" : "Enregistrer les webhooks"}
      </button>
      {msg && <p className="text-[11px] text-slate-700">{msg}</p>}
    </div>
  );
}


function MaestroPanel() {
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<any[] | null>(null);
  const [stats, setStats] = useState<{ cdr: number; tasks: number; appts: number; errors: number } | null>(null);

  const base = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const webhookUrl = `${base}/functions/v1/maestro-webhook-receiver`;

  const loadStats = async () => {
    try {
      const [{ count: cdr }, { count: tasks }, { count: appts }, { count: errors }] = await Promise.all([
        supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).eq("maestro_synced", true),
        supabase.from("planipret_pipeline_logs").select("id", { count: "exact", head: true }).eq("step", "maestro_actions").eq("status", "success"),
        supabase.from("planipret_pipeline_logs").select("id", { count: "exact", head: true }).eq("step", "appointment").eq("status", "success"),
        supabase.from("planipret_pipeline_logs").select("id", { count: "exact", head: true }).eq("status", "error").gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
      ]);
      setStats({ cdr: cdr ?? 0, tasks: tasks ?? 0, appts: appts ?? 0, errors: errors ?? 0 });
    } catch {}
  };

  useEffect(() => { loadStats(); }, []);

  const runTest = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("maestro-pipeline-test", { body: {} });
      if (error) throw error;
      setSteps((data as any)?.steps ?? []);
    } catch (e: any) {
      setSteps([{ name: "Erreur", ok: false, ms: 0, details: { error: e?.message } }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="mb-3 space-y-2">
      {/* Webhook URL */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
        <p className="font-semibold text-slate-700 mb-1">Webhook Maestro → AVA</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate font-mono text-[10px] text-slate-600">{webhookUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(webhookUrl); }} className="px-2 py-0.5 border rounded text-slate-600">📋</button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          Configurez aussi <code className="bg-slate-100 px-1 rounded">MAESTRO_WEBHOOK_SECRET</code>. Événements à activer dans Maestro : client.created, client.phone_updated, appointment.updated/cancelled/reminder, task.assigned/completed.
        </p>
      </div>

      {/* Pipeline test */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-slate-700">Test du pipeline complet</p>
          <button onClick={runTest} disabled={busy} className="px-3 py-1 rounded text-white font-medium disabled:opacity-60" style={{ background: "#1F4E79" }}>
            {busy ? "…" : "▶ Lancer"}
          </button>
        </div>
        {steps && (
          <ul className="space-y-1">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className={s.ok ? "text-emerald-700" : "text-red-700"}>{s.ok ? "✅" : "❌"} {s.name}</span>
                <span className="text-[10px] text-slate-500">{s.ms}ms</span>
              </li>
            ))}
            <li className="pt-1 mt-1 border-t border-slate-200 text-slate-700 font-medium">
              {steps.filter((s) => s.ok).length}/{steps.length} tests réussis
            </li>
          </ul>
        )}
      </div>

      {/* Sync stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="text-[10px] text-emerald-700">CDR synchronisés</div>
            <div className="text-lg font-bold text-emerald-900">{stats.cdr}</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
            <div className="text-[10px] text-blue-700">Tâches créées</div>
            <div className="text-lg font-bold text-blue-900">{stats.tasks}</div>
          </div>
          <div className="p-2 rounded-lg bg-purple-50 border border-purple-200">
            <div className="text-[10px] text-purple-700">RDV créés</div>
            <div className="text-lg font-bold text-purple-900">{stats.appts}</div>
          </div>
          <div className={`p-2 rounded-lg border ${stats.errors > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
            <div className="text-[10px] text-slate-600">Erreurs (7j)</div>
            <div className={`text-lg font-bold ${stats.errors > 0 ? "text-red-700" : "text-slate-700"}`}>{stats.errors}</div>
          </div>
        </div>
      )}
    </div>
  );
}
