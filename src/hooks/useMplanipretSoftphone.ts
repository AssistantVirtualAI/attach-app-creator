// Planipret mobile/web softphone hook.
//
// Two audio paths:
//   1. SIP.js UserAgent registering as `<ext>_web` over WSS (browser WebRTC audio).
//   2. REST fallback via `pp-ns-calls` (NetSapiens dials the mobile device).
//
// Whichever path is active, we expose a UNIFIED `snap` so PpActiveCallScreen
// (used on web AND mobile) renders the full-screen in-call UI with mute /
// hold / transfer / keypad / hangup. REST-path actions are routed to
// `pp-ns-calls`; SIP-path actions go through ppSipProvider.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { networkMonitor, type NetSample } from "@/lib/planipret/network/networkMonitor";
import { ppSipProvider, type PpSipSnapshot } from "@/lib/planipret/sip/ppSipProvider";
import type { CallQualitySnapshot } from "@/lib/planipret/audio/callQualitySampler";

type AnsweredBy = "mobile" | "widget" | "web" | null;

export type OutboundResult =
  | { via: "sip" | "pbx"; ok: true }
  | { via: "none"; ok: false; error: string };

type RestCall = {
  id: string;
  direction: "in" | "out";
  other: string;
  startedAt: number;
  status: "ringing-out" | "active" | "held";
  muted: boolean;
};

