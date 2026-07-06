// Planipret mobile — REST-only softphone hook.
//
// NS-API v2 does NOT expose a WebRTC/WSS endpoint. Calls are placed via the
// official "Make a new Call" REST endpoint (`POST /calls`) through the
// `pp-ns-calls` Edge Function, and NetSapiens rings the broker's registered
// physical device (PJSIP over TCP). This app only CONTROLS the call.
//
// Public API preserved so PlanipretMobile.tsx / ActiveCallOverlay still work.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { networkMonitor, type NetSample } from "@/lib/planipret/network/networkMonitor";
import type { PpSipSnapshot } from "@/lib/planipret/sip/ppSipProvider";
import type { CallQualitySnapshot } from "@/lib/planipret/audio/callQualitySampler";

type AnsweredBy = "mobile" | "widget" | "web" | null;

export type OutboundResult =
  | { via: "pbx"; ok: true }
  | { via: "none"; ok: false; error: string };

const emptySnap: PpSipSnapshot = {
  status: "registered",
  callState: "idle",
  remoteIdentity: "",
  remoteNumber: "",
  direction: null,
  callId: "",
  muted: false,
  onHold: false,
  startedAt: null,
  lastRegistrationAt: Date.now(),
};

export function useMplanipretSoftphone() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<PpSipSnapshot>(emptySnap);
  const [loading] = useState(false);
  const [net, setNet] = useState<NetSample>(networkMonitor.current());
  const [quality] = useState<CallQualitySnapshot | null>(null);
  const [answeredElsewhere, setAnsweredElsewhere] = useState<AnsweredBy>(null);
  const activeCallRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const un = networkMonitor.subscribe(setNet);
    return () => { un(); };
  }, []);

  const patch = (p: Partial<PpSipSnapshot>) => setSnap((s) => ({ ...s, ...p }));

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const pollActiveCalls = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("pp-ns-calls", { body: { action: "list" } });
      const list: any[] = Array.isArray(data) ? data : Array.isArray((data as any)?.calls) ? (data as any).calls : [];
      const call = list[0] || null;
      activeCallRef.current = call;
      if (call) {
        const cid = call["call-id"] ?? call.call_id ?? call.id ?? "";
        const remote = call["remote-uri"] ?? call["orig-to-uri"] ?? call["term-user"] ?? call.destination ?? "";
        setSnap((s) => ({ ...s, callState: "active", callId: String(cid), remoteNumber: String(remote), remoteIdentity: String(remote), startedAt: s.startedAt ?? Date.now() }));

      } else {
        // No active call — if we were ringing/active, mark ended.
        setSnap((s) => {
          if (s.callState === "idle" || s.callState === "ended") return s;
          return { ...s, callState: "ended" };
        });
        setTimeout(() => {
          setSnap((s) => (s.callState === "ended"
            ? { ...s, callState: "idle", callId: "", remoteNumber: "", remoteIdentity: "", direction: null, startedAt: null, muted: false, onHold: false }
            : s));
        }, 2000);
        stopPolling();
      }
    } catch {
      /* transient — keep polling */
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => { void pollActiveCalls(); }, 2000);
    // Kick immediately.
    void pollActiveCalls();
  }, [pollActiveCalls]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const placeCall = useCallback(async (destination: string): Promise<OutboundResult> => {
    if (!destination) return { via: "none", ok: false, error: "empty destination" };
    patch({ callState: "ringing-out", direction: "out", remoteNumber: destination, remoteIdentity: destination, errorCause: undefined, startedAt: null });
    const { data, error } = await supabase.functions.invoke("pp-ns-calls", {
      body: { action: "start", to_number: destination, client_type: "web" },
    });
    const d = data as any;
    if (error || d?.success === false || d?.error) {
      const msg = d?.error ?? error?.message ?? "Click-to-call failed";
      patch({ callState: "ended", errorCause: msg });
      setTimeout(() => setSnap((s) => ({ ...s, callState: "idle", direction: null, remoteNumber: "", remoteIdentity: "" })), 1500);
      return { via: "none", ok: false, error: msg };
    }
    if (d?.call_id) patch({ callId: String(d.call_id) });
    startPolling();
    return { via: "pbx", ok: true };
  }, [startPolling]);

  const controlAction = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const callId = activeCallRef.current?.["call-id"] ?? snap.callId;
    if (!callId) return;
    await supabase.functions.invoke("pp-ns-calls", { body: { action, call_id: callId, ...extra } });
  }, [snap.callId]);

  const hangup = useCallback(() => {
    void controlAction("disconnect");
    patch({ callState: "ended" });
    setTimeout(() => setSnap((s) => ({ ...s, callState: "idle", callId: "", direction: null, remoteNumber: "", remoteIdentity: "", startedAt: null })), 1000);
    stopPolling();
  }, [controlAction, stopPolling]);

  const hold = useCallback(() => { void controlAction("hold"); patch({ onHold: true, callState: "held" }); }, [controlAction]);
  const unhold = useCallback(() => { void controlAction("unhold"); patch({ onHold: false, callState: "active" }); }, [controlAction]);
  const transfer = useCallback((target: string) => { void controlAction("transfer", { destination: target }); }, [controlAction]);
  const answer = useCallback(async () => { await controlAction("answer"); return true; }, [controlAction]);
  const mute = useCallback(() => patch({ muted: true }), []);
  const unmute = useCallback(() => patch({ muted: false }), []);

  return useMemo(() => ({
    snap,
    loading,
    net,
    quality,
    placeCall,
    answeredElsewhere,
    dismissAnsweredElsewhere: () => setAnsweredElsewhere(null),
    call: (n: string) => placeCall(n),
    answer,
    hangup,
    mute,
    unmute,
    hold,
    unhold,
    sendDTMF: (_k: string) => {/* not supported via REST */},
    transfer,
    setAudioEl: (_el: HTMLAudioElement | null) => {/* no local audio in REST mode */},
    forceHandover: () => {/* no WebRTC session to hand over */},
  }), [snap, loading, net, quality, placeCall, answer, hangup, hold, unhold, mute, unmute, transfer, answeredElsewhere]);
}

// Silence unused import in strict TS if any consumer imports from here.
export type { PpSipSnapshot };
