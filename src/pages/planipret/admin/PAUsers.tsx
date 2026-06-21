import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Plus, Edit3, Trash2, ExternalLink, X, AlertTriangle, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const PRIMARY = "#1F4E79";

type Profile = {
  user_id: string; email: string; full_name: string; extension: string;
  mobile_app_enabled: boolean; voice_agent_enabled: boolean;
  ns_domain: string; elevenlabs_agent_id: string | null;
  updated_at: string; created_at: string;
};

const PAGE = 25;

export default function PAUsers() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "app" | "agent" | "offline">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [delUser, setDelUser] = useState<Profile | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [callsByUser, setCallsByUser] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("planipret_profiles").select("*").order("full_name", { ascending: true });
    setRows((data ?? []) as Profile[]);

    // Calls this month per user
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const { data: calls } = await supabase.from("planipret_phone_calls")
      .select("user_id").gte("started_at", start.toISOString());
    const map: Record<string, number> = {};
    (calls ?? []).forEach((c: any) => { map[c.user_id] = (map[c.user_id] ?? 0) + 1; });
    setCallsByUser(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "app" && !r.mobile_app_enabled) return false;
      if (filter === "agent" && !r.voice_agent_enabled) return false;
      if (filter === "offline" && r.mobile_app_enabled) return false;
      if (search) {
        const s = search.toLowerCase();
        return r.full_name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.extension?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [rows, filter, search]);

  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const toggleField = async (u: Profile, field: "mobile_app_enabled" | "voice_agent_enabled") => {
    setSavingId(u.user_id);
    const next = !u[field];
    setRows((p) => p.map((r) => r.user_id === u.user_id ? { ...r, [field]: next } : r));
    const { data, error } = await supabase.functions.invoke("pp-admin-user", {
      body: { action: "update", payload: { user_id: u.user_id, updates: { [field]: next } } },
    });
    setSavingId(null);
    if (error || !(data as any)?.success) {
      setRows((p) => p.map((r) => r.user_id === u.user_id ? { ...r, [field]: !next } : r));
      toast.error("Erreur de mise à jour");
    } else {
      toast.success("Mis à jour");
    }
  };

  const bulkToggle = async (field: "mobile_app_enabled" | "voice_agent_enabled", value: boolean) => {
    const ids = Array.from(selected);
    for (const id of ids) {
      await supabase.functions.invoke("pp-admin-user", { body: { action: "update", payload: { user_id: id, updates: { [field]: value } } } });
    }
    setSelected(new Set());
    await load();
    toast.success(`${ids.length} courtier(s) mis à jour`);
  };

  const bulkDelete = async () => {
    if (!confirm(`Supprimer ${selected.size} courtier(s) ?`)) return;
    for (const id of Array.from(selected)) {
      await supabase.functions.invoke("pp-admin-user", { body: { action: "delete", payload: { user_id: id } } });
    }
    setSelected(new Set());
    await load();
    toast.success("Suppression terminée");
  };

  const adminCount = rows.length; // proxy — extend later with role filter
  return (
    <div className="space-y-4">
      {/* Onboard first Planipret admin */}
      {!loading && adminCount <= 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <div className="text-blue-600 text-xl leading-none">ℹ️</div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-blue-900">Créez un compte admin Planiprêt</p>
            <p className="text-xs text-blue-800 mt-1">
              Ajoutez un administrateur Planiprêt pour qu'il puisse gérer ses courtiers de façon autonome.
            </p>
          </div>
          <button onClick={() => setAddOpen(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: PRIMARY }}>
            + Ajouter un admin
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: "#0F1924" }}>Courtiers</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{rows.length} courtier{rows.length > 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher un courtier..." className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm w-72" />
          </div>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: PRIMARY }}>
            <Plus className="w-4 h-4" /> Ajouter un courtier
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {([
          ["all", "Tous"], ["app", "App activée"], ["agent", "Agent IA activé"], ["offline", "Hors ligne"],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setFilter(k); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === k ? "text-white" : "bg-white border border-slate-200 text-slate-600"}`}
            style={filter === k ? { background: PRIMARY } : undefined}>
            {l}
          </button>
        ))}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-blue-900">{selected.size} courtier(s) sélectionné(s)</span>
          <div className="flex gap-2">
            <button onClick={() => bulkToggle("mobile_app_enabled", true)} className="px-3 py-1.5 rounded-lg text-xs bg-white border border-slate-200">📱 Activer app</button>
            <button onClick={() => bulkToggle("voice_agent_enabled", true)} className="px-3 py-1.5 rounded-lg text-xs bg-white border border-slate-200">🤖 Activer agent</button>
            <button onClick={bulkDelete} className="px-3 py-1.5 rounded-lg text-xs bg-red-500 text-white">🗑️ Supprimer</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr className="text-left">
                <th className="p-3 w-8"><input type="checkbox" checked={paged.length > 0 && paged.every((r) => selected.has(r.user_id))}
                  onChange={(e) => {
                    const ns = new Set(selected);
                    paged.forEach((r) => e.target.checked ? ns.add(r.user_id) : ns.delete(r.user_id));
                    setSelected(ns);
                  }} /></th>
                <th className="p-3">Nom complet</th>
                <th className="p-3">Courriel</th>
                <th className="p-3">Ext.</th>
                <th className="p-3">App</th>
                <th className="p-3">Agent IA</th>
                <th className="p-3">Appels mois</th>
                <th className="p-3">Dernière activité</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-3"><div className="w-4 h-4 animate-pulse bg-slate-200 rounded" /></td>
                    <td className="p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full animate-pulse bg-slate-200" /><div className="h-3 w-24 animate-pulse bg-slate-200 rounded" /></div></td>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="p-3"><div className="h-3 w-3/4 animate-pulse bg-slate-200 rounded" /></td>
                    ))}
                    <td className="p-3"><div className="h-6 w-10 rounded-full animate-pulse bg-slate-200" /></td>
                    <td className="p-3"><div className="h-6 w-10 rounded-full animate-pulse bg-slate-200" /></td>
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400">Aucun courtier</td></tr>
              ) : paged.map((u) => (
                <tr key={u.user_id} className={`border-t border-slate-100 hover:bg-slate-50 transition ${highlightId === u.user_id ? "bg-yellow-50" : ""}`}>
                  <td className="p-3"><input type="checkbox" checked={selected.has(u.user_id)} onChange={(e) => {
                    const ns = new Set(selected);
                    e.target.checked ? ns.add(u.user_id) : ns.delete(u.user_id);
                    setSelected(ns);
                  }} /></td>
                  <td className="p-3 font-medium" style={{ color: "#0F1924" }}>{u.full_name}</td>
                  <td className="p-3 text-slate-600">{u.email}</td>
                  <td className="p-3 text-slate-600 tabular-nums">{u.extension}</td>
                  <td className="p-3"><Toggle on={u.mobile_app_enabled} loading={savingId === u.user_id} onChange={() => toggleField(u, "mobile_app_enabled")} /></td>
                  <td className="p-3"><Toggle on={u.voice_agent_enabled} loading={savingId === u.user_id} onChange={() => toggleField(u, "voice_agent_enabled")} /></td>
                  <td className="p-3 text-slate-700 tabular-nums">{callsByUser[u.user_id] ?? 0}</td>
                  <td className="p-3 text-slate-400 text-xs">{u.updated_at ? new Date(u.updated_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                  <td className="p-3 flex items-center gap-1">
                    <button onClick={() => setEditUser(u)} className="p-1.5 rounded hover:bg-slate-100" title="Modifier"><Edit3 className="w-3.5 h-3.5 text-slate-600" /></button>
                    <a href="/mplanipret" target="_blank" rel="noopener" className="p-1.5 rounded hover:bg-slate-100" title="Prévisualiser"><ExternalLink className="w-3.5 h-3.5 text-slate-600" /></a>
                    <button onClick={() => setDelUser(u)} className="p-1.5 rounded hover:bg-red-50" title="Supprimer"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Affichage de {(page - 1) * PAGE + 1} à {Math.min(page * PAGE, filtered.length)} sur {filtered.length}</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 border rounded disabled:opacity-40">← Précédent</button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-2 py-1 border rounded disabled:opacity-40">Suivant →</button>
          </div>
        </div>
      </div>

      {addOpen && <UserModal mode="add" onClose={() => setAddOpen(false)} onSaved={async (id) => { setAddOpen(false); await load(); if (id) { setHighlightId(id); setTimeout(() => setHighlightId(null), 3000); } }} />}
      {editUser && <UserModal mode="edit" user={editUser} onClose={() => setEditUser(null)} onSaved={async () => { setEditUser(null); await load(); }} />}
      {delUser && <DeleteModal user={delUser} onClose={() => setDelUser(null)} onDeleted={async () => { setDelUser(null); await load(); }} />}
    </div>
  );
}

function Toggle({ on, loading, onChange }: { on: boolean; loading?: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} disabled={loading} className={`w-10 h-6 rounded-full p-0.5 transition ${on ? "" : "bg-slate-300"} ${loading ? "opacity-60" : ""}`} style={on ? { background: PRIMARY } : undefined}>
      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function UserModal({ mode, user, onClose, onSaved }: { mode: "add" | "edit"; user?: Profile; onClose: () => void; onSaved: (id?: string) => void }) {
  const isEdit = mode === "edit";
  const [firstName, setFirstName] = useState(user?.full_name?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(user?.full_name?.split(" ").slice(1).join(" ") ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [extension, setExtension] = useState(user?.extension ?? "");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [appEnabled, setAppEnabled] = useState(user?.mobile_app_enabled ?? true);
  const [agentEnabled, setAgentEnabled] = useState(user?.voice_agent_enabled ?? false);
  const [agentId, setAgentId] = useState(user?.elevenlabs_agent_id ?? "");
  const [agentSecOpen, setAgentSecOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!firstName || !lastName || !email || !extension || (!isEdit && !password)) {
      toast.error("Champs requis manquants"); return;
    }
    setBusy(true);
    const full_name = `${firstName} ${lastName}`.trim();
    if (isEdit) {
      const { data, error } = await supabase.functions.invoke("pp-admin-user", {
        body: { action: "update", payload: { user_id: user!.user_id, updates: { full_name, extension, mobile_app_enabled: appEnabled, voice_agent_enabled: agentEnabled, elevenlabs_agent_id: agentId || null } } },
      });
      setBusy(false);
      if (error || !(data as any)?.success) { toast.error((data as any)?.error ?? "Erreur"); return; }
      toast.success("Courtier mis à jour");
      onSaved();
    } else {
      const { data, error } = await supabase.functions.invoke("pp-admin-user", {
        body: { action: "create", payload: { email, password, full_name, ns_extension: extension, mobile_app_enabled: appEnabled, voice_agent_enabled: agentEnabled, elevenlabs_agent_id: agentId || null } },
      });
      setBusy(false);
      if (error || !(data as any)?.success) { toast.error((data as any)?.error ?? "Erreur de création"); return; }
      toast.success(`Courtier ${full_name} créé ✅`);
      onSaved((data as any).user_id);
    }
  };

  const resetPwd = async () => {
    const { data } = await supabase.functions.invoke("pp-admin-user", { body: { action: "reset_password", payload: { email } } });
    if ((data as any)?.success) toast.success("Email de réinitialisation envoyé");
    else toast.error("Échec de l'envoi");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? `Modifier ${user?.full_name}` : "Ajouter un courtier"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Section title="Informations personnelles">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom *"><input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" /></Field>
              <Field label="Nom de famille *"><input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" /></Field>
            </div>
            <Field label="Courriel professionnel *" hint="Ex: jdupont@planipret.ca">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} className="input" />
            </Field>
          </Section>

          <Section title="Téléphonie">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Extension NS *" hint="Ex: 1234"><input value={extension} onChange={(e) => setExtension(e.target.value)} maxLength={5} className="input" /></Field>
              <Field label="Domaine NS"><input value="planipret.ca" readOnly className="input bg-slate-50" /></Field>
            </div>
            {!isEdit ? (
              <Field label="Mot de passe initial *">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input pr-9" />
                    <button onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button onClick={() => setPassword(genPassword())} className="px-3 py-2 rounded-lg border border-slate-200 text-xs flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Générer
                  </button>
                </div>
              </Field>
            ) : (
              <button onClick={resetPwd} className="text-sm px-3 py-2 rounded-lg border border-slate-200">🔑 Réinitialiser le mot de passe</button>
            )}
          </Section>

          <Section title="Accès application">
            <div className="space-y-2">
              <ToggleRow label="Activer l'app mobile" desc="Le courtier pourra accéder à /mplanipret" on={appEnabled} onChange={setAppEnabled} />
              <ToggleRow label="Activer l'agent vocal AVA" desc="Le courtier pourra utiliser l'assistant IA" on={agentEnabled} onChange={setAgentEnabled} />
            </div>
          </Section>

          <div>
            <button onClick={() => setAgentSecOpen(!agentSecOpen)} className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              {agentSecOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Agent ElevenLabs (optionnel)
            </button>
            {agentSecOpen && (
              <Field label="ElevenLabs Agent ID" hint="Laisser vide pour utiliser l'agent partagé Planiprêt">
                <input value={agentId} onChange={(e) => setAgentId(e.target.value)} className="input" />
              </Field>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Annuler</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: PRIMARY }}>
            {busy ? "…" : isEdit ? "Sauvegarder" : "Créer le courtier"}
          </button>
        </div>
      </div>
      <style>{`.input{width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px}.input:focus{outline:none;border-color:#94a3b8}`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{title}</p>
      {children}
    </div>
  );
}
function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
function ToggleRow({ label, desc, on, onChange }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div><p className="text-sm font-medium">{label}</p><p className="text-[11px] text-slate-500">{desc}</p></div>
      <Toggle on={on} onChange={() => onChange(!on)} />
    </div>
  );
}

