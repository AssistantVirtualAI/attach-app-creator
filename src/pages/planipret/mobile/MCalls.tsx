import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, X, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Copy,
  Bot, ChevronDown, ChevronUp, Pause, Play, Mic, MicOff, ArrowRightLeft, Loader2,
  Check, Sparkles, RefreshCw, Voicemail as VmIcon, Save, Trash2, FileText,
} from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";
import { TEMP_COLORS, TEMP_EMOJI, TEMP_LABEL, tempBorder, callbackDelayToDate, delayLabel, type LeadTemp } from "@/components/planipret/leadHelpers";
import ContactTimeline from "@/components/planipret/ContactTimeline";


const PRIMARY = "var(--pp-brand-accent-2)";
const ACCENT = "var(--pp-brand-accent)";
const SUCCESS = "var(--pp-success)";
const DANGER = "var(--pp-danger)";
const PURPLE = "var(--pp-agent)";

type Call = {
  id: string;
  user_id: string;
  ns_call_id: string | null;
  direction: string;
  status: string | null;
  from_number: string | null;
  from_name: string | null;
  to_number: string | null;
  to_name: string | null;
  started_at: string;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  ai_summary: string | null;
  metadata: any;
  lead_score?: number | null;
  lead_temperature?: LeadTemp;
  lead_score_reason?: string | null;
  suggested_callback_delay?: string | null;
  callback_reason?: string | null;
};

type Insight = {
  call_id: string;
  summary: string | null;
  coaching_notes: string | null;
  customer_intent: string | null;
  sentiment: string | null;
  topics: any;
  suggested_actions: any;
};

// ---------- helpers ----------
const isOutbound = (c: Call) => c.direction === "outbound";
const isMissed = (c: Call) => c.direction === "missed" || c.status === "missed";

const otherNumber = (c: Call) => (isOutbound(c) ? c.to_number : c.from_number) || "";
const otherName = (c: Call) => (isOutbound(c) ? c.to_name : c.from_name) || "";
const displayLabel = (c: Call) => otherName(c) || otherNumber(c) || "Inconnu";

const frenchDateTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = d.toDateString() === today.toDateString();
  const isYest = d.toDateString() === yest.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `Aujourd'hui, ${hh}h${mm}`;
  if (isYest) return `Hier, ${hh}h${mm}`;
  return `${d.toLocaleDateString("fr-CA", { day: "2-digit", month: "short" })}, ${hh}h${mm}`;
};
const frenchDuration = (s: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec} sec`;
  return `${m} min ${sec} sec`;
};

// ---------- main ----------
export default function MCalls() {
  const { profile, openDialer, registerRefresh } = useOutletContext<PlanipretMobileContext>();
  const [params, setParams] = useSearchParams();
  const initialTab = (params.get("tab") as any) || "recents";
  const [tab, setTab] = useState<"recents" | "active" | "missed" | "recordings" | "voicemails">(
    ["recents", "active", "missed", "recordings", "voicemails"].includes(initialTab) ? initialTab : "recents"
  );
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Call | null>(null);

  const userId = profile?.user_id;


  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("planipret_phone_calls")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(100);
    setCalls((data ?? []) as Call[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    registerRefresh(() => load());
    return () => registerRefresh(null);
  }, [load, registerRefresh]);


  // Realtime updates on phone_calls (for new entries)
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`planipret-calls:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "planipret_phone_calls", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const missedCount = useMemo(() => calls.filter(isMissed).length, [calls]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = tab === "missed" ? calls.filter(isMissed) : calls;
    if (!q) return base;
    return base.filter((c) =>
      [c.from_number, c.to_number, c.from_name, c.to_name]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [calls, tab, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), 300);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--pp-bg-base)" }}>
      {/* Header */}
      <div
        className="px-4 pt-5 pb-3"
        style={{
          background: "var(--pp-bg-deep)",
          borderBottom: "1px solid var(--pp-bg-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: "var(--pp-text-primary)" }}>Appels</h1>
          <button
            onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(""); }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: searchOpen ? "var(--pp-bg-elevated)" : "transparent",
              color: "var(--pp-text-secondary)",
            }}
            aria-label="Rechercher"
          >
            {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
        </div>
        {searchOpen && (
          <div className="mt-3">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un numéro..."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                background: "var(--pp-bg-elevated)",
                border: "1px solid var(--pp-bg-border-2)",
                color: "var(--pp-text-primary)",
              }}
            />
          </div>
        )}
        {/* Pill Tabs */}
        <div
          className="mt-3 flex rounded-full p-1"
          style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)" }}
        >
          {[
            { k: "recents", label: "Récents" },
            { k: "active", label: "Actifs" },
            { k: "missed", label: "Manqués" },
            { k: "recordings", label: "Enreg." },
            { k: "voicemails", label: "Vocaux" },
          ].map((t) => {
            const active = tab === (t.k as any);
            const isMissedTab = t.k === "missed";
            return (
              <button
                key={t.k}
                onClick={() => { setTab(t.k as any); const np = new URLSearchParams(params); np.set("tab", t.k); setParams(np, { replace: true }); }}

                className="flex-1 py-2 text-xs font-semibold rounded-full transition flex items-center justify-center gap-1.5"
                style={
                  active
                    ? {
                        background: "linear-gradient(135deg, var(--pp-brand-accent), var(--pp-brand-accent-2))",
                        color: "white",
                        boxShadow: "0 2px 10px rgba(46,155,220,0.35)",
                      }
                    : { color: "var(--pp-text-muted)" }
                }
              >
                {t.label}
                {isMissedTab && missedCount > 0 && (
                  <span
                    className="text-[10px] text-white px-1.5 rounded-full"
                    style={{ background: "var(--pp-danger)" }}
                  >
                    {missedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {tab === "active" ? (
          <ActiveCallsTab userId={userId} openDialer={openDialer} />
        ) : tab === "recordings" ? (
          <RecordingsTab calls={calls} loading={loading} onTap={(c) => setSelected(c)} />
        ) : tab === "voicemails" ? (
          <VoicemailsTab userId={userId} openDialer={openDialer} registerRefresh={registerRefresh} />
        ) : (
          <>
            {/* Pull-to-refresh proxy */}
            <div className="px-4 pt-2 flex items-center justify-end">
              <button
                onClick={onRefresh}
                className="text-xs flex items-center gap-1 px-2 py-1"
                style={{ color: "var(--pp-text-muted)" }}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} /> Actualiser
              </button>
            </div>
            {loading ? (
              <ul className="px-3 pt-3 pb-4 space-y-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li
                    key={i}
                    className="rounded-xl px-3 py-3 flex items-center gap-3"
                    style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}
                  >
                    <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: "var(--pp-bg-elevated)" }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-[70%] animate-pulse rounded" style={{ background: "var(--pp-bg-elevated)" }} />
                      <div className="h-3 w-[40%] animate-pulse rounded" style={{ background: "var(--pp-bg-elevated)" }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : filtered.length === 0 ? (
              <EmptyState tab={tab as any} />
            ) : (
              <ul className="px-3 pb-4 space-y-1.5">
                {filtered.map((c) => (
                  <CallRow key={c.id} call={c} onTap={() => setSelected(c)} onCall={() => openDialer(otherNumber(c))} showCallBtn={tab === "missed"} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>


      {selected && (
        <CallDetailSheet
          call={selected}
          userId={userId}
          onClose={() => setSelected(null)}
          openDialer={openDialer}
          onUpdated={(updated) => {
            setSelected(updated);
            setCalls((cs) => cs.map((x) => (x.id === updated.id ? updated : x)));
          }}
        />
      )}
    </div>
  );
}

// ---------- row ----------
function CallRow({ call, onTap, onCall, showCallBtn }: { call: Call; onTap: () => void; onCall: () => void; showCallBtn?: boolean }) {
  const missed = isMissed(call);
  const out = isOutbound(call);
  const color = missed ? "var(--pp-danger)" : out ? "var(--pp-success)" : "var(--pp-brand-accent)";
  const Icon = missed ? PhoneMissed : out ? PhoneOutgoing : PhoneIncoming;
  const hasAi = !!call.ai_summary;

  return (
    <li>
      <div
        className="rounded-2xl px-3 py-3 flex items-center gap-3 active:opacity-80"
        style={{
          background: "var(--pp-bg-surface)",
          border: "1px solid var(--pp-bg-border-2)",
          borderLeft: tempBorder(call.lead_temperature as LeadTemp) || "1px solid var(--pp-bg-border-2)",
        }}
      >
        <button onClick={onTap} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div
            className="rounded-full flex items-center justify-center shrink-0"
            style={{ width: 44, height: 44, background: "var(--pp-bg-elevated)", color }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-semibold text-[15px] truncate"
              style={{ color: missed ? "var(--pp-danger)" : "var(--pp-text-primary)" }}
            >
              {displayLabel(call)}
            </div>
            <div className="text-xs truncate" style={{ color: "var(--pp-text-muted)" }}>
              {frenchDateTime(call.started_at)} · {frenchDuration(call.duration_seconds)}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasAi && (
            <span
              className="rounded-full p-1.5 flex items-center justify-center"
              style={{ background: "rgba(155,127,232,0.15)", color: "var(--pp-agent)" }}
              title="Analyse IA"
            >
              <Bot className="w-3.5 h-3.5" />
            </span>
          )}
          <button
            onClick={onCall}
            className="rounded-full flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              background: "rgba(46,155,220,0.15)",
              color: "var(--pp-brand-accent)",
            }}
            aria-label="Rappeler"
          >
            <Phone className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ---------- recordings tab ----------
function RecordingsTab({ calls, loading, onTap }: { calls: Call[]; loading: boolean; onTap: (c: Call) => void }) {
  const withRec = useMemo(() => calls.filter((c) => !!c.recording_url), [calls]);
  if (loading) {
    return (
      <ul className="px-3 pt-3 pb-4 space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-xl p-3" style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}>
            <div className="h-3 w-1/2 rounded animate-pulse mb-2" style={{ background: "var(--pp-bg-elevated)" }} />
            <div className="h-10 w-full rounded animate-pulse" style={{ background: "var(--pp-bg-elevated)" }} />
          </li>
        ))}
      </ul>
    );
  }
  if (withRec.length === 0) {
    return (
      <div className="p-10 text-center">
        <div
          className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
          style={{ background: "rgba(46,155,220,0.12)", color: "var(--pp-brand-accent)" }}
        >
          <Play className="w-6 h-6" />
        </div>
        <div className="font-semibold" style={{ color: "var(--pp-text-secondary)" }}>Aucun enregistrement</div>
        <div className="text-xs mt-1" style={{ color: "var(--pp-text-muted)" }}>
          Les appels enregistrés apparaîtront ici.
        </div>
      </div>
    );
  }
  return (
    <ul className="px-3 pt-3 pb-4 space-y-2">
      {withRec.map((c) => (
        <li
          key={c.id}
          className="rounded-2xl p-3"
          style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}
        >
          <button onClick={() => onTap(c)} className="w-full flex items-center justify-between mb-2 text-left">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate" style={{ color: "var(--pp-text-primary)" }}>
                {displayLabel(c)}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--pp-text-muted)" }}>
                {frenchDateTime(c.started_at)} · {frenchDuration(c.duration_seconds)}
              </div>
            </div>
            {c.ai_summary && (
              <span
                className="rounded-full p-1.5 flex items-center justify-center shrink-0"
                style={{ background: "rgba(155,127,232,0.15)", color: "var(--pp-agent)" }}
              >
                <Bot className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
          <audio
            controls
            preload="none"
            src={c.recording_url!}
            className="w-full"
            style={{ accentColor: "var(--pp-brand-accent)", filter: "invert(0.85) hue-rotate(180deg)" }}
          />
          {c.transcript && (
            <p
              className="mt-2 text-[11px] line-clamp-2"
              style={{ color: "var(--pp-text-secondary)" }}
            >
              {c.transcript}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------- empty ----------
function EmptyState({ tab }: { tab: "recents" | "active" | "missed" }) {
  const cfg = {
    recents: { Icon: Phone, title: "Aucun appel dans l'historique", sub: "Vos appels apparaîtront ici." },
    active: { Icon: Phone, title: "Aucun appel actif en ce moment", sub: "Utilisez le bouton 📞 pour passer un appel." },
    missed: { Icon: PhoneMissed, title: "Aucun appel manqué 🎉", sub: "Tout est sous contrôle." },
  }[tab];
  return (
    <div className="p-10 text-center">
      <div
        className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
        style={{ background: "rgba(46,155,220,0.12)", color: "var(--pp-brand-accent)" }}
      >
        <cfg.Icon className="w-6 h-6" />
      </div>
      <div className="font-semibold" style={{ color: "var(--pp-text-secondary)" }}>{cfg.title}</div>
      <div className="text-xs mt-1" style={{ color: "var(--pp-text-muted)" }}>{cfg.sub}</div>
    </div>
  );
}


// ============================================================
// CALL DETAIL SHEET
// ============================================================
function CallDetailSheet({
  call, userId, onClose, openDialer, onUpdated,
}: {
  call: Call; userId: string; onClose: () => void; openDialer: (n?: string) => void; onUpdated: (c: Call) => void;
}) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [taskState, setTaskState] = useState<Record<string, { creating?: boolean; createdId?: string }>>({});
  const [eventState, setEventState] = useState<Record<string, { creating?: boolean; createdId?: string }>>({});
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const peerNumber = (call.direction === "outbound" ? call.to_number : call.from_number) ?? "";

  // Load insight
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("planipret_ai_insights")
        .select("*")
        .eq("call_id", call.id)
        .maybeSingle();
      setInsight((data as any) ?? null);
    })();
  }, [call.id]);

  // Realtime refresh on ai-insights channel
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`ai-insights:${userId}`)
      .on("broadcast", { event: "updated" }, async (msg: any) => {
        if (msg?.payload?.call_id === call.id) {
          const { data: ins } = await supabase.from("planipret_ai_insights").select("*").eq("call_id", call.id).maybeSingle();
          setInsight((ins as any) ?? null);
          const { data: c2 } = await supabase.from("planipret_phone_calls").select("*").eq("id", call.id).maybeSingle();
          if (c2) onUpdated(c2 as Call);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, call.id, onUpdated]);

  const refreshCall = async () => {
    const { data } = await supabase.from("planipret_phone_calls").select("*").eq("id", call.id).maybeSingle();
    if (data) onUpdated(data as Call);
  };

  const fetchRecording = async () => {
    setRecLoading(true);
    const { data, error } = await supabase.functions.invoke("ns-recordings", { body: { call_id: call.ns_call_id ?? call.id } });
    setRecLoading(false);
    if (error || !(data as any)?.recording_url) { toast.error("Enregistrement non disponible"); return; }
    await supabase.from("planipret_phone_calls").update({ recording_url: (data as any).recording_url }).eq("id", call.id);
    await refreshCall();
    toast.success("Enregistrement récupéré");
  };

  const fetchTranscript = async () => {
    setTxLoading(true);
    const { data, error } = await supabase.functions.invoke("ns-transcription", { body: { call_id: call.ns_call_id ?? call.id } });
    setTxLoading(false);
    if (error || !(data as any)?.transcript) { toast.error("Transcription non disponible"); return; }
    await supabase.from("planipret_phone_calls").update({ transcript: (data as any).transcript }).eq("id", call.id);
    await refreshCall();
    toast.success("Transcription récupérée");
  };

  const analyzeAI = async () => {
    if (!call.transcript) return;
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("ai-analyze-call", { body: { call_id: call.id, transcript: call.transcript } });
    setAiLoading(false);
    if (error) { toast.error(error.message ?? "Échec de l'analyse"); return; }
    toast.success("Analyse IA terminée ✅");
    await refreshCall();
    const { data: ins } = await supabase.from("planipret_ai_insights").select("*").eq("call_id", call.id).maybeSingle();
    setInsight((ins as any) ?? null);
  };

  const meta = (call.metadata ?? {}) as any;
  const aiTasks: Array<any> = Array.isArray(meta.ai_tasks) ? meta.ai_tasks
    : Array.isArray(insight?.suggested_actions?.tasks) ? insight!.suggested_actions.tasks
    : [];
  const aiEvents: Array<any> = Array.isArray(meta.ai_events) ? meta.ai_events
    : Array.isArray(insight?.suggested_actions?.events) ? insight!.suggested_actions.events
    : [];

  const createOne = async (type: "task" | "event", item: any, idx: number) => {
    const key = String(idx);
    if (type === "task") setTaskState((s) => ({ ...s, [key]: { creating: true } }));
    else setEventState((s) => ({ ...s, [key]: { creating: true } }));
    const { data, error } = await supabase.functions.invoke("maestro-actions", {
      body: { action: type === "task" ? "create_task" : "create_event", call_id: call.id, payload: item },
    });
    const createdId = (data as any)?.id ?? (data as any)?.maestro_task_id ?? (data as any)?.maestro_event_id ?? "ok";
    if (error || (data as any)?.success === false) {
      toast.error(`Échec création ${type === "task" ? "tâche" : "événement"}`);
      if (type === "task") setTaskState((s) => ({ ...s, [key]: {} }));
      else setEventState((s) => ({ ...s, [key]: {} }));
      return;
    }
    toast.success(type === "task" ? "Tâche créée ✅" : "Événement créé ✅");
    if (type === "task") setTaskState((s) => ({ ...s, [key]: { createdId } }));
    else setEventState((s) => ({ ...s, [key]: { createdId } }));
  };

  const createAll = async () => {
    for (let i = 0; i < aiTasks.length; i++) if (!taskState[String(i)]?.createdId) await createOne("task", aiTasks[i], i);
    for (let i = 0; i < aiEvents.length; i++) if (!eventState[String(i)]?.createdId) await createOne("event", aiEvents[i], i);
  };

  const copyTranscript = async () => {
    if (!call.transcript) return;
    await navigator.clipboard.writeText(call.transcript);
    toast.success("Transcription copiée");
  };

  const direction = isOutbound(call) ? "Sortant" : isMissed(call) ? "Manqué" : "Entrant";
  const dirColor = isMissed(call) ? DANGER : isOutbound(call) ? SUCCESS : ACCENT;

  const objections: string[] = (insight?.suggested_actions?.objections as string[]) || (meta.objections as string[]) || [];
  const buyingSignals: string[] = (insight?.suggested_actions?.buying_signals as string[]) || (meta.buying_signals as string[]) || [];
  const nextAction: string = (insight?.suggested_actions?.next_action as string) || (meta.next_action as string) || "";
  const coaching = insight?.coaching_notes || meta.ai_coaching || "";
  const summary = insight?.summary || call.ai_summary || "";

  return (
    <div className="absolute inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ height: "90%" }}
      >
        <div className="pt-2 pb-1 flex flex-col items-center relative shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
          <button onClick={onClose} className="absolute right-3 top-2 p-1.5 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-full p-1 text-xs mt-2 mb-3">
            <button onClick={() => setActiveTab("details")} className="flex-1 py-1.5 rounded-full font-medium transition"
              style={{ background: activeTab === "details" ? "white" : "transparent", color: activeTab === "details" ? PRIMARY : "#64748b" }}>📋 Détails</button>
            <button onClick={() => setActiveTab("history")} className="flex-1 py-1.5 rounded-full font-medium transition"
              style={{ background: activeTab === "history" ? "white" : "transparent", color: activeTab === "history" ? PRIMARY : "#64748b" }}>👤 Historique contact</button>
          </div>
          {activeTab === "history" ? (
            <div className="pt-2"><ContactTimeline number={peerNumber} /></div>
          ) : (<>
          {/* SECTION 1 */}
          <div className="text-center pt-4 pb-5 border-b border-slate-100">
            <div className="text-xl font-bold" style={{ color: "var(--pp-text-primary)" }}>{displayLabel(call)}</div>
            {otherName(call) && <div className="text-xs text-slate-400 mt-0.5">{otherNumber(call)}</div>}
            <div className="mt-2 flex items-center justify-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: `${dirColor}15`, color: dirColor }}>{direction}</span>
              <span className="text-slate-500">{frenchDateTime(call.started_at)}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{frenchDuration(call.duration_seconds)}</span>
            </div>
            <button
              onClick={() => { openDialer(otherNumber(call)); onClose(); }}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow"
              style={{ background: PRIMARY }}
            >
              <Phone className="w-4 h-4" /> Rappeler
            </button>
          </div>

          {/* LEAD SCORE */}
          {call.lead_temperature && call.lead_score != null && (
            <div className="mt-4 rounded-xl p-3 flex items-center gap-3"
              style={{ background: `${TEMP_COLORS[call.lead_temperature]}12`, border: `1px solid ${TEMP_COLORS[call.lead_temperature]}40` }}>
              <div className="text-3xl">{TEMP_EMOJI[call.lead_temperature]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: TEMP_COLORS[call.lead_temperature] }}>
                  Lead {TEMP_LABEL[call.lead_temperature].toLowerCase()} — Score {call.lead_score}/10
                </div>
                {call.lead_score_reason && (
                  <div className="text-xs text-slate-500 mt-0.5">{call.lead_score_reason}</div>
                )}
              </div>
            </div>
          )}

          {/* CALLBACK SUGGESTION */}
          {call.suggested_callback_delay && (
            <CallbackSuggestion call={call} onScheduled={() => toast.success("Rappel programmé ✅")} />
          )}



          {/* SECTION 2 - Recording */}
          <Section title="🎙️ Enregistrement">
            {call.recording_url ? (
              <audio controls className="w-full mt-1" style={{ accentColor: PRIMARY }} src={call.recording_url} />
            ) : (
              <button onClick={fetchRecording} disabled={recLoading} className="w-full py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 active:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2">
                {recLoading && <Loader2 className="w-4 h-4 animate-spin" />} Obtenir l'enregistrement
              </button>
            )}
          </Section>

          {/* SECTION 3 - Transcript */}
          <Section title="📝 Transcription">
            {call.transcript ? (
              <div className="relative">
                <button onClick={copyTranscript} className="absolute right-1 top-1 text-[11px] px-2 py-1 rounded-md bg-white/90 border border-slate-200 hover:bg-slate-50 flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copier
                </button>
                <div className="bg-slate-50 rounded-lg p-3 pt-7 text-xs text-slate-700 whitespace-pre-wrap overflow-y-auto" style={{ maxHeight: 200 }}>
                  {call.transcript}
                </div>
              </div>
            ) : (
              <button onClick={fetchTranscript} disabled={txLoading} className="w-full py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 active:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2">
                {txLoading && <Loader2 className="w-4 h-4 animate-spin" />} Obtenir la transcription
              </button>
            )}
          </Section>

          {/* SECTION 4 - AI Analysis */}
          <Section title="🤖 Analyse IA">
            {summary ? (
              <div className="space-y-2">
                <Accordion title="📋 Résumé" defaultOpen>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{summary}</p>
                </Accordion>
                {coaching && (
                  <Accordion title="🎯 Coaching">
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{coaching}</p>
                  </Accordion>
                )}
                {objections.length > 0 && (
                  <Accordion title="⚠️ Objections">
                    <div className="flex flex-wrap gap-1.5">
                      {objections.map((o, i) => (
                        <span key={i} className="text-[11px] px-2 py-1 rounded-full border" style={{ borderColor: DANGER, color: DANGER }}>{o}</span>
                      ))}
                    </div>
                  </Accordion>
                )}
                {buyingSignals.length > 0 && (
                  <Accordion title="✅ Signaux d'achat">
                    <div className="flex flex-wrap gap-1.5">
                      {buyingSignals.map((o, i) => (
                        <span key={i} className="text-[11px] px-2 py-1 rounded-full border" style={{ borderColor: SUCCESS, color: SUCCESS }}>{o}</span>
                      ))}
                    </div>
                  </Accordion>
                )}
                {nextAction && (
                  <Accordion title="➡️ Prochaine étape">
                    <div className="text-xs p-2.5 rounded-lg" style={{ background: `${PRIMARY}10`, color: PRIMARY }}>{nextAction}</div>
                  </Accordion>
                )}
              </div>
            ) : call.transcript ? (
              <button onClick={analyzeAI} disabled={aiLoading} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: PURPLE }}>
                {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…</> : <><Sparkles className="w-4 h-4" /> Analyser avec l'IA</>}
              </button>
            ) : (
              <p className="text-xs text-slate-400 italic">Obtenez d'abord la transcription pour analyser l'appel.</p>
            )}
          </Section>

          {/* SECTION 5 - AI Actions */}
          {(aiTasks.length > 0 || aiEvents.length > 0) && (
            <Section title="⚡ Actions suggérées">
              <div className="space-y-2">
                {aiTasks.map((t: any, i: number) => {
                  const st = taskState[String(i)] ?? {};
                  return (
                    <ActionRow
                      key={`t-${i}`}
                      icon="📌"
                      title={t.title ?? t.name ?? "Tâche"}
                      sub={t.due_date ?? t.due ?? ""}
                      done={!!st.createdId}
                      loading={!!st.creating}
                      doneLabel={st.createdId ? `Créé · ${String(st.createdId).slice(0, 8)}` : undefined}
                      onCreate={() => createOne("task", t, i)}
                    />
                  );
                })}
                {aiEvents.map((e: any, i: number) => {
                  const st = eventState[String(i)] ?? {};
                  return (
                    <ActionRow
                      key={`e-${i}`}
                      icon="📅"
                      title={e.title ?? e.subject ?? "Événement"}
                      sub={e.start ?? e.suggested_time ?? ""}
                      done={!!st.createdId}
                      loading={!!st.creating}
                      onCreate={() => createOne("event", e, i)}
                    />
                  );
                })}
                {aiTasks.length + aiEvents.length > 1 && (
                  <button onClick={createAll} className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: PRIMARY }}>
                    <Sparkles className="w-4 h-4" /> Tout créer dans Maestro
                  </button>
                )}
              </div>
            </Section>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}

function CallbackSuggestion({ call, onScheduled }: { call: Call; onScheduled: () => void }) {
  const [busy, setBusy] = useState(false);
  const schedule = async (delay: string) => {
    setBusy(true);
    const at = callbackDelayToDate(delay);
    if (!at) { setBusy(false); return; }
    const { error } = await supabase.from("planipret_reminders").insert({
      user_id: call.user_id,
      call_id: call.id,
      contact_number: call.direction === "outbound" ? call.to_number : call.from_number,
      contact_name: call.direction === "outbound" ? call.to_name : call.from_name,
      reminder_type: "callback",
      scheduled_at: at.toISOString(),
      ai_suggested: true,
      note: call.callback_reason ?? null,
    });
    setBusy(false);
    if (error) { toast.error("Erreur création rappel"); return; }
    // Best-effort Maestro event
    supabase.functions.invoke("maestro-actions", {
      body: { action: "create_event", call_id: call.id, payload: { title: `Rappel: ${call.from_name ?? call.from_number ?? ""}`, start: at.toISOString(), end: new Date(at.getTime() + 30*60000).toISOString(), description: call.callback_reason ?? "" } },
    }).catch(() => {});
    onScheduled();
  };
  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}>
      <div className="text-xs font-semibold mb-1" style={{ color: "var(--pp-agent)" }}>⏰ Rappel suggéré par AVA</div>
      {call.callback_reason && <p className="text-xs text-slate-600 mb-2">{call.callback_reason}</p>}
      <div className="flex flex-wrap gap-1.5">
        {(["2h","tomorrow_9am","monday_9am"] as const).map((d) => (
          <button key={d} disabled={busy} onClick={() => schedule(d)}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--pp-agent)" }}>
            {delayLabel(d)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="text-[13px] font-semibold mb-2" style={{ color: "var(--pp-text-primary)" }}>{title}</div>
      {children}
    </div>
  );
}

function Accordion({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50">
        <span>{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

function ActionRow({ icon, title, sub, onCreate, loading, done, doneLabel }: {
  icon: string; title: string; sub?: string; onCreate: () => void; loading?: boolean; done?: boolean; doneLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100">
      <div className="text-lg">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-800 truncate">{title}</div>
        {sub && <div className="text-[11px] text-slate-500 truncate">{sub}</div>}
      </div>
      {done ? (
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1" style={{ background: `${SUCCESS}15`, color: SUCCESS }}>
          <Check className="w-3 h-3" /> {doneLabel ?? "Créé"}
        </span>
      ) : (
        <button onClick={onCreate} disabled={loading} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md text-white flex items-center gap-1 disabled:opacity-50" style={{ background: PRIMARY }}>
          {loading && <Loader2 className="w-3 h-3 animate-spin" />} Créer dans Maestro
        </button>
      )}
    </div>
  );
}

// ============================================================
// ACTIVE CALLS TAB
// ============================================================
type ActiveCall = {
  id: string;
  number: string;
  name?: string;
  status: "ringing" | "active" | "hold" | "inbound";
  startedAt: number;
};

function ActiveCallsTab({ userId, openDialer }: { userId: string; openDialer: (n?: string) => void }) {
  const [active, setActive] = useState<ActiveCall[]>([]);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [transferOpen, setTransferOpen] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [incoming, setIncoming] = useState<ActiveCall | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActive = async () => {
    const { data, error } = await supabase.functions.invoke("ns-calls", { body: { action: "list" } });
    if (error) return;
    const list = ((data as any)?.calls ?? []) as any[];
    setActive(list.map((c: any) => ({
      id: c.id ?? c.call_id,
      number: c.remote_number ?? c.number ?? "",
      name: c.remote_name ?? c.name,
      status: (c.state ?? c.status ?? "active") as any,
      startedAt: c.started_at ? new Date(c.started_at).getTime() : Date.now(),
    })));
  };

  useEffect(() => {
    fetchActive();
    pollRef.current = setInterval(fetchActive, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`call-events:${userId}`)
      .on("broadcast", { event: "*" }, (msg: any) => {
        const p = msg?.payload;
        if (!p) return;
        if (p.event === "ringing" || p.state === "ringing") {
          setIncoming({ id: p.id ?? p.call_id, number: p.from_number ?? p.number, status: "inbound", startedAt: Date.now() });
        } else if (p.event === "ended" || p.state === "ended" || p.state === "disconnected") {
          setIncoming(null);
          fetchActive();
        } else {
          fetchActive();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const action = async (act: string, callId: string, extra: any = {}) => {
    const { error } = await supabase.functions.invoke("ns-calls", { body: { action: act, call_id: callId, ...extra } });
    if (error) toast.error(error.message);
    else fetchActive();
  };

  if (!active.length && !incoming) return <EmptyState tab="active" />;

  return (
    <div className="p-4 space-y-3">
      {active.map((c) => (
        <ActiveCallCard
          key={c.id}
          call={c}
          muted={!!muted[c.id]}
          onMute={() => setMuted((m) => ({ ...m, [c.id]: !m[c.id] }))}
          onHold={() => action(c.status === "hold" ? "unhold" : "hold", c.id)}
          onTransfer={() => setTransferOpen(c.id)}
          onHangup={() => action("disconnect", c.id)}
        />
      ))}

      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={() => setTransferOpen(null)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-sm mb-2">Transférer l'appel</div>
            <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="Transférer vers..." className="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm outline-none mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setTransferOpen(null)} className="flex-1 py-2 rounded-lg text-sm text-slate-600 bg-slate-100">Annuler</button>
              <button onClick={() => { if (transferOpen && transferTo) { action("transfer", transferOpen, { destination: transferTo }); setTransferOpen(null); setTransferTo(""); } }} className="flex-1 py-2 rounded-lg text-sm text-white" style={{ background: PRIMARY }}>Transférer</button>
            </div>
          </div>
        </div>
      )}

      {incoming && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white p-6" style={{ background: PRIMARY }}>
          <div className="absolute inset-0 opacity-30 animate-pulse" style={{ background: PRIMARY }} />
          <div className="relative text-center mb-10">
            <div className="text-sm opacity-80 mb-2">Appel entrant…</div>
            <div className="text-3xl font-bold">{incoming.name ?? incoming.number}</div>
            {incoming.name && <div className="text-sm opacity-80 mt-1">{incoming.number}</div>}
          </div>
          <div className="relative flex gap-6">
            <button onClick={() => { action("reject", incoming.id); setIncoming(null); }} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{ background: DANGER }}>
              <PhoneOff className="w-7 h-7" />
            </button>
            <button onClick={() => { action("answer", incoming.id); setIncoming(null); fetchActive(); }} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{ background: SUCCESS }}>
              <Phone className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveCallCard({ call, muted, onMute, onHold, onTransfer, onHangup }: {
  call: ActiveCall; muted: boolean; onMute: () => void; onHold: () => void; onTransfer: () => void; onHangup: () => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const sec = Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const statusLabel = call.status === "ringing" ? "Sonnerie..." : call.status === "hold" ? "En attente" : "En communication";

  return (
    <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: PRIMARY }}>
      <div className="text-center">
        <div className="text-2xl font-bold">{call.name ?? call.number}</div>
        {call.name && <div className="text-sm opacity-80 mt-0.5">{call.number}</div>}
        <div className="text-3xl font-mono mt-3">{mm}:{ss}</div>
        <div className="text-xs opacity-80 mt-1">{statusLabel}</div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-5">
        <ActionBtn label="Muet" active={muted} Icon={muted ? MicOff : Mic} onClick={onMute} />
        <ActionBtn label={call.status === "hold" ? "Reprendre" : "Attente"} Icon={call.status === "hold" ? Play : Pause} onClick={onHold} />
        <ActionBtn label="Transférer" Icon={ArrowRightLeft} onClick={onTransfer} />
        <ActionBtn label="Raccrocher" Icon={PhoneOff} onClick={onHangup} big danger />
      </div>
    </div>
  );
}

function ActionBtn({ label, Icon, onClick, active, big, danger }: { label: string; Icon: any; onClick: () => void; active?: boolean; big?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div
        className={`rounded-full flex items-center justify-center ${big ? "w-14 h-14" : "w-12 h-12"} ${active ? "bg-white/40" : "bg-white/15"}`}
        style={danger ? { background: DANGER } : undefined}
      >
        <Icon className={`${big ? "w-6 h-6" : "w-5 h-5"} text-white`} />
      </div>
      <span className="text-[10px] text-white/90">{label}</span>
    </button>
  );
}

/* =================== Voicemails Tab (Phase 8) =================== */

type VM = {
  id: string;
  user_id: string;
  ns_vm_id: string | null;
  folder: string;
  from_number: string | null;
  from_name: string | null;
  duration_seconds: number | null;
  audio_url: string | null;
  transcript: string | null;
  is_read: boolean;
  received_at: string | null;
  created_at: string;
};

function fmtVmDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(); yest.setDate(now.getDate() - 1);
  const hh = `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return `Aujourd'hui ${hh}`;
  if (d.toDateString() === yest.toDateString()) return `Hier ${hh}`;
  return d.toLocaleDateString("fr-CA", { day: "2-digit", month: "short" }) + ` ${hh}`;
}
function fmtVmDur(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60); const r = s % 60;
  return m === 0 ? `${r} sec` : `${m} min ${String(r).padStart(2, "0")} sec`;
}

function VoicemailsTab({
  userId, openDialer, registerRefresh,
}: { userId?: string; openDialer: (n: string) => void; registerRefresh: (fn: (() => void) | null) => void }) {
  const [items, setItems] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<"inbox" | "saved">("inbox");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const sb: any = supabase;
    const { data } = await sb
      .from("planipret_voicemails")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as VM[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    registerRefresh(() => load());
    return () => registerRefresh(null);
  }, [load, registerRefresh]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`mcalls-vm:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_voicemails", filter: `user_id=eq.${userId}` }, (payload) => {
        const v = payload.new as VM;
        setItems((p) => [v, ...p]);
        toast(`📬 Nouveau voicemail de ${v.from_number ?? "inconnu"}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const filtered = items.filter((v) => v.folder === folder);
  const unread = items.filter((v) => v.folder === "inbox" && !v.is_read).length;

  const markRead = async (vm: VM) => {
    if (vm.is_read) return;
    const sb: any = supabase;
    await sb.from("planipret_voicemails").update({ is_read: true }).eq("id", vm.id);
    setItems((p) => p.map((x) => x.id === vm.id ? { ...x, is_read: true } : x));
  };
  const saveVm = async (vm: VM) => {
    const sb: any = supabase;
    await sb.from("planipret_voicemails").update({ folder: "saved" }).eq("id", vm.id);
    setItems((p) => p.map((x) => x.id === vm.id ? { ...x, folder: "saved" } : x));
    toast.success("Voicemail sauvegardé");
  };
  const removeVm = async (vm: VM) => {
    if (!confirm("Supprimer ce voicemail ?")) return;
    if (vm.ns_vm_id) {
      await supabase.functions.invoke("ns-voicemail", { method: "DELETE" as any, body: { vm_id: vm.ns_vm_id } }).catch(() => null);
    }
    const sb: any = supabase;
    await sb.from("planipret_voicemails").delete().eq("id", vm.id);
    setItems((p) => p.filter((x) => x.id !== vm.id));
    toast.success("Voicemail supprimé");
  };
  const fetchTranscript = async (vm: VM) => {
    const { data, error } = await supabase.functions.invoke("ns-transcription", { body: { vm_id: vm.ns_vm_id ?? vm.id } });
    if (error || (data as any)?.success === false) { toast.error("Échec de la transcription"); return; }
    const txt = (data as any)?.transcript ?? (data as any)?.data?.transcript ?? "";
    if (txt) {
      const sb: any = supabase;
      await sb.from("planipret_voicemails").update({ transcript: txt }).eq("id", vm.id);
      setItems((p) => p.map((x) => x.id === vm.id ? { ...x, transcript: txt } : x));
    }
  };

  return (
    <div className="px-3 pt-3 pb-4">
      {/* Folder switch */}
      <div className="flex gap-1 mb-3 p-1 rounded-full"
        style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)" }}>
        {([
          { k: "inbox" as const, label: `Reçus${unread ? ` (${unread})` : ""}` },
          { k: "saved" as const, label: "Sauvegardés" },
        ]).map((f) => {
          const active = folder === f.k;
          return (
            <button key={f.k} onClick={() => setFolder(f.k)}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-full transition"
              style={active
                ? { background: "linear-gradient(135deg, var(--pp-brand-accent), var(--pp-brand-accent-2))", color: "#fff" }
                : { color: "var(--pp-text-muted)" }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="rounded-2xl h-16 animate-pulse"
              style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }} />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ background: "rgba(46,155,220,0.12)", color: "var(--pp-brand-accent)" }}>
            <VmIcon className="w-6 h-6" />
          </div>
          <div className="font-semibold" style={{ color: "var(--pp-text-secondary)" }}>
            {folder === "inbox" ? "Aucun voicemail reçu" : "Aucun voicemail sauvegardé"}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((vm) => {
            const open = expanded === vm.id;
            return (
              <li key={vm.id} className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--pp-bg-surface)",
                  border: "1px solid var(--pp-bg-border-2)",
                  borderLeft: vm.is_read ? "1px solid var(--pp-bg-border-2)" : "3px solid var(--pp-brand-accent)",
                }}>
                <button onClick={() => { setExpanded(open ? null : vm.id); markRead(vm); }}
                  className="w-full p-3 flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center relative shrink-0"
                    style={{ background: "rgba(46,155,220,0.12)", color: "var(--pp-brand-accent)" }}>
                    <VmIcon className="w-5 h-5" />
                    {!vm.is_read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                        style={{ background: "var(--pp-brand-accent)", boxShadow: "0 0 0 2px var(--pp-bg-surface)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${vm.is_read ? "" : "font-semibold"}`} style={{ color: "var(--pp-text-primary)" }}>
                      {vm.from_name || vm.from_number || "Inconnu"}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--pp-text-muted)" }}>
                      {fmtVmDate(vm.received_at ?? vm.created_at)} · {fmtVmDur(vm.duration_seconds)}
                    </div>
                  </div>
                  {open ? <ChevronUp className="w-4 h-4" style={{ color: "var(--pp-text-muted)" }} />
                        : <ChevronDown className="w-4 h-4" style={{ color: "var(--pp-text-muted)" }} />}
                </button>

                {open && (
                  <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--pp-bg-border)" }}>
                    <VmAudio vm={vm} />
                    <div className="mt-2">
                      {vm.transcript ? (
                        <div className="rounded-lg p-2 text-xs whitespace-pre-wrap"
                          style={{ background: "var(--pp-bg-deep)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
                          {vm.transcript}
                        </div>
                      ) : (
                        <button onClick={() => fetchTranscript(vm)}
                          className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                          style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
                          <FileText className="w-3.5 h-3.5" /> Obtenir la transcription
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mt-3">
                      <VmAction icon={<Phone className="w-4 h-4" />} label="Rappeler" onClick={() => openDialer(vm.from_number ?? "")} accent />
                      {folder === "inbox" && <VmAction icon={<Save className="w-4 h-4" />} label="Garder" onClick={() => saveVm(vm)} />}
                      <VmAction icon={<Trash2 className="w-4 h-4" />} label="Suppr." onClick={() => removeVm(vm)} danger />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function VmAction({ icon, label, onClick, accent, danger }:
  { icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean; danger?: boolean }) {
  const bg = danger ? "rgba(232,76,76,0.10)" : accent ? "rgba(46,155,220,0.12)" : "var(--pp-bg-elevated)";
  const color = danger ? "var(--pp-danger)" : accent ? "var(--pp-brand-accent)" : "var(--pp-text-secondary)";
  const border = danger ? "rgba(232,76,76,0.25)" : accent ? "rgba(46,155,220,0.30)" : "var(--pp-bg-border-2)";
  return (
    <button onClick={onClick}
      className="py-2 rounded-lg text-[11px] font-medium flex flex-col items-center gap-1 active:scale-95 transition"
      style={{ background: bg, color, border: `1px solid ${border}` }}>
      {icon}<span>{label}</span>
    </button>
  );
}

function VmAudio({ vm }: { vm: VM }) {
  const [src, setSrc] = useState<string | null>(vm.audio_url);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(vm.duration_seconds ?? 0);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    (async () => {
      if (src) return;
      const id = vm.ns_vm_id ?? vm.id;
      const { data } = await supabase.functions.invoke("ns-voicemail", { method: "GET" as any, body: { vm_id: id, action: "fetch" } as any });
      const url = (data as any)?.url ?? (data as any)?.audio_url;
      if (url) setSrc(url);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.id]);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };
  const cycleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };
  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="rounded-lg p-3 mt-2"
      style={{ background: "var(--pp-bg-deep)", border: "1px solid var(--pp-bg-border-2)" }}>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onEnded={() => setPlaying(false)}
          hidden
        />
      )}
      <div className="flex items-center gap-2">
        <button onClick={toggle} disabled={!src}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, var(--pp-brand-accent-2), var(--pp-brand-accent))" }}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <input type="range" min={0} max={dur || 0} step={0.1} value={progress}
          onChange={(e) => { const v = +e.target.value; setProgress(v); if (audioRef.current) audioRef.current.currentTime = v; }}
          className="flex-1" style={{ accentColor: "var(--pp-brand-accent)" }} />
        <span className="text-[10px] tabular-nums" style={{ color: "var(--pp-text-muted)" }}>
          {fmtT(progress)} / {fmtT(dur || 0)}
        </span>
        <button onClick={cycleSpeed}
          className="px-2 py-1 rounded text-[10px] font-semibold"
          style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
          {speed}x
        </button>
      </div>
      {!src && <p className="text-[10px] mt-1" style={{ color: "var(--pp-text-faint)" }}>Chargement de l'audio…</p>}
    </div>
  );
}

