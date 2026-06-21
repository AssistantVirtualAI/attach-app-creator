import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  User, Lock, Phone, Info, Mail, Bell, Moon, HelpCircle, MessageCircle,
  LogOut, ChevronRight, Bot, Sparkles, X, Download, Shield, BellOff, Settings as SettingsIcon, BarChart3,
} from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";
import { usePlanipretPush } from "@/hooks/usePlanipretPush";
import { CalendarSyncCard } from "@/components/planipret/CalendarSyncCard";
import { SiriShortcutsCard } from "@/components/planipret/SiriShortcutsCard";

const PRIMARY = "#1F4E79";

const initials = (name?: string) => (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

export default function MMore() {
  const { profile, reloadProfile } = useOutletContext<PlanipretMobileContext>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dndOpen, setDndOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => localStorage.getItem("planipret_notif") === "1");
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("planipret_dark") === "1");
  const [agentOn, setAgentOn] = useState<boolean>(() => localStorage.getItem("planipret_agent_on") !== "0");

  useEffect(() => { if (params.get("ms365") === "ok") toast.success("Microsoft 365 connecté ✅"); }, [params]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("planipret_dark", darkMode ? "1" : "0");
  }, [darkMode]);

  const nsConnected = !!profile?.ns_jwt && (!profile?.ns_jwt_expires_at || new Date(profile.ns_jwt_expires_at) > new Date());
  const ms365Connected = !!profile?.ms365_access_token;

  const reconnectNs = async () => {
    setReconnecting(true);
    const { data, error } = await supabase.functions.invoke("ns-auth", { body: { action: "refresh" } });
    setReconnecting(false);
    if (error || (data as any)?.success === false) { toast.error("Échec de connexion. Vérifiez vos identifiants."); return; }
    toast.success("Connexion téléphonique établie ✅");
    await reloadProfile();
  };

  const connectMs365 = async () => {
    const { data } = await supabase.from("planipret_integration_secrets").select("config").eq("provider", "microsoft").maybeSingle();
    const cfg = (data?.config ?? {}) as any;
    const clientId = cfg.client_id;
    const tenant = cfg.tenant_id ?? "common";
    if (!clientId) { toast.error("Microsoft 365 non configuré par l'admin"); return; }
    const redirect = `${window.location.origin}/auth/ms365/callback`;
    const scope = encodeURIComponent("openid profile email Mail.ReadWrite Calendars.ReadWrite offline_access");
    const { data: { user } } = await supabase.auth.getUser();
    const state = user?.id ?? "";
    window.location.href = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&response_mode=query&scope=${scope}&state=${state}`;
  };

  const disconnectMs365 = async () => {
    if (!confirm("Déconnecter Microsoft 365 ?")) return;
    await supabase.from("planipret_profiles").update({ ms365_access_token: null, ms365_refresh_token: null }).eq("user_id", profile.user_id);
    await reloadProfile();
    toast.success("Microsoft 365 déconnecté");
  };

  const toggleNotif = async (on: boolean) => {
    if (on && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("Permission refusée"); return; }
    }
    setNotifEnabled(on);
    localStorage.setItem("planipret_notif", on ? "1" : "0");
  };

  const logout = async () => {
    if (!confirm("Êtes-vous sûr de vouloir vous déconnecter?")) return;
    await supabase.auth.signOut();
    toast.success("Déconnecté avec succès");
    navigate("/login", { replace: true });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Profile header */}
      <header className="flex flex-col items-center pt-3 pb-2">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ background: PRIMARY }}>
          {initials(profile?.full_name)}
        </div>
        <p className="mt-2 font-semibold text-[18px]" style={{ color: "#1A1A2E" }}>{profile?.full_name ?? "Courtier"}</p>
        <p className="text-[14px] text-slate-500">{profile?.extension ? `${profile.extension}@planipret.ca` : profile?.email}</p>
      </header>

      <Section title="Pipeline & Performance">
        <Row icon={<BarChart3 className="w-4 h-4" />} label="📊 Pipeline des dossiers" onClick={() => navigate("/mplanipret/pipeline")} chevron />
        <Row icon={<BarChart3 className="w-4 h-4" />} label="📈 Mes performances" onClick={() => navigate("/mplanipret/stats")} chevron />
      </Section>

      <Section title="Mon compte">
        <Row icon={<User className="w-4 h-4" />} label="Mon profil" onClick={() => setEditOpen(true)} chevron />
        <Row icon={<Lock className="w-4 h-4" />} label="Changer le mot de passe" onClick={() => navigate("/reset-password")} chevron />
        <Row icon={<Download className="w-4 h-4" />} label="📦 Mes données" sub="Téléchargez toutes vos données (Loi 25 / PIPEDA)"
          onClick={async () => {
            toast.info("Préparation de votre export…");
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pp-gdpr-export`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ broker_id: profile.id }),
            });
            if (!res.ok) { toast.error("Échec de l'export"); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `mes-donnees-planipret.json`; a.click();
            URL.revokeObjectURL(url);
            toast.success("Export téléchargé ✅");
          }} chevron />
      </Section>

      <Section title="Téléphonie">
        <Row icon={<Phone className="w-4 h-4" />} label="Connexion téléphonique" onClick={reconnectNs}
          right={
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${nsConnected ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-slate-500">{reconnecting ? "…" : nsConnected ? "Connecté" : "Déconnecté"}</span>
            </span>
          } />
        <Row icon={<Info className="w-4 h-4" />} label="Mon extension" right={<span className="text-[12px] text-slate-500">{profile?.extension ?? "—"}</span>} />
      </Section>

      <Section title="Disponibilité">
        <Row
          icon={<BellOff className="w-4 h-4" style={{ color: profile?.dnd_enabled ? "#E84C4C" : undefined }} />}
          label="🔕 Mode Ne pas déranger"
          sub={profile?.dnd_enabled ? "Actif — AVA répond pour vous" : "Inactif"}
          right={<Toggle on={!!profile?.dnd_enabled} onChange={async (v) => {
            await supabase.from("planipret_profiles").update({ dnd_enabled: v }).eq("user_id", profile.user_id);
            await reloadProfile();
            toast.success(v ? "DND activé" : "DND désactivé");
          }} />}
        />
        <Row icon={<SettingsIcon className="w-4 h-4" />} label="⚙️ Configurer le mode DND" onClick={() => setDndOpen(true)} chevron />
      </Section>


      <Section title="Intégrations">
        <Row icon={<Mail className="w-4 h-4" style={{ color: "#0078D4" }} />} label="Microsoft 365"
          onClick={ms365Connected ? disconnectMs365 : connectMs365}
          right={
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${ms365Connected ? "bg-green-500" : "bg-slate-300"}`} />
              <span className="text-slate-500">{ms365Connected ? "Connecté" : "Non connecté"}</span>
            </span>
          } chevron />
        {ms365Connected && <CalendarSyncCard profile={profile} />}
      </Section>

      <SiriShortcutsCard />

      {profile?.voice_agent_enabled && (
        <Section title="Assistant IA">
          <Row icon={<Bot className="w-4 h-4" style={{ color: PRIMARY }} />} label="Assistant vocal AVA"
            sub="AVA peut répondre à vos appels et gérer vos tâches"
            right={<Toggle on={agentOn} onChange={(v) => { setAgentOn(v); localStorage.setItem("planipret_agent_on", v ? "1" : "0"); }} />} />
          <Row icon={<Sparkles className="w-4 h-4" />} label="Personnaliser AVA" onClick={() => setCustomizeOpen(true)} chevron />
        </Section>
      )}

      <Section title="Préférences">
        <Row icon={<Bell className="w-4 h-4" />} label="Notifications" right={<Toggle on={notifEnabled} onChange={toggleNotif} />} />
        <Row icon={<Moon className="w-4 h-4" />} label="Mode sombre" right={<Toggle on={darkMode} onChange={setDarkMode} />} />
      </Section>

      <NotificationsSection profile={profile} reloadProfile={reloadProfile} />

      <Section title="Aide & support">
        <Row icon={<HelpCircle className="w-4 h-4" />} label="Centre d'aide" onClick={() => setHelpOpen(true)} chevron />
        <Row icon={<MessageCircle className="w-4 h-4" />} label="Contacter le support"
          onClick={() => { window.location.href = "mailto:support@avastatistic.ca?subject=Support%20Planipr%C3%AAt%20AI%20Portal"; }} chevron />
        <Row icon={<Shield className="w-4 h-4" />} label="🔏 Politique de confidentialité" onClick={() => navigate("/planipret/privacy")} chevron />
        <Row icon={<Info className="w-4 h-4" />} label="Version de l'app" right={<span className="text-[12px] text-slate-400">v1.0.0 (build 1)</span>} />
      </Section>

      <Section title="Compte">
        <button onClick={logout} className="w-full px-4 h-14 flex items-center gap-3 text-left active:bg-red-50 transition">
          <LogOut className="w-4 h-4 text-red-500" />
          <span className="flex-1 text-sm font-medium text-red-600">Se déconnecter</span>
        </button>
      </Section>

      {editOpen && <EditProfileSheet profile={profile} onClose={() => setEditOpen(false)} onSaved={reloadProfile} />}
      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
      {customizeOpen && <CustomizeSheet profile={profile} onClose={() => setCustomizeOpen(false)} onSaved={reloadProfile} />}
      {dndOpen && <DndSheet profile={profile} onClose={() => setDndOpen(false)} onSaved={reloadProfile} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y" style={{ borderColor: "#F0F0F0" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ icon, label, sub, onClick, right, chevron }: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void; right?: React.ReactNode; chevron?: boolean }) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`w-full px-4 ${sub ? "py-3" : "h-14"} flex items-center gap-3 text-left ${onClick ? "active:bg-slate-50 transition" : ""}`}>
      <span className="text-slate-600">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium" style={{ color: "#1A1A2E" }}>{label}</span>
        {sub && <span className="block text-[11px] text-slate-400 mt-0.5">{sub}</span>}
      </span>
      {right}
      {chevron && <ChevronRight className="w-4 h-4 text-slate-300" />}
    </Comp>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(!on); }} className={`w-10 h-6 rounded-full p-0.5 transition ${on ? "" : "bg-slate-300"}`} style={on ? { background: PRIMARY } : undefined}>
      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

function NotificationsSection({ profile, reloadProfile }: { profile: any; reloadProfile: () => Promise<void> }) {
  const { subscribe, sendTest, busy } = usePlanipretPush();
  const setPref = async (field: string, val: boolean) => {
    await supabase.from("planipret_profiles").update({ [field]: val }).eq("user_id", profile.user_id);
    await reloadProfile();
  };
  const enablePush = async () => {
    const ok = await subscribe(profile.user_id);
    if (ok) await reloadProfile();
  };
  return (
    <Section title="Notifications push">
      <Row icon={<Bell className="w-4 h-4" />} label="Activer notifications push" onClick={enablePush} sub="Recevoir des alertes même app fermée" chevron />
      <Row icon={<Phone className="w-4 h-4" />} label="Appels entrants" right={<Toggle on={!!profile?.notif_calls} onChange={(v) => setPref("notif_calls", v)} />} />
      <Row icon={<Bell className="w-4 h-4" />} label="Nouveaux SMS" right={<Toggle on={!!profile?.notif_sms} onChange={(v) => setPref("notif_sms", v)} />} />
      <Row icon={<Bell className="w-4 h-4" />} label="Nouveaux voicemails" right={<Toggle on={!!profile?.notif_voicemails} onChange={(v) => setPref("notif_voicemails", v)} />} />
      <Row icon={<Sparkles className="w-4 h-4" />} label="Analyses IA prêtes" right={<Toggle on={!!profile?.notif_ai} onChange={(v) => setPref("notif_ai", v)} />} />
      <Row icon={<Bell className="w-4 h-4" />} label="Rappels" right={<Toggle on={!!profile?.notif_reminders} onChange={(v) => setPref("notif_reminders", v)} />} />
      <Row icon={<Sparkles className="w-4 h-4" />} label="🔥 Leads chauds sans suivi" right={<Toggle on={profile?.notif_hot_leads !== false} onChange={(v) => setPref("notif_hot_leads", v)} />} />
      <Row icon={<Bell className="w-4 h-4" />} label="📅 Rappel RDV imminents" right={<Toggle on={profile?.notif_appointment_reminder !== false} onChange={(v) => setPref("notif_appointment_reminder", v)} />} />
      <Row icon={<Phone className="w-4 h-4" />} label="📞 Appels manqués non traités" right={<Toggle on={profile?.notif_missed_call !== false} onChange={(v) => setPref("notif_missed_call", v)} />} />
      <Row icon={<Sparkles className="w-4 h-4" />} label="☀️ Briefing matinal (08:30)" right={<Toggle on={profile?.notif_morning_brief !== false} onChange={(v) => setPref("notif_morning_brief", v)} />} />
      <Row icon={<Sparkles className="w-4 h-4" />} label="📊 Résumé fin de journée (17:30)" right={<Toggle on={profile?.notif_eod_summary !== false} onChange={(v) => setPref("notif_eod_summary", v)} />} />
      <Row icon={<Sparkles className="w-4 h-4" />} label={busy ? "Envoi…" : "Tester une notification"} onClick={() => sendTest(profile.user_id)} chevron />
    </Section>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full md:w-[360px] rounded-t-2xl md:rounded-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: "#1A1A2E" }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditProfileSheet({ profile, onClose, onSaved }: { profile: any; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(profile?.full_name ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("planipret_profiles").update({ full_name: name }).eq("user_id", profile.user_id);
    setBusy(false);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Profil mis à jour");
    await onSaved();
    onClose();
  };
  return (
    <Sheet title="Mon profil" onClose={onClose}>
      <label className="block text-xs text-slate-500 mb-1">Nom complet</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm mb-3" />
      <label className="block text-xs text-slate-500 mb-1">Email</label>
      <input value={profile?.email ?? ""} readOnly className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-50 mb-3" />
      <label className="block text-xs text-slate-500 mb-1">Extension</label>
      <input value={profile?.extension ?? ""} readOnly className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-50 mb-3" />
      <label className="block text-xs text-slate-500 mb-1">Domaine</label>
      <input value={profile?.ns_domain ?? ""} readOnly className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-50 mb-3" />
      <button onClick={save} disabled={busy} className="w-full py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: PRIMARY }}>
        {busy ? "Enregistrement…" : "Sauvegarder"}
      </button>
    </Sheet>
  );
}

function HelpSheet({ onClose }: { onClose: () => void }) {
  const faq = [
    { q: "Comment passer un appel?", a: "Utilisez le bouton 📞 bleu en bas de l'écran." },
    { q: "Comment activer l'agent AVA?", a: "Contactez votre administrateur Planiprêt." },
    { q: "Mes appels ne fonctionnent pas?", a: "Vérifiez votre connexion dans Plus → Connexion téléphonique." },
  ];
  return (
    <Sheet title="Centre d'aide" onClose={onClose}>
      <div className="space-y-3">
        {faq.map((f, i) => (
          <div key={i} className="border-b border-slate-100 pb-3 last:border-0">
            <p className="font-medium text-sm" style={{ color: "#1A1A2E" }}>{f.q}</p>
            <p className="text-xs text-slate-600 mt-1">{f.a}</p>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function CustomizeSheet({ profile, onClose, onSaved }: { profile: any; onClose: () => void; onSaved: () => Promise<void> }) {
  const [lang, setLang] = useState<string>(profile?.language ?? "fr");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await supabase.from("planipret_profiles").update({ language: lang }).eq("user_id", profile.user_id);
    setBusy(false);
    toast.success("Préférences sauvegardées");
    await onSaved();
    onClose();
  };
  return (
    <Sheet title="Personnaliser AVA" onClose={onClose}>
      <p className="text-xs text-slate-500 mb-2">AVA répond en :</p>
      <div className="flex gap-2 mb-3">
        {(["fr", "en"] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${lang === l ? "text-white" : "bg-slate-100 text-slate-600"}`}
            style={lang === l ? { background: PRIMARY } : undefined}>
            {l === "fr" ? "🇫🇷 Français" : "🇬🇧 English"}
          </button>
        ))}
      </div>
      <button onClick={save} disabled={busy} className="w-full py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: PRIMARY }}>
        {busy ? "…" : "Sauvegarder"}
      </button>
    </Sheet>
  );
}

