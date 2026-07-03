import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Smartphone, Radio, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PlanipretMobileContext } from "../PlanipretMobile";

type State = "ok" | "provisioning" | "missing" | "error" | "idle";

type DeviceDetail = { id: string; user_agent: string | null; ip: string | null; registered_at: string | null; registered: boolean; is_mine: boolean };

export default function MExtensionSync() {
  const { profile, reloadProfile } = useOutletContext<PlanipretMobileContext>();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [lastResult, setLastResult] = useState<any>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<string[] | null>(null);
  const [devicesDetail, setDevicesDetail] = useState<DeviceDetail[] | null>(null);
  const [registeredDeviceId, setRegisteredDeviceId] = useState<string | null>(null);


  const extension = profile?.ns_extension || profile?.extension || null;
  const domain = profile?.ns_domain || "planipret.ca";
  const linked = !!profile?.ns_linked;
  const mobileDeviceId = profile?.ns_mobile_device_id || (extension ? `${extension}_mobile` : null);
  const cached = (() => {
    try { return JSON.parse(sessionStorage.getItem("pp_sip_config") || "null"); } catch { return null; }
  })();
  const cachedMatch = cached?.extension && String(cached.extension) === String(extension);

  const runResync = async (opts?: { silent?: boolean }) => {
    if (!extension) {
      toast.error("Aucune extension associée à ce profil.");
      return;
    }
    setBusy(true);
    setState("provisioning");
    // Invalidate cached SIP config BEFORE fetching new creds so the softphone
    // never re-registers on stale (widget) credentials after a resync.
    try { sessionStorage.removeItem("pp_sip_config"); } catch {}
    const { data, error } = await supabase.functions.invoke("ns-resolve-sip-credentials", {
      body: { client_type: "mobile" },
    });
    setBusy(false);
    const res = (data ?? {}) as any;
    setLastResult({ error: error?.message ?? null, ...res });
    if (Array.isArray(res?.ns_devices)) setDevices(res.ns_devices);
    else if (Array.isArray(res?.ns_devices_now)) setDevices(res.ns_devices_now);
    if (Array.isArray(res?.ns_devices_detail)) setDevicesDetail(res.ns_devices_detail);
    if (res?.ns_registered_device_id) setRegisteredDeviceId(res.ns_registered_device_id);
    if (error || !res?.ok) {
      setState("error");
      if (!opts?.silent) toast.error(res?.error ?? error?.message ?? "Échec du resync");
      return;
    }
    sessionStorage.setItem("pp_sip_config", JSON.stringify({
      username: res.sip_username, password: res.sip_password,
      domain: res.sip_domain, proxy: res.sip_proxy, extension: res.sip_extension,
    }));
    window.dispatchEvent(new CustomEvent("pp:sip-ready", { detail: { extension: res.sip_extension, force: true } }));
    await reloadProfile();
    setState("ok");
    if (!opts?.silent) toast.success(`Extension ${res.sip_extension} synchronisée`);
  };

  const forceReregister = () => {
    try { sessionStorage.removeItem("pp_sip_config"); } catch {}
    window.dispatchEvent(new CustomEvent("pp:sip-force-reregister", { detail: { at: Date.now() } }));
    toast.success("Réinscription SIP demandée sur " + (mobileDeviceId ?? "l'appareil mobile"));
    // Refresh device list shortly after so the UI reflects the new registration.
    setTimeout(() => { void runResync({ silent: true }); }, 3500);
  };


  // Listen for SIP registration events fired by the softphone layer.
  useEffect(() => {
    const onReg = (e: any) => setRegistered(!!e?.detail?.registered);
    window.addEventListener("pp:sip-registered", onReg as any);
    return () => window.removeEventListener("pp:sip-registered", onReg as any);
  }, []);

  // Auto-heal on first mount when linked bit is missing but ext exists.
  useEffect(() => {
    if (extension && (!linked || !cachedMatch) && state === "idle") {
      runResync({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: Array<{ label: string; value: string; ok: boolean | null; icon: any }> = [
    { label: "Extension NetSapiens", value: extension ?? "—", ok: !!extension, icon: Smartphone },
    { label: "Domaine SIP", value: domain, ok: !!domain, icon: Radio },
    { label: "État lié (ns_linked)", value: linked ? "Oui" : "Non", ok: linked, icon: linked ? CheckCircle2 : AlertTriangle },
    { label: "Appareil mobile", value: mobileDeviceId ?? "—", ok: !!mobileDeviceId, icon: Smartphone },
    { label: "Credentials en cache", value: cachedMatch ? "OK" : "Manquant", ok: cachedMatch, icon: cachedMatch ? CheckCircle2 : AlertTriangle },
    { label: "Enregistrement SIP", value: registered === null ? "Inconnu" : registered ? "Enregistré" : "Non enregistré", ok: registered, icon: registered ? CheckCircle2 : AlertTriangle },
  ];

  const globalOk = !!extension && linked && cachedMatch;

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full"
          style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)" }}
          aria-label="Retour"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 18 }}>
          Synchronisation d'extension
        </div>
      </div>

      <div
        className="pp-card"
        style={{
          padding: 14,
          borderColor: globalOk
            ? "rgba(52,199,89,0.35)"
            : state === "error"
              ? "rgba(232,76,76,0.35)"
              : "rgba(245,158,11,0.35)",
        }}
      >
        <div className="flex items-center gap-2">
          {globalOk
            ? <CheckCircle2 className="w-5 h-5" style={{ color: "var(--pp-color-success)" }} />
            : state === "error"
              ? <XCircle className="w-5 h-5" style={{ color: "var(--pp-color-danger)" }} />
              : <AlertTriangle className="w-5 h-5" style={{ color: "#F59E0B" }} />}
          <div className="flex-1">
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {globalOk ? "Poste prêt à recevoir des appels" : "Synchronisation requise"}
            </div>
            <div style={{ fontSize: 12, color: "var(--pp-text-muted)" }}>
              {extension ? `Extension ${extension} · ${domain}` : "Aucune extension"}
            </div>
          </div>
        </div>
      </div>

      <div className="pp-card" style={{ padding: 8 }}>
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{
                padding: "10px 8px",
                borderBottom: i < items.length - 1 ? "1px solid var(--pp-bg-border-2)" : "none",
              }}
            >
              <Icon
                className="w-4 h-4"
                style={{
                  color: it.ok === true
                    ? "var(--pp-color-success)"
                    : it.ok === false
                      ? "var(--pp-color-danger)"
                      : "var(--pp-text-muted)",
                }}
              />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, fontWeight: 600 }}>{it.label}</div>
                <div style={{ fontSize: 12, color: "var(--pp-text-muted)", wordBreak: "break-all" }}>{it.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => runResync()}
        disabled={busy || !extension}
        className="w-full flex items-center justify-center gap-2 active:scale-[0.99] transition"
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: busy ? "var(--pp-bg-elevated)" : "linear-gradient(135deg, #1A4A8A, #2E9BDC)",
          color: busy ? "var(--pp-text-muted)" : "#fff",
          fontFamily: "Inter,sans-serif",
          fontWeight: 700,
          fontSize: 14,
          border: "none",
          opacity: !extension ? 0.5 : 1,
        }}
      >
        <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Synchronisation en cours…" : "Forcer le resync"}
      </button>

      {devices && (
        <div className="pp-card" style={{ padding: 10 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              Appareils SIP ({devices.length})
            </div>
            <button
              onClick={() => runResync({ silent: true })}
              disabled={busy}
              className="flex items-center gap-1 px-2 py-1 rounded-md"
              style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", fontSize: 11 }}
              aria-label="Rafraîchir la liste"
            >
              <RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} />
              Rafraîchir
            </button>
          </div>
          {devices.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--pp-text-muted)" }}>Aucun appareil trouvé.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {devices.map((d) => {
                const isMine = d === mobileDeviceId;
                return (
                  <div
                    key={d}
                    className="flex items-center gap-2"
                    style={{
                      fontSize: 12,
                      padding: "6px 8px",
                      borderRadius: 8,
                      background: isMine ? "rgba(46,155,220,0.10)" : "transparent",
                      border: isMine ? "1px solid rgba(46,155,220,0.35)" : "1px solid transparent",
                    }}
                  >
                    {isMine
                      ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--pp-color-success)" }} />
                      : <Smartphone className="w-3.5 h-3.5" style={{ color: "var(--pp-text-muted)" }} />}
                    <span style={{ fontWeight: isMine ? 700 : 500, wordBreak: "break-all" }}>{d}</span>
                    {isMine && (
                      <span style={{ fontSize: 10, color: "var(--pp-color-success)", marginLeft: "auto" }}>
                        ce téléphone
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {lastResult && (

        <div className="pp-card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Dernier résultat</div>
          <pre style={{
            fontSize: 11,
            color: "var(--pp-text-muted)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            margin: 0,
          }}>
{JSON.stringify(
  { ok: lastResult.ok, device_id: lastResult.device_id, sip_extension: lastResult.sip_extension, error: lastResult.error },
  null,
  2,
)}
          </pre>
        </div>
      )}
    </div>
  );
}
