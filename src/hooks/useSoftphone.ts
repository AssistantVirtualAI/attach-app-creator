import { useEffect, useState, useCallback } from "react";
import { sipProvider, SoftphoneSnapshot, SoftphoneConfig } from "@/lib/softphone/jssipProvider";
import { ringtone } from "@/lib/softphone/ringtonePlayer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserStatus = "available" | "busy" | "dnd" | "away";

export function useSoftphone() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<SoftphoneSnapshot>(() => sipProvider.getSnapshot());
  const [config, setConfig] = useState<SoftphoneConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [userStatus, setUserStatus] = useState<UserStatus>("available");

  useEffect(() => sipProvider.subscribe(setSnap), []);

  // Initialize once per user
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("softphone-credentials");
        if (cancelled) return;
        if (error || !data || (data as any).error) {
          setConfig(null);
          return;
        }
        const cfg = data as SoftphoneConfig;
        setConfig(cfg);
        await sipProvider.init(cfg);
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