function DndSheet({ profile, onClose, onSaved }: { profile: any; onClose: () => void; onSaved: () => Promise<void> }) {
  const [enabled, setEnabled] = useState<boolean>(!!profile?.dnd_enabled);
  const [auto, setAuto] = useState<boolean>(!!profile?.dnd_auto_schedule);
  const [start, setStart] = useState<string>(profile?.dnd_start_time?.slice(0,5) ?? "18:00");
  const [end, setEnd] = useState<string>(profile?.dnd_end_time?.slice(0,5) ?? "08:00");
  const [msg, setMsg] = useState<string>(profile?.dnd_message_fr ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("planipret_profiles").update({
      dnd_enabled: enabled,
      dnd_auto_schedule: auto,
      dnd_start_time: start,
      dnd_end_time: end,
      dnd_message_fr: msg,
    }).eq("user_id", profile.user_id);
    setBusy(false);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Préférences DND enregistrées");
    await onSaved();
    onClose();
  };
  return (
    <Sheet title="🔕 Mode Ne pas déranger" onClose={onClose}>
      <div className="flex items-center justify-between py-2 border-b border-slate-100">
        <span className="text-sm">Activer le mode DND</span>
        <Toggle on={enabled} onChange={setEnabled} />
      </div>
      <div className="flex items-center justify-between py-2 border-b border-slate-100">
        <span className="text-sm">Activer automatiquement selon horaire</span>
        <Toggle on={auto} onChange={setAuto} />
      </div>
      {auto && (
        <div className="grid grid-cols-2 gap-3 py-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Début</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fin</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
        </div>
      )}
      <label className="block text-xs text-slate-500 mb-1 mt-2">Message de réponse automatique</label>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-3" />
      <button onClick={save} disabled={busy} className="w-full py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: PRIMARY }}>
        {busy ? "…" : "Sauvegarder"}
      </button>
    </Sheet>
  );
}