function DeleteModal({ user, onClose, onDeleted }: { user: Profile; onClose: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { data } = await supabase.functions.invoke("pp-admin-user", { body: { action: "delete", payload: { user_id: user.user_id } } });
    setBusy(false);
    if (!(data as any)?.success) { toast.error("Erreur de suppression"); return; }
    toast.success("Courtier supprimé");
    onDeleted();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <h2 className="font-semibold text-lg">Supprimer {user.full_name}?</h2>
              <p className="text-sm text-slate-600 mt-1">Cette action est irréversible. Le courtier perdra immédiatement accès à l'application.</p>
            </div>
          </div>
          <ul className="text-xs text-slate-600 space-y-1 mb-4 bg-slate-50 p-3 rounded-lg">
            <li>✓ Compte d'authentification</li>
            <li>✓ Profil et données</li>
            <li>✓ Extension NS-API {user.extension}</li>
            <li>✓ Historique des appels conservé</li>
          </ul>
          <label className="block text-xs text-slate-600 mb-1">Tapez le nom du courtier pour confirmer :</label>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={user.full_name}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-4" />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Annuler</button>
            <button onClick={submit} disabled={confirm !== user.full_name || busy} className="px-4 py-2 rounded-lg text-white text-sm font-medium bg-red-500 disabled:opacity-50">
              {busy ? "…" : "Supprimer définitivement"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
