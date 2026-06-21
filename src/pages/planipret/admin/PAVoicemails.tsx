import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play, X } from "lucide-react";

export default function PAVoicemails() {
  const [rows, setRows] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("planipret_voicemails")
        .select("*, planipret_profiles!inner(full_name)")
        .order("created_at", { ascending: false }).limit(500);
      setRows(data ?? []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
            <tr><th className="p-3">Courtier</th><th>De</th><th>Durée</th><th>Date</th><th>Lu</th><th>Transcription</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Aucun voicemail</td></tr> :
              rows.map((v) => (
                <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">{v.planipret_profiles?.full_name ?? "—"}</td>
                  <td className="text-slate-600">{v.from_number ?? "—"}</td>
                  <td className="text-slate-500">{v.duration_seconds ? `${v.duration_seconds}s` : "—"}</td>
                  <td className="text-slate-400 text-xs">{new Date(v.created_at).toLocaleString("fr-CA")}</td>
                  <td>{v.is_read ? "✓" : <span className="text-blue-500">●</span>}</td>
                  <td className="text-slate-500 truncate max-w-[200px]">{v.transcript ? v.transcript.slice(0, 50) + "…" : "—"}</td>
                  <td><button onClick={() => setDetail(v)} className="p-1.5 rounded hover:bg-slate-100"><Play className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setDetail(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Voicemail · {detail.from_number}</h3>
              <button onClick={() => setDetail(null)}><X className="w-4 h-4" /></button>
            </div>
            {detail.audio_url ? <audio src={detail.audio_url} controls className="w-full mb-4" /> : <p className="text-xs text-slate-400 mb-4">Audio non disponible</p>}
            {detail.transcript && <div className="bg-slate-50 p-3 rounded text-sm whitespace-pre-wrap">{detail.transcript}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
