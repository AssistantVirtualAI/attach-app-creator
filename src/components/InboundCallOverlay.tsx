import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export type InboundCall = { call_id?: string; from_number?: string; caller_name?: string } | null;

/** Generates the dual-tone ringback via Web Audio. Returns a stop() function. */
function startRingtone(): () => void {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  let killed = false;
  const cycle = () => {
    if (killed) return;
    const t = ctx.currentTime;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o1.frequency.value = 440; o2.frequency.value = 480;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.05);
    g.gain.setValueAtTime(0.15, t + 1.95);
    g.gain.linearRampToValueAtTime(0, t + 2.0);
    o1.connect(g); o2.connect(g); g.connect(ctx.destination);
    o1.start(t); o2.start(t); o1.stop(t + 2.0); o2.stop(t + 2.0);
    setTimeout(cycle, 6000);
  };
  cycle();
  return () => { killed = true; ctx.close().catch(() => {}); };
}

export default function InboundCallOverlay({ call, onClose }: { call: InboundCall; onClose: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!call) return;
    stopRef.current = startRingtone();
    const t = setTimeout(() => {
      toast(`📞 Appel manqué de ${call.from_number ?? ""}`);
      handleClose();
    }, 30000);
    return () => {
      clearTimeout(t);
      stopRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.call_id]);

  const handleClose = () => { stopRef.current?.(); onClose(); };

  const act = async (action: "answer" | "reject") => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.functions.invoke("ns-calls", { body: { action, call_id: call?.call_id } });
      handleClose();
      if (action === "answer") navigate("/mplanipret/calls");
    } catch (e: any) {
      toast.error(e?.message ?? "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  if (!call) return null;
  const name = call.caller_name || call.from_number || "Inconnu";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between py-12" style={{ background: "#0A1628" }}>
      <button onClick={handleClose} className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm flex items-center gap-1">
        <X className="w-4 h-4" /> Ignorer
      </button>

      <div className="flex flex-col items-center gap-4 mt-4">
        <span className="text-slate-400 text-sm uppercase tracking-widest">Appel entrant</span>
        <div className="relative w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-white text-2xl font-semibold">
          {call.caller_name ? call.caller_name.slice(0, 2).toUpperCase() : <Phone className="w-10 h-10" />}
        </div>
        <div className="text-white text-3xl font-bold tracking-tight text-center px-6">{name}</div>
        {call.caller_name && call.from_number && (
          <div className="text-slate-400 text-base">{call.from_number}</div>
        )}
      </div>

      <div className="relative w-48 h-48 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-blue-400/40 animate-ping" />
        <span className="absolute inset-4 rounded-full border-2 border-blue-400/30 animate-ping" style={{ animationDelay: "0.5s" }} />
        <span className="absolute inset-8 rounded-full border-2 border-blue-400/20 animate-ping" style={{ animationDelay: "1s" }} />
      </div>

      <div className="flex items-center gap-16 mb-8">
        <button onClick={() => act("reject")} disabled={busy}
          className="w-[72px] h-[72px] rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition flex items-center justify-center shadow-xl">
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
        <button onClick={() => act("answer")} disabled={busy}
          className="w-[72px] h-[72px] rounded-full bg-green-500 hover:bg-green-600 active:scale-95 transition flex items-center justify-center shadow-xl">
          <Phone className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}
