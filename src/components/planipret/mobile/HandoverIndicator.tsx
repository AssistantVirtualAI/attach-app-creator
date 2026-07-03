// In-call "network handover" indicator with short history.
// Subscribes to handoverController events so the user sees when the call was
// migrated (Wi-Fi → LTE, LTE → Wi-Fi, ICE restart, re-register).

import { useEffect, useState } from "react";
import { Wifi, Signal, RefreshCw, ArrowRightLeft } from "lucide-react";
import { handoverController, type HandoverEvent } from "@/lib/planipret/net/handoverController";
import { useMplanipretLang } from "@/hooks/useMplanipretLang";

const MAX = 5;

function label(t: string) {
  if (t === "wifi") return "Wi-Fi";
  if (t === "cellular") return "LTE";
  if (t === "none") return "—";
  return t.toUpperCase();
}

export default function HandoverIndicator() {
  const { t } = useMplanipretLang();
  const [events, setEvents] = useState<HandoverEvent[]>([]);
  useEffect(() => {
    const un = handoverController.subscribe((e) => {
      setEvents((prev) => [e, ...prev].slice(0, MAX));
    });
    return () => un();
  }, []);
  if (events.length === 0) return null;
  const last = events[0];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
           style={{ background: "rgba(46,155,220,0.15)", border: "1px solid rgba(46,155,220,0.35)" }}>
        {last.kind === "network-change" ? (
          <>
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span className="font-medium">{label(last.from)} → {label(last.to)}</span>
          </>
        ) : last.kind === "ice-restart" ? (
          <>
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="font-medium">{last.ok ? t("handover.iceOk") : t("handover.iceFail")}</span>
          </>
        ) : (
          <>
            <Signal className="w-3.5 h-3.5" />
            <span className="font-medium">{t("handover.reregistered")}</span>
          </>
        )}
      </div>
      {events.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1 max-w-[260px]">
          {events.slice(1).map((e, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full text-white/60"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {e.kind === "network-change" ? `${label(e.from)}→${label(e.to)}` : e.kind === "ice-restart" ? "ICE" : "REG"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
