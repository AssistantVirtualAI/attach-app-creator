import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, ArrowLeft, Phone, Send, Paperclip, MessageSquare, Zap } from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";
import SmsTemplatesSheet from "@/components/planipret/SmsTemplatesSheet";

const PRIMARY = "#1F4E79";

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
  const { profile, openDialer, registerRefresh } = useOutletContext<PlanipretMobileContext>();
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

  useEffect(() => { load(); }, [profile?.user_id]);
  useEffect(() => { registerRefresh(load); return () => registerRefresh(null); }, [profile?.user_id]);

  // Realtime
  useEffect(() => {
    if (!profile?.user_id) return;
    const ch = supabase
      .channel("mplanipret-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_phone_messages", filter: `user_id=eq.${profile.user_id}` }, (payload) => {
        const m = payload.new as Msg;
        setMessages((prev) => [m, ...prev]);
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
      if (!cur) {
        map.set(k, { number: k, last: m, unread: isUnread ? 1 : 0, preview: (m.body ?? "").slice(0, 40) });
      } else {
        if (isUnread) cur.unread += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => +new Date(b.last.created_at) - +new Date(a.last.created_at));
  }, [messages]);

  if (activeThread) {
    return <ThreadView number={activeThread} myExt={myExt} userId={profile.user_id} messages={messages.filter((m) => peer(m) === activeThread)} onBack={() => setActiveThread(null)} onCall={(n) => openDialer(n)} onSent={(m) => setMessages((p) => [m, ...p])} />;
  }

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold" style={{ color: "#1A1A2E" }}>Messages</h1>
        <button onClick={() => { setNewNumber(""); setNewOpen(true); }} className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm" style={{ background: PRIMARY }}>
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
        </div>
      ) : threads.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm mt-12">
          <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-slate-700">Aucun message pour l'instant</p>
          <p className="text-xs text-slate-400 mt-1">Utilisez le bouton + pour démarrer une conversation</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y" style={{ borderColor: "#F0F0F0" }}>
          {threads.map((t) => (
            <button key={t.number} onClick={() => setActiveThread(t.number)} className="w-full px-3 py-3 flex items-center gap-3 active:bg-slate-50 text-left">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0" style={{ background: PRIMARY }}>
                {initials(t.number)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: "#1A1A2E" }}>{t.number}</p>
                <p className="text-xs text-slate-500 truncate">{t.preview || "(pas de contenu)"}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[11px] text-slate-400">{fmtTime(t.last.created_at)}</span>
                {t.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">{t.unread}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {newOpen && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center bg-black/40" onClick={() => setNewOpen(false)}>
          <div className="bg-white w-full md:w-[360px] rounded-t-2xl md:rounded-2xl p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: "#1A1A2E" }}>Nouveau message</h2>
              <button onClick={() => setNewOpen(false)} className="p-1 rounded-full hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <input type="tel" inputMode="tel" placeholder="Numéro de téléphone" value={newNumber} onChange={(e) => setNewNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-slate-400" />
            <button disabled={!newNumber.trim()} onClick={() => { setActiveThread(newNumber.trim()); setNewOpen(false); }}
              className="w-full mt-3 py-2.5 rounded-lg text-white font-medium text-sm disabled:opacity-50" style={{ background: PRIMARY }}>
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

  // Mark inbound as read
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
    <div className="absolute inset-0 flex flex-col bg-white">
      <header className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 bg-white">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "#1A1A2E" }}>{number}</p>
          <p className="text-[11px] text-slate-400">{ordered.length} message{ordered.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => onCall(number)} className="px-3 py-1.5 rounded-full text-white text-xs font-medium flex items-center gap-1.5" style={{ background: PRIMARY }}>
          <Phone className="w-3.5 h-3.5" /> Appeler
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2" style={{ background: "#FAFAFA" }}>
        {ordered.map((m) => {
          const out = m.direction === "outbound";
          const media: string[] = Array.isArray(m.media_urls) ? m.media_urls : [];
          return (
            <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[78%]">
                <div className="px-3 py-2 text-sm shadow-sm" style={{
                  background: out ? PRIMARY : "#F0F0F0",
                  color: out ? "white" : "#1A1A2E",
                  borderRadius: out ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                }}>
                  {media.length > 0 && (
                    <div className="space-y-1 mb-1">
                      {media.map((u, i) => <img key={i} src={u} alt="" className="rounded-lg max-w-full" />)}
                    </div>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                </div>
                <p className={`text-[10px] text-slate-400 mt-1 ${out ? "text-right" : "text-left"}`}>{fmtTime(m.created_at)}{m.status === "sending" ? " · envoi…" : ""}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-2 bg-white">
        <button onClick={() => toast("Pièce jointe : bientôt disponible")} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
          <Paperclip className="w-5 h-5" />
        </button>
        <button onClick={() => setTplOpen(true)} className="p-2 rounded-full hover:bg-slate-100" title="Templates" style={{ color: PRIMARY }}>
          <Zap className="w-5 h-5" />
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Écrire un message..."
          className="flex-1 px-3 py-2 rounded-full bg-slate-100 text-sm focus:outline-none" />
        <button onClick={send} disabled={!text.trim() || sending}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-50" style={{ background: PRIMARY }}>
          <Send className="w-4 h-4" />
        </button>
      </div>
      <SmsTemplatesSheet open={tplOpen} onClose={() => setTplOpen(false)} userId={userId} onPick={(body) => setText((t) => t ? `${t} ${body}` : body)} />
    </div>
  );
}
