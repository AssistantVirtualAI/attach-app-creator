import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMplanipretLang } from "@/hooks/useMplanipretLang";

/**
 * Small banner that reports the broker's SIP extension sync status and
 * lets them force a resync via ns-resolve-sip-credentials.
 * Auto-hydrates sessionStorage.pp_sip_config on successful resolve.
 */
export default function ExtensionSyncBanner({
  profile,
  reloadProfile,
}: {
  profile: any;
  reloadProfile: () => Promise<void>;
}) {
  const { t } = useMplanipretLang();
  const [busy, setBusy] = useState(false);
  const [lastCheck, setLastCheck] = useState<number>(0);

  // Source of truth is the NetSapiens extension. `profile.extension` can hold
  // a stale/legacy value from earlier migrations and must never be preferred.
  const extension = profile?.ns_extension || profile?.extension;
  const hasSip = !!extension && !!profile?.ns_linked;
  const cached = (() => {
    try { return JSON.parse(sessionStorage.getItem("pp_sip_config") || "null"); } catch { return null; }
  })();
  const cachedMatch = cached?.extension && String(cached.extension) === String(extension);

  const resync = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("ns-resolve-sip-credentials", { body: { client_type: "mobile" } });
    setBusy(false);
    setLastCheck(Date.now());
    const res = (data ?? {}) as any;
    if (error || !res?.ok) {
      toast.error(res?.error === "not_linked" ? t("extSync.notLinked") : (res?.error ?? error?.message ?? t("extSync.failed")));
      return;
    }
    sessionStorage.setItem("pp_sip_config", JSON.stringify({
      username: res.sip_username, password: res.sip_password,
      domain: res.sip_domain, proxy: res.sip_proxy, extension: res.sip_extension,
    }));
    window.dispatchEvent(new CustomEvent("pp:sip-ready", { detail: { extension: res.sip_extension } }));
    if (profile?.user_id && res.sip_extension && res.sip_extension !== extension) {
      await supabase.from("planipret_profiles")
        .update({ extension: res.sip_extension, ns_extension: res.sip_extension, ns_domain: res.sip_domain })
        .eq("user_id", profile.user_id);
      await reloadProfile();
    }
    toast.success(t("extSync.synced"));
  };

  // Auto-hydrate on mount and auto-retry every 30s while offline (no manual button).
  useEffect(() => {
    if (hasSip && !cachedMatch && !busy) resync();
    const iv = setInterval(() => {
      if (hasSip && !cachedMatch && !busy) resync();
    }, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSip, cachedMatch]);

  if (!extension) {
    return (
      <div className="pp-card flex items-center gap-2" style={{ padding: 10, borderColor: "rgba(232,76,76,0.35)" }}>
        <AlertTriangle className="w-4 h-4" style={{ color: "var(--pp-color-danger)" }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{t("extSync.noExtension")}</div>
          <div className="text-xs" style={{ color: "var(--pp-text-muted)" }}>{t("extSync.contactAdmin")}</div>
        </div>
      </div>
    );
  }

  const ok = hasSip && cachedMatch;
  const dot = ok ? "var(--pp-color-success)" : busy ? "#F5A623" : "var(--pp-color-danger)";
  const label = ok ? t("extSync.ready") : busy ? t("extSync.syncing") : t("extSync.needsResync");
  return (
    <div className="pp-card flex items-center gap-2" style={{ padding: 10 }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: dot, boxShadow: `0 0 0 3px ${dot}22` }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">
          {t("extSync.extLabel")} {extension}
        </div>
        <div className="text-xs truncate" style={{ color: "var(--pp-text-muted)" }}>
          {label}
        </div>
      </div>
      {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--pp-text-muted)" }} />}
    </div>
  );
}