export function useMplanipretSoftphone() {
  const { user } = useAuth();
  const [sipSnap, setSipSnap] = useState<PpSipSnapshot>(() => ppSipProvider.getSnapshot());
  const [loading, setLoading] = useState(false);
  const [net, setNet] = useState<NetSample>(networkMonitor.current());
  const [quality] = useState<CallQualitySnapshot | null>(null);
  const [answeredElsewhere, setAnsweredElsewhere] = useState<AnsweredBy>(null);
  const [restCall, setRestCall] = useState<RestCall | null>(null);
  const sipReadyRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const un = networkMonitor.subscribe(setNet);
    return () => { un(); };
  }, []);

  useEffect(() => ppSipProvider.subscribe(setSipSnap), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ns-resolve-sip-credentials", {
          body: { client_type: "web" },
        });
        if (cancelled) return;
        const d = data as any;
        if (error || !d?.ok || !d?.sip_password || !d?.sip_ws_url) {
          console.warn("[softphone] SIP creds unavailable, staying on REST", d?.error, error?.message);
          return;
        }
        await ppSipProvider.init({
          wsUrl: d.sip_ws_url,
          domain: d.sip_domain,
          username: d.sip_username,
          authUser: d.sip_auth_user ?? d.sip_username,
          password: d.sip_password,
          extension: String(d.sip_extension),
          displayName: user.email ?? undefined,
        });
        sipReadyRef.current = true;
      } catch (e) {
        console.warn("[softphone] SIP init error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => () => { void ppSipProvider.stop(); }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const pollActiveCalls = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("pp-ns-calls", { body: { action: "list" } });
      const list: any[] = Array.isArray(data) ? data : Array.isArray((data as any)?.calls) ? (data as any).calls : [];
      const raw = list[0];
      if (!raw) {
        setRestCall(null);
        stopPolling();
        return;
      }
      const id = raw["call-id"] ?? raw.call_id ?? raw.id ?? "";
      const direction: "in" | "out" = /out/i.test(raw.direction ?? "") ? "out" : "in";
      const other = raw.remote_party ?? raw.remote_number ?? raw.other_party
        ?? (direction === "out" ? raw.to_number : raw.from_number) ?? raw.destination ?? "—";
      const status: RestCall["status"] = /hold/i.test(raw.state ?? raw.status ?? "") ? "held"
        : /ring/i.test(raw.state ?? raw.status ?? "") ? "ringing-out" : "active";
      const startedAtIso = raw.answered_at ?? raw.started_at ?? raw.time_start;
      const startedAt = startedAtIso ? new Date(startedAtIso).getTime() : Date.now();
      setRestCall((prev) => ({
        id: String(id),
        direction,
        other: String(other),
        startedAt: prev?.startedAt ?? startedAt,
        status,
        muted: prev?.muted ?? false,
      }));
    } catch { /* transient */ }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => { void pollActiveCalls(); }, 2000);
    void pollActiveCalls();
  }, [pollActiveCalls]);

  const placeCall = useCallback(async (destination: string): Promise<OutboundResult> => {
    if (!destination) return { via: "none", ok: false, error: "empty destination" };

    if (sipReadyRef.current && sipSnap.status === "registered") {
      try {
        await ppSipProvider.call(destination);
        return { via: "sip", ok: true };
      } catch (e: any) {
        console.warn("[softphone] SIP call failed, falling back to REST", e);
      }
    }

    // Optimistic REST call state so PpActiveCallScreen opens immediately
    setRestCall({
      id: `pending-${Date.now()}`,
      direction: "out",
      other: destination,
      startedAt: Date.now(),
      status: "ringing-out",
      muted: false,
    });

    const { data, error } = await supabase.functions.invoke("pp-ns-calls", {
      body: { action: "start", to_number: destination, client_type: "mobile" },
    });
    const d = data as any;
    if (error || d?.success === false || d?.error) {
      const msg = d?.error ?? error?.message ?? "Call failed";
      setRestCall(null);
      return { via: "none", ok: false, error: msg };
    }
    startPolling();
    return { via: "pbx", ok: true };
  }, [sipSnap.status, startPolling]);

  // ---------- Unified snapshot exposed to PpActiveCallScreen ----------
  const snap: PpSipSnapshot = useMemo(() => {
    const sipActive = sipSnap.callState !== "idle" && sipSnap.callState !== "ended";
    if (sipActive || !restCall) return sipSnap;
    return {
      ...sipSnap,
      callState: restCall.status,
      remoteIdentity: restCall.other,
      remoteNumber: restCall.other,
      direction: restCall.direction,
      callId: restCall.id,
      muted: restCall.muted,
      onHold: restCall.status === "held",
      startedAt: restCall.startedAt,
    };
  }, [sipSnap, restCall]);

  const restMode = !!restCall && (sipSnap.callState === "idle" || sipSnap.callState === "ended");

  const invokeRest = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (!restCall) return;
    await supabase.functions.invoke("pp-ns-calls", { body: { action, call_id: restCall.id, ...extra } });
  }, [restCall]);

  const hangup = useCallback(() => {
    if (restMode) {
      void invokeRest("disconnect");
      setRestCall(null);
      stopPolling();
      return;
    }
    ppSipProvider.hangup();
  }, [restMode, invokeRest, stopPolling]);

  const answer = useCallback(async () => { await ppSipProvider.answer(); return true; }, []);

  const mute = useCallback(() => {
    if (restMode) { void invokeRest("mute", { muted: true }); setRestCall((c) => c ? { ...c, muted: true } : c); return; }
    ppSipProvider.mute();
  }, [restMode, invokeRest]);

  const unmute = useCallback(() => {
    if (restMode) { void invokeRest("mute", { muted: false }); setRestCall((c) => c ? { ...c, muted: false } : c); return; }
    ppSipProvider.unmute();
  }, [restMode, invokeRest]);

  const hold = useCallback(() => {
    if (restMode) { void invokeRest("hold"); setRestCall((c) => c ? { ...c, status: "held" } : c); return; }
    ppSipProvider.hold();
  }, [restMode, invokeRest]);

  const unhold = useCallback(() => {
    if (restMode) { void invokeRest("unhold"); setRestCall((c) => c ? { ...c, status: "active" } : c); return; }
    ppSipProvider.unhold();
  }, [restMode, invokeRest]);

  const transfer = useCallback((target: string) => {
    if (restMode) { void invokeRest("transfer", { destination: target, target }); return; }
    ppSipProvider.transfer(target);
  }, [restMode, invokeRest]);

  const sendDTMF = useCallback((k: string) => {
    if (restMode) { void invokeRest("dtmf", { digit: k }); return; }
    ppSipProvider.sendDTMF(k);
  }, [restMode, invokeRest]);

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
    sendDTMF,
    transfer,
    setAudioEl: (el: HTMLAudioElement | null) => { ppSipProvider.audioEl = el; },
    forceHandover: () => {/* handled by NS */},
  }), [snap, loading, net, quality, placeCall, answer, hangup, hold, unhold, mute, unmute, transfer, sendDTMF, answeredElsewhere]);
}

export type { PpSipSnapshot };
