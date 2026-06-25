import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, X, ArrowLeft, Phone, Send, Paperclip, MessageSquare, Zap,
  Users, Bot, Mail, Sparkles, Loader2, RefreshCw, Mic, Reply, Trash2,
} from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";
import SmsTemplatesSheet from "@/components/planipret/SmsTemplatesSheet";

type SubTab = "sms" | "team" | "ava" | "emails";

type Msg = {
  id: string;
  user_id: string;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  body: string | null;
  media_urls: any;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
  status?: string | null;
};

const initials = (s: string) => {
  const clean = (s || "").replace(/[^0-9A-Za-z]/g, "");
  if (!clean) return "?";
  return clean.slice(-2).toUpperCase();
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (d.toDateString() === yest.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-CA", { day: "2-digit", month: "2-digit" });
};

export default function MMessages() {
  const { profile, openDialer, openAva, registerRefresh } = useOutletContext<PlanipretMobileContext>();
  const [sub, setSub] = useState<SubTab>("sms");

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--pp-bg-base)" }}>
      <div
        className="px-4 pt-5 pb-3"
        style={{ background: "var(--pp-bg-deep)", borderBottom: "1px solid var(--pp-bg-border)" }}
      >
        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--pp-text-primary)" }}>Messages</h1>
        <div
          className="flex rounded-full p-1"
          style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)" }}
        >
          {[
            { k: "sms" as SubTab, label: "SMS", Icon: MessageSquare },
            { k: "team" as SubTab, label: "Équipe", Icon: Users },
            { k: "ava" as SubTab, label: "AVA", Icon: Bot },
            { k: "emails" as SubTab, label: "Emails", Icon: Mail },
          ].map((t) => {
            const active = sub === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setSub(t.k)}
                className="flex-1 py-2 text-[11px] font-semibold rounded-full transition flex items-center justify-center gap-1"
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
                <t.Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {sub === "sms" && <SmsList profile={profile} openDialer={openDialer} registerRefresh={registerRefresh} />}
        {sub === "team" && <TeamChat profile={profile} />}
        {sub === "ava" && <AvaChat profile={profile} openAva={openAva} />}
        {sub === "emails" && <EmailsList profile={profile} openAva={openAva} />}
      </div>
    </div>
  );
}

