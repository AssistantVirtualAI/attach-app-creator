import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sipProvider, SoftphoneSnapshot, SoftphoneConfig } from "@/lib/softphone/jssipProvider";
import { ringtone } from "@/lib/softphone/ringtonePlayer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserStatus = "available" | "busy" | "dnd" | "away";

export type SoftphoneStatus =
  | "idle"
  | "loading-config"
  | "no-account"
  | "no-password"
  | "config-error"
  | "ready"
  | "registering"
  | "registered"
  | "disconnected"
  | "cert-error";

export function useSoftphone() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [snap, setSnap] = useState<SoftphoneSnapshot>(() => sipProvider.getSnapshot());
  const [config, setConfig] = useState<SoftphoneConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState<{ code: string; message: string } | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus>("available");
  const callStartRef = useRef<number | null>(null);
  const callMetaRef = useRef<{ direction: "in" | "out" | null; remote: string }>({ direction: null, remote: "" });

  useEffect(() => {
    const unsub = sipProvider.subscribe(setSnap);
    return () => { unsub(); };
  }, []);

  // Initialize once per user
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setConfigError(null);
      try {
        const { data, error } = await supabase.functions.invoke("softphone-credentials");
        if (cancelled) return;
        const raw = data as any;
        if (error || !raw) {
          setConfig(null);
          setConfigError({ code: "NETWORK_ERROR", message: error?.message || "Unable to reach telephony config service" });
          return;
        }
        if (raw.error) {
          setConfig(null);
          setConfigError({ code: raw.error, message: raw.message || raw.error });
          return;
        }
        const cfg: SoftphoneConfig = {
          extension: raw.extension,
          displayName: raw.displayName || raw.display_name || raw.extension,
          sipDomain: raw.sipDomain || raw.sip_domain || "lemtel.lemtel.tel",
          wssUrl: raw.wssUrl || raw.wss_url || "wss://pbxnode.lemtel.tel:7443",
          wssUrls: raw.wssUrls || raw.wss_urls || [],
          password: raw.password || raw.sip_password || "",
          mock: !!raw.mock,
        };
        setConfig(cfg);
        await sipProvider.init(cfg);
      } catch (e: any) {
        setConfigError({ code: "INIT_FAILED", message: e?.message || String(e) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Ringtone on incoming call
  useEffect(() => {
    if (snap.callState === "ringing-in") {
      ringtone.start();
      // Browser notification
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          try {
            new Notification("Incoming Call — AVA Softphone", {
              body: snap.remoteIdentity || snap.remoteNumber || "Unknown",
              icon: "/favicon.png",
            });
          } catch {}
        } else if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
    } else {
      ringtone.stop();
    }
  }, [snap.callState, snap.remoteIdentity, snap.remoteNumber]);

  // Persist call history to pbx_call_records when a call ends
  useEffect(() => {
    if (snap.callState === "ringing-out" || snap.callState === "ringing-in" || snap.callState === "active") {
      if (!callStartRef.current) callStartRef.current = Date.now();
      callMetaRef.current = {
        direction: snap.direction,
        remote: snap.remoteNumber || snap.remoteIdentity || "",
      };
    }
    if (snap.callState === "ended" && callStartRef.current && user) {
      const startedAt = new Date(callStartRef.current).toISOString();
      const endedAt = new Date().toISOString();
      const durationSec = Math.max(0, Math.round((Date.now() - callStartRef.current) / 1000));
      const meta = callMetaRef.current;
      callStartRef.current = null;
      callMetaRef.current = { direction: null, remote: "" };
      if (meta.remote) {
        (supabase.rpc as any)("log_softphone_call", {
          _direction: meta.direction === "in" ? "inbound" : "outbound",
          _remote_number: meta.remote,
          _started_at: startedAt,
          _ended_at: endedAt,
          _duration_seconds: durationSec,
          _hangup_cause: snap.errorCause || null,
          _sip_call_id: null,
        }).then(({ error }: any) => {
          if (error) console.warn("[softphone] log_softphone_call failed:", error.message);
          else queryClient.invalidateQueries({ queryKey: ["webphone-recents"] });
        });
      }
    }
  }, [snap.callState, snap.direction, snap.remoteNumber, snap.remoteIdentity, snap.errorCause, user, queryClient]);

  // Update status in DB
  const setStatus = useCallback(async (s: UserStatus) => {
    setUserStatus(s);
    if (!user) return;
    await supabase
      .from("pbx_softphone_users")
      .update({ status: s, last_seen_at: new Date().toISOString() })
      .eq("portal_user_id", user.id);
  }, [user?.id]);

  return {
    snap,
    config,
    loading,
    userStatus,
    setStatus,
    call: (n: string) => sipProvider.call(n),
    answer: () => sipProvider.answer(),
    hangup: () => sipProvider.hangup(),
    mute: () => sipProvider.mute(),
    unmute: () => sipProvider.unmute(),
    hold: () => sipProvider.hold(),
    unhold: () => sipProvider.unhold(),
    sendDTMF: (k: string) => sipProvider.sendDTMF(k),
    transfer: (t: string) => sipProvider.transfer(t),
    setAudioEl: (el: HTMLAudioElement | null) => { sipProvider.audioEl = el; },
    simulateIncoming: (n: string) => sipProvider.simulateIncoming(n),
  };
}
