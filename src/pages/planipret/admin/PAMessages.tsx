import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const ACCENT = "#2E9BDC";
const SUCCESS = "#00D4AA";

const PAGE = 50;

export default function PAMessages() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [thread, setThread] = useState<any[] | null>(null);
  const [threadKey, setThreadKey] = useState<string | null>(null);
  const [direction, setDirection] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [syncing, setSyncing] = useState(false);

  const brokerName = (m: any) => m.planipret_profiles?.full_name ?? m.metadata?.user_name ?? m.metadata?.extension_name ?? (m.metadata?.extension ? `Ext. ${m.metadata.extension}` : "—");

  const load = async (p = page) => {
    const fromIdx = (p - 1) * PAGE;
    let q = supabase.from("planipret_phone_messages")
      .select("*, planipret_profiles(full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(fromIdx, fromIdx + PAGE - 1);
    if (direction) q = q.eq("direction", direction);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    const { data, count } = await q;
    setRows(data ?? []);
    setTotal(count ?? 0);
  };

  useEffect(() => { setPage(1); load(1); /* eslint-disable-next-line */ }, [direction, from, to]);
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  useEffect(() => {
    const ch = supabase.channel("admin-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_phone_messages" }, () => load(1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);


  const openThread = async (m: any) => {
    const peer = m.direction === "outbound" ? m.to_number : m.from_number;
    setThreadKey(peer);
    const { data } = await supabase.from("planipret_phone_messages")
      .select("*").or(`from_number.eq.${peer},to_number.eq.${peer}`).order("created_at", { ascending: true });
    setThread(data ?? []);
  };

  const syncAll = async () => {
    setSyncing(true);
    const id = toast.loading("Synchronisation NS-API messages/appels…");
    try {
      const { data, error } = await supabase.functions.invoke("pp-admin-ns-sync", { body: {} });
      if (error) throw error;
      toast.success(`${(data as any)?.extensions ?? (data as any)?.users_total ?? 0} extensions synchronisées · messages en arrière-plan`, { id });
      await load(1);
    } catch (e: any) { toast.error(`Échec: ${e.message ?? e}`, { id }); }
    finally { setSyncing(false); }
  };

  const inputStyle = { background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-primary)" };

  return (
    <div className="space-y-4">
      <div className="pp-card p-4 flex flex-wrap items-end gap-2">
        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={inputStyle}>
          <option value="" style={{ background: "var(--pp-bg-deep)" }}>Toutes directions</option>
          <option value="inbound" style={{ background: "var(--pp-bg-deep)" }}>Entrant</option>
          <option value="outbound" style={{ background: "var(--pp-bg-deep)" }}>Sortant</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={inputStyle} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={inputStyle} />
        <button onClick={syncAll} disabled={syncing} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: ACCENT }}>
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Synchroniser NS-API
        </button>
      </div>
      <div className="pp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--pp-bg-elevated)" }}>
            <tr style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pp-text-faint)" }} className="text-left">
              <th className="p-3">Courtier</th><th>Dir.</th><th>De</th><th>Vers</th><th>Aperçu</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="p-8 text-center" style={{ color: "var(--pp-text-faint)" }}>Aucun message synchronisé. Lancez la synchronisation NS-API.</td></tr> :
              rows.map((m) => {
                const out = m.direction === "outbound";
                const Icon = out ? ArrowUpRight : ArrowDownLeft;
                return (
                  <tr key={m.id} className="cursor-pointer hover:bg-white/[0.02]" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} onClick={() => openThread(m)}>
                    <td className="p-3" style={{ color: "var(--pp-text-primary)" }}>{brokerName(m)}</td>
                    <td><Icon className="w-3.5 h-3.5" style={{ color: out ? SUCCESS : ACCENT }} /></td>
                    <td style={{ color: "var(--pp-text-secondary)" }}>{m.from_number}</td>
                    <td style={{ color: "var(--pp-text-secondary)" }}>{m.to_number}</td>
                    <td className="truncate max-w-[300px]" style={{ color: "var(--pp-text-muted)" }}>{(m.body ?? "").slice(0, 60)}</td>
                    <td style={{ fontSize: 11, color: "var(--pp-text-faint)" }}>{new Date(m.created_at).toLocaleString("fr-CA")}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--pp-bg-border-2)", fontSize: 11, color: "var(--pp-text-muted)" }}>
          <span>{total === 0 ? 0 : (page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} sur {total}</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>←</button>
            <span className="px-3 py-1">{page} / {Math.max(1, Math.ceil(total / PAGE))}</span>
            <button disabled={page >= Math.ceil(total / PAGE)} onClick={() => setPage(page + 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>→</button>
          </div>
        </div>
      </div>

      {thread && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setThread(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto p-5" style={{ background: "var(--pp-bg-surface)", borderLeft: "1px solid var(--pp-bg-border-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>Conversation · {threadKey}</h3>
              <button onClick={() => setThread(null)}><X className="w-4 h-4" style={{ color: "var(--pp-text-muted)" }} /></button>
            </div>
            <div className="space-y-2">
              {thread.map((m) => {
                const out = m.direction === "outbound";
                return (
                  <div key={m.id} className={`p-2.5 rounded-lg text-sm ${out ? "ml-8" : "mr-8"}`}
                    style={{
                      background: out ? "rgba(46,155,220,0.12)" : "var(--pp-bg-elevated)",
                      border: `1px solid ${out ? "rgba(46,155,220,0.25)" : "var(--pp-bg-border-2)"}`,
                      color: "var(--pp-text-primary)",
                    }}>
                    <p>{m.body}</p>
                    <p style={{ fontSize: 10, color: "var(--pp-text-faint)", marginTop: 4 }}>{new Date(m.created_at).toLocaleString("fr-CA")}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