// ============================================================
// SMS TAB (original threads)
// ============================================================
function SmsList({ profile, openDialer, registerRefresh }: any) {
  const myExt = profile?.extension ?? "";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newNumber, setNewNumber] = useState("");

  const load = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("planipret_phone_messages")
      .select("*")
      .eq("user_id", profile.user_id)
      .order("created_at", { ascending: false })
      .limit(500);
    setMessages((data ?? []) as Msg[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.user_id]);
  useEffect(() => { registerRefresh(load); return () => registerRefresh(null); /* eslint-disable-next-line */ }, [profile?.user_id]);

  useEffect(() => {
    if (!profile?.user_id) return;
    const ch = supabase
      .channel("mplanipret-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_phone_messages", filter: `user_id=eq.${profile.user_id}` }, (payload) => {
        setMessages((prev) => [payload.new as Msg, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.user_id]);

  const peer = (m: Msg) => (m.direction === "outbound" ? m.to_number : m.from_number) || "";

  const threads = useMemo(() => {
    const map = new Map<string, { number: string; last: Msg; unread: number; preview: string }>();
    for (const m of messages) {
      const k = peer(m);
      if (!k) continue;
      const cur = map.get(k);
      const isUnread = m.direction === "inbound" && !m.read_at;
      if (!cur) map.set(k, { number: k, last: m, unread: isUnread ? 1 : 0, preview: (m.body ?? "").slice(0, 40) });
      else if (isUnread) cur.unread += 1;
    }
    return Array.from(map.values()).sort((a, b) => +new Date(b.last.created_at) - +new Date(a.last.created_at));
  }, [messages]);

  if (activeThread) {
    return (
      <ThreadView
        number={activeThread}
        myExt={myExt}
        userId={profile.user_id}
        messages={messages.filter((m) => peer(m) === activeThread)}
        onBack={() => setActiveThread(null)}
        onCall={(n) => openDialer(n)}
        onSent={(m) => setMessages((p) => [m, ...p])}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="flex justify-end mb-2">
        <button
          onClick={() => { setNewNumber(""); setNewOpen(true); }}
          className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, var(--pp-brand-accent), var(--pp-brand-accent-2))",
            boxShadow: "0 2px 12px rgba(46,155,220,0.4)",
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-16 animate-pulse" style={{ background: "var(--pp-bg-surface)" }} />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <EmptyState Icon={MessageSquare} title="Aucun message" sub="Touchez « Nouveau » pour démarrer." />
      ) : (
        <ul className="space-y-1.5">
          {threads.map((t) => (
            <li key={t.number}>
              <button
                onClick={() => setActiveThread(t.number)}
                className="w-full px-3 py-3 flex items-center gap-3 rounded-2xl text-left active:opacity-80"
                style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--pp-brand-accent), var(--pp-brand-accent-2))" }}
                >
                  {initials(t.number)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: "var(--pp-text-primary)" }}>{t.number}</p>
                  <p className="text-xs truncate" style={{ color: "var(--pp-text-muted)" }}>{t.preview || "(pas de contenu)"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[11px]" style={{ color: "var(--pp-text-faint)" }}>{fmtTime(t.last.created_at)}</span>
                  {t.unread > 0 && (
                    <span
                      className="min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-semibold flex items-center justify-center"
                      style={{ background: "var(--pp-danger)" }}
                    >
                      {t.unread}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {newOpen && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-black/60 backdrop-blur-sm" onClick={() => setNewOpen(false)}>
          <div
            className="w-full md:w-[360px] rounded-t-3xl md:rounded-2xl p-4"
            style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: "var(--pp-text-primary)" }}>Nouveau message</h2>
              <button onClick={() => setNewOpen(false)} className="p-1 rounded-full" style={{ color: "var(--pp-text-muted)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="tel"
              inputMode="tel"
              placeholder="Numéro de téléphone"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{
                background: "var(--pp-bg-elevated)",
                border: "1px solid var(--pp-bg-border-2)",
                color: "var(--pp-text-primary)",
              }}
            />
            <button
              disabled={!newNumber.trim()}
              onClick={() => { setActiveThread(newNumber.trim()); setNewOpen(false); }}
              className="w-full mt-3 py-2.5 rounded-lg text-white font-medium text-sm disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--pp-brand-accent), var(--pp-brand-accent-2))" }}
            >
              Continuer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadView({ number, myExt, userId, messages, onBack, onCall, onSent }: {
  number: string; myExt: string; userId: string; messages: Msg[];
  onBack: () => void; onCall: (n: string) => void; onSent: (m: Msg) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => [...messages].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)), [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [ordered.length]);

  useEffect(() => {
    const unread = ordered.filter((m) => m.direction === "inbound" && !m.read_at).map((m) => m.id);
    if (unread.length) {
      supabase.from("planipret_phone_messages").update({ read_at: new Date().toISOString() }).in("id", unread);
    }
  }, [number, ordered.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`, user_id: userId, direction: "outbound",
      from_number: myExt, to_number: number, body, media_urls: null,
      read_at: null, sent_at: new Date().toISOString(), created_at: new Date().toISOString(), status: "sending",
    };
    onSent(optimistic);
    setText("");
    const { data, error } = await supabase.functions.invoke("ns-sms", { body: { to: number, message: body, type: "sms" } });
    setSending(false);
    if (error || (data as any)?.success === false) {
      toast.error((data as any)?.error ?? error?.message ?? "Échec de l'envoi");
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--pp-bg-base)" }}>
      <header
        className="flex items-center gap-2 px-3 py-3"
        style={{ background: "var(--pp-bg-deep)", borderBottom: "1px solid var(--pp-bg-border)" }}
      >
        <button onClick={onBack} className="p-1.5 rounded-full" style={{ color: "var(--pp-text-secondary)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--pp-text-primary)" }}>{number}</p>
          <p className="text-[11px]" style={{ color: "var(--pp-text-muted)" }}>{ordered.length} message{ordered.length > 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => onCall(number)}
          className="px-3 py-1.5 rounded-full text-white text-xs font-semibold flex items-center gap-1.5"
          style={{ background: "linear-gradient(135deg, var(--pp-success), #00A88A)" }}
        >
          <Phone className="w-3.5 h-3.5" /> Appeler
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2" style={{ background: "var(--pp-bg-base)" }}>
        {ordered.map((m) => {
          const out = m.direction === "outbound";
          const media: string[] = Array.isArray(m.media_urls) ? m.media_urls : [];
          return (
            <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[78%]">
                <div className={out ? "pp-bubble-out" : "pp-bubble-in"} style={{ padding: "8px 12px", fontSize: 14 }}>
                  {media.length > 0 && (
                    <div className="space-y-1 mb-1">
                      {media.map((u, i) => <img key={i} src={u} alt="" className="rounded-lg max-w-full" />)}
                    </div>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                </div>
                <p className={`text-[10px] mt-1 ${out ? "text-right" : "text-left"}`} style={{ color: "var(--pp-text-faint)" }}>
                  {fmtTime(m.created_at)}{m.status === "sending" ? " · envoi…" : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <Composer
        text={text} setText={setText} onSend={send} sending={sending}
        leftAction={
          <button onClick={() => setTplOpen(true)} className="p-2 rounded-full" style={{ color: "var(--pp-brand-accent)" }} title="Templates">
            <Zap className="w-5 h-5" />
          </button>
        }
        extra={
          <button onClick={() => toast("Pièce jointe : bientôt disponible")} className="p-2 rounded-full" style={{ color: "var(--pp-text-muted)" }}>
            <Paperclip className="w-5 h-5" />
          </button>
        }
      />
      <SmsTemplatesSheet open={tplOpen} onClose={() => setTplOpen(false)} userId={userId} onPick={(body) => setText((t) => t ? `${t} ${body}` : body)} />
    </div>
  );
}

// ============================================================
// TEAM CHAT TAB
// ============================================================
type TeamMsg = {
  id: string;
  sender_id: string;
  channel: string;
  message: string;
  created_at: string;
};

function TeamChat({ profile }: { profile: any }) {
  const [msgs, setMsgs] = useState<TeamMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const channel = "general";

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("planipret_team_messages")
      .select("id, sender_id, channel, message, created_at")
      .eq("channel", channel)
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs((data ?? []) as TeamMsg[]);
    setLoading(false);

    const ids = Array.from(new Set((data ?? []).map((m: any) => m.sender_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("planipret_profiles")
        .select("id, full_name")
        .in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "Courtier"; });
      setSenderNames(map);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  useEffect(() => {
    const ch = supabase
      .channel("pp-team-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_team_messages", filter: `channel=eq.${channel}` }, (payload) => {
        setMsgs((p) => [...p, payload.new as TeamMsg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const send = async () => {
    const body = text.trim();
    if (!body || !profile?.id) return;
    setSending(true);
    const { error } = await supabase.from("planipret_team_messages").insert({
      sender_id: profile.id,
      channel,
      message: body,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setText("");
  };

  return (
    <div className="absolute inset-x-0 top-[120px] bottom-0 flex flex-col">
      <div
        className="px-4 py-2 text-[11px] uppercase tracking-wider flex items-center gap-2"
        style={{ color: "var(--pp-text-muted)", borderBottom: "1px solid var(--pp-bg-border)" }}
      >
        <Users className="w-3 h-3" /> #{channel}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="text-center py-8" style={{ color: "var(--pp-text-muted)" }}>
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : msgs.length === 0 ? (
          <EmptyState Icon={Users} title="Salon vide" sub="Soyez le premier à écrire à l'équipe." />
        ) : (
          msgs.map((m) => {
            const mine = m.sender_id === profile?.id;
            const name = senderNames[m.sender_id] ?? "Courtier";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[78%]">
                  {!mine && (
                    <div className="text-[10px] mb-0.5 px-1" style={{ color: "var(--pp-brand-accent)" }}>{name}</div>
                  )}
                  <div className={mine ? "pp-bubble-out" : "pp-bubble-in"} style={{ padding: "8px 12px", fontSize: 14 }}>
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                  <p className={`text-[10px] mt-1 ${mine ? "text-right" : "text-left"}`} style={{ color: "var(--pp-text-faint)" }}>
                    {fmtTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <Composer text={text} setText={setText} onSend={send} sending={sending} placeholder="Message à l'équipe…" />
    </div>
  );
}

// ============================================================
// AVA CHAT TAB
// ============================================================
type AvaMsg = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
};

function AvaChat({ profile, openAva }: { profile: any; openAva: () => void }) {
  const [msgs, setMsgs] = useState<AvaMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("planipret_ava_conversations")
      .select("*")
      .eq("user_id", profile.user_id)
      .order("created_at", { ascending: true })
      .limit(100);
    setMsgs((data ?? []) as AvaMsg[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.user_id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !profile?.user_id) return;
    setSending(true);
    const userMsg = { user_id: profile.user_id, role: "user" as const, message: body };
    const { data: ins } = await supabase.from("planipret_ava_conversations").insert(userMsg).select().single();
    if (ins) setMsgs((p) => [...p, ins as AvaMsg]);
    setText("");

    const { data, error } = await supabase.functions.invoke("pp-ava-proactive", {
      body: { user_message: body, history: msgs.slice(-10).map((m) => ({ role: m.role, content: m.message })) },
    });
    const reply = (data as any)?.reply ?? (data as any)?.message ?? (error ? "Désolé, je rencontre un problème pour répondre." : "…");
    const { data: ins2 } = await supabase.from("planipret_ava_conversations")
      .insert({ user_id: profile.user_id, role: "assistant", message: reply }).select().single();
    if (ins2) setMsgs((p) => [...p, ins2 as AvaMsg]);
    setSending(false);
  };

  const clear = async () => {
    if (!profile?.user_id) return;
    await supabase.from("planipret_ava_conversations").delete().eq("user_id", profile.user_id);
    setMsgs([]);
  };

  return (
    <div className="absolute inset-x-0 top-[120px] bottom-0 flex flex-col">
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--pp-bg-border)" }}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--pp-agent)" }}>
          <Sparkles className="w-3 h-3" /> Assistant AVA
        </div>
        {msgs.length > 0 && (
          <button onClick={clear} className="text-[11px]" style={{ color: "var(--pp-text-muted)" }}>
            Effacer
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="text-center py-8" style={{ color: "var(--pp-text-muted)" }}>
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : msgs.length === 0 ? (
          <div className="text-center py-10 px-6">
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: "linear-gradient(135deg, var(--pp-agent), #6C3CE1)",
                boxShadow: "0 8px 24px rgba(155,127,232,0.4)",
              }}
            >
              <Bot className="w-7 h-7 text-white" />
            </div>
            <p className="font-semibold" style={{ color: "var(--pp-text-primary)" }}>Bonjour, je suis AVA</p>
            <p className="text-xs mt-1" style={{ color: "var(--pp-text-muted)" }}>
              Demandez-moi un brief, planifiez un rappel, ou cherchez un contact.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {[
                "📊 Brief du jour",
                "🔥 Mes hot leads",
                "📅 Mes RDV",
                "💡 Conseils du jour",
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setText(chip.replace(/^\S+\s/, ""))}
                  className="text-[11px] px-3 py-1.5 rounded-full"
                  style={{
                    background: "rgba(155,127,232,0.10)",
                    border: "1px solid rgba(155,127,232,0.30)",
                    color: "var(--pp-agent)",
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.role === "user";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%] flex items-end gap-2">
                  {!mine && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--pp-agent), #6C3CE1)" }}
                    >
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div>
                    <div
                      className={mine ? "pp-bubble-out" : ""}
                      style={
                        mine
                          ? { padding: "8px 12px", fontSize: 14 }
                          : {
                              padding: "8px 12px",
                              fontSize: 14,
                              background: "rgba(155,127,232,0.10)",
                              border: "1px solid rgba(155,127,232,0.25)",
                              color: "var(--pp-text-primary)",
                              borderRadius: "16px 16px 16px 4px",
                            }
                      }
                    >
                      <p className="whitespace-pre-wrap break-words">{m.message}</p>
                    </div>
                    <p className={`text-[10px] mt-1 ${mine ? "text-right" : "text-left"}`} style={{ color: "var(--pp-text-faint)" }}>
                      {fmtTime(m.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {sending && (
          <div className="flex justify-start">
            <div
              className="px-3 py-2 rounded-2xl text-sm flex items-center gap-2"
              style={{
                background: "rgba(155,127,232,0.10)",
                border: "1px solid rgba(155,127,232,0.25)",
                color: "var(--pp-agent)",
              }}
            >
              <Loader2 className="w-3 h-3 animate-spin" /> AVA réfléchit…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <Composer text={text} setText={setText} onSend={send} sending={sending} placeholder="Demandez à AVA…" accent="agent" />
    </div>
  );
}

// ============================================================
// EMAILS TAB (M365)
// ============================================================
function EmailsList({ profile }: { profile: any }) {
  const [emails, setEmails] = useState<any[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "no_m365" | "error">("loading");

  const load = async () => {
    if (!profile?.ms365_access_token) { setState("no_m365"); return; }
    setState("loading");
    const { data, error } = await supabase.functions.invoke("ms365-actions", {
      body: { action: "list_messages", payload: { top: 25 } },
    });
    if (error || !(data as any)?.success) { setState("error"); return; }
    setEmails(((data as any).messages ?? (data as any).emails ?? []));
    setState("ready");
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.ms365_access_token]);

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="flex justify-end mb-2">
        <button
          onClick={load}
          className="text-xs flex items-center gap-1 px-2 py-1"
          style={{ color: "var(--pp-text-muted)" }}
        >
          <RefreshCw className={`w-3 h-3 ${state === "loading" ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {state === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: "var(--pp-bg-surface)" }} />
          ))}
        </div>
      )}

      {state === "no_m365" && (
        <div
          className="rounded-2xl p-6 text-center mt-6"
          style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}
        >
          <Mail className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--pp-brand-accent)" }} />
          <p className="font-semibold" style={{ color: "var(--pp-text-primary)" }}>Microsoft 365 non connecté</p>
          <p className="text-xs mt-1 mb-3" style={{ color: "var(--pp-text-muted)" }}>
            Connectez votre compte M365 pour voir vos emails ici.
          </p>
          <a
            href="/mplanipret/more"
            className="inline-block text-xs px-4 py-2 rounded-full text-white font-semibold"
            style={{ background: "linear-gradient(135deg, var(--pp-brand-accent), var(--pp-brand-accent-2))" }}
          >
            Connecter M365
          </a>
        </div>
      )}

      {state === "error" && (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: "var(--pp-text-muted)" }}>Impossible de charger les emails</p>
          <button
            onClick={load}
            className="mt-3 text-xs px-3 py-1.5 rounded-full"
            style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}
          >
            Réessayer
          </button>
        </div>
      )}

      {state === "ready" && (emails?.length === 0 ? (
        <EmptyState Icon={Mail} title="Boîte vide" sub="Aucun email récent." />
      ) : (
        <ul className="space-y-1.5">
          {emails!.map((e: any, i: number) => {
            const from = e.from?.emailAddress?.name ?? e.from?.emailAddress?.address ?? "Expéditeur";
            const subject = e.subject ?? "(Sans objet)";
            const preview = e.bodyPreview ?? "";
            const received = e.receivedDateTime ?? e.created_at;
            const unread = e.isRead === false;
            return (
              <li
                key={e.id ?? i}
                className="rounded-2xl p-3"
                style={{
                  background: "var(--pp-bg-surface)",
                  border: "1px solid var(--pp-bg-border-2)",
                  borderLeft: unread ? "3px solid var(--pp-brand-accent)" : "1px solid var(--pp-bg-border-2)",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-sm truncate" style={{ color: "var(--pp-text-primary)" }}>{from}</p>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--pp-text-faint)" }}>
                    {received ? fmtTime(received) : ""}
                  </span>
                </div>
                <p className="text-xs truncate mb-1" style={{ color: "var(--pp-text-secondary)" }}>{subject}</p>
                <p className="text-[11px] line-clamp-2" style={{ color: "var(--pp-text-muted)" }}>{preview}</p>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

// ============================================================
// SHARED PRIMITIVES
// ============================================================
function Composer({
  text, setText, onSend, sending, placeholder = "Écrire un message…", leftAction, extra, accent = "brand",
}: {
  text: string; setText: (v: string) => void; onSend: () => void; sending: boolean;
  placeholder?: string; leftAction?: React.ReactNode; extra?: React.ReactNode;
  accent?: "brand" | "agent";
}) {
  const accentBg =
    accent === "agent"
      ? "linear-gradient(135deg, var(--pp-agent), #6C3CE1)"
      : "linear-gradient(135deg, var(--pp-brand-accent), var(--pp-brand-accent-2))";
  return (
    <div
      className="px-3 py-2 flex items-center gap-2"
      style={{ background: "var(--pp-bg-deep)", borderTop: "1px solid var(--pp-bg-border)" }}
    >
      {extra}
      {leftAction}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 rounded-full text-sm outline-none"
        style={{
          background: "var(--pp-bg-elevated)",
          border: "1px solid var(--pp-bg-border-2)",
          color: "var(--pp-text-primary)",
        }}
      />
      <button
        onClick={onSend}
        disabled={!text.trim() || sending}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-50 shrink-0"
        style={{ background: accentBg, boxShadow: "0 2px 12px rgba(46,155,220,0.35)" }}
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
}

function EmptyState({ Icon, title, sub }: { Icon: any; title: string; sub: string }) {
  return (
    <div className="p-10 text-center">
      <div
        className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
        style={{ background: "rgba(46,155,220,0.12)", color: "var(--pp-brand-accent)" }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="font-semibold" style={{ color: "var(--pp-text-secondary)" }}>{title}</div>
      <div className="text-xs mt-1" style={{ color: "var(--pp-text-muted)" }}>{sub}</div>
    </div>
  );
}
