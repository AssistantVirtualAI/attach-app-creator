// Mic permission fallback dialog for Planipret mobile.
// Shown BEFORE launching a call when the browser/OS reports "denied" or
// "unavailable", so the user gets a clear explanation and a path to fix it.

import { Mic, ShieldAlert, X } from "lucide-react";
import { useMplanipretLang } from "@/hooks/useMplanipretLang";
import type { MicPermissionState } from "@/lib/planipret/audio/micPermission";

interface Props {
  open: boolean;
  state: MicPermissionState;
  onRetry: () => void;
  onClose: () => void;
}

export default function MicPermissionDialog({ open, state, onRetry, onClose }: Props) {
  const { t } = useMplanipretLang();
  if (!open) return null;
  const unavailable = state === "unavailable";
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
         role="dialog" aria-modal="true" aria-labelledby="mic-perm-title">
      <div className="w-full max-w-sm rounded-3xl p-6 text-white"
           style={{ background: "linear-gradient(160deg,#0A1425,#0D2540)", border: "1px solid rgba(46,155,220,0.25)" }}>
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
               style={{ background: "rgba(232,76,76,0.15)", border: "1px solid rgba(232,76,76,0.4)" }}>
            {unavailable ? <ShieldAlert className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </div>
          <button onClick={onClose} className="p-1 opacity-70 hover:opacity-100" aria-label={t("common.close")}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <h2 id="mic-perm-title" className="mt-4 text-lg font-semibold">
          {unavailable ? t("mic.unavailableTitle") : t("mic.deniedTitle")}
        </h2>
        <p className="mt-2 text-sm text-white/75 leading-relaxed">
          {unavailable ? t("mic.unavailableBody") : t("mic.deniedBody")}
        </p>
        <ol className="mt-4 space-y-1.5 text-xs text-white/60 list-decimal list-inside">
          <li>{t("mic.step1")}</li>
          <li>{t("mic.step2")}</li>
          <li>{t("mic.step3")}</li>
        </ol>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
                  className="flex-1 py-3 rounded-2xl text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
            {t("common.cancel")}
          </button>
          <button onClick={onRetry}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg,#1A4A8A,#2E9BDC)" }}>
            {t("mic.retry")}
          </button>
        </div>
      </div>
    </div>
  );
}
