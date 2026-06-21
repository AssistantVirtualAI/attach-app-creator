import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

export default function PAMessages() {
  const [rows, setRows] = useState<any[]>([]);
  const [thread, setThread] = useState<any[] | null>(null);
  const [threadKey, setThreadKey] = useState<string | null>(null);
  const [direction, setDirection] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");

  const load = async () => {
    let q = supabase.from("planipret_phone_messages").select("*, planipret_profiles!inner(full_name)").order("created_at", { ascending: false }).limit(500);
    if (direction) q = q.eq("direction", direction);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    const { data } = await q;
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [direction, from, to]);

  const openThread = async (m: any) => {
    const peer = m.direction === "outbound" ? m.to_number : m.from_number;
    setThreadKey(peer);
    const { data } = await supabase.from("planipret_phone_messages")
      .select("*").eq("user_id", m.user_id).or(`from_number.eq.${peer},to_number.eq.${peer}`).order("created_at", { ascending: true });
    setThread(data ?? []);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-2">
        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">
          <option value="">Toutes directions</option><option value="inbound">Entrant</option><option value="outbound">Sortant</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
            <tr><th className="p-3">Courtier</th><th>Dir.</th><th>De</th><th>Vers</th><th>Aperçu</th><th>Date</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucun message</td></tr> :
              rows.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => openThread(m)}>
                  <td className="p-3">{m.planipret_profiles?.full_name ?? "—"}</td>
                  <td>{m.direction === "outbound" ? "↗" : "↙"}</td>
                  <td className="text-slate-600">{m.from_number}</td>
                  <td className="text-slate-600">{m.to_number}</td>
                  <td className="text-slate-500 truncate max-w-[300px]">{(m.body ?? "").slice(0, 60)}</td>
                  <td className="text-slate-400 text-xs">{new Date(m.created_at).toLocaleString("fr-CA")}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {thread && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setThread(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Conversation · {threadKey}</h3>
              <button onClick={() => setThread(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {thread.map((m) => (
                <div key={m.id} className={`p-2 rounded-lg text-sm ${m.direction === "outbound" ? "bg-blue-50 ml-8" : "bg-slate-100 mr-8"}`}>
                  <p>{m.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(m.created_at).toLocaleString("fr-CA")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
