// Planipret mobile/web softphone hook.
//
// Two audio paths:
//   1. SIP.js UserAgent registering as `<ext>_web` over WSS (browser WebRTC audio).
//   2. REST fallback via `pp-ns-calls` (NetSapiens dials the mobile device).
//
// The SIP path is preferred; REST is used only if SIP init fails or a `mobile`
// call is explicitly requested.

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

export function useMplanipretSoftphone() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<PpSipSnapshot>(() => ppSipProvider.getSnapshot());
  const [loading, setLoading] = useState(false);
  const [net, setNet] = useState<NetSample>(networkMonitor.current());
  const [quality] = useState<CallQualitySnapshot | null>(null);
  const [answeredElsewhere, setAnsweredElsewhere] = useState<AnsweredBy>(null);
  const sipReadyRef = useRef(false);
  const activeCallRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const un = networkMonitor.subscribe(setNet);
    return () => { un(); };
  }, []);

  useEffect(() => ppSipProvider.subscribe(setSnap), []);

  // Bootstrap the SIP.js UA once we have an authenticated user.
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
      activeCallRef.current = list[0] || null;
      if (!activeCallRef.current) stopPolling();
    } catch { /* transient */ }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => { void pollActiveCalls(); }, 2000);
    void pollActiveCalls();
  }, [pollActiveCalls]);

  const placeCall = useCallback(async (destination: string): Promise<OutboundResult> => {
    if (!destination) return { via: "none", ok: false, error: "empty destination" };

    // Preferred path: SIP.js from the browser (audio in the tab).
    if (sipReadyRef.current && snap.status === "registered") {
      try {
        await ppSipProvider.call(destination);
        return { via: "sip", ok: true };
      } catch (e: any) {
        console.warn("[softphone] SIP call failed, falling back to REST", e);
      }
    }

    // Fallback: REST — NetSapiens rings the mobile device.
    const { data, error } = await supabase.functions.invoke("pp-ns-calls", {
      body: { action: "start", to_number: destination, client_type: "mobile" },
    });
    const d = data as any;
    if (error || d?.success === false || d?.error) {
      const msg = d?.error ?? error?.message ?? "Call failed";
      return { via: "none", ok: false, error: msg };
    }
    startPolling();
    return { via: "pbx", ok: true };
  }, [snap.status, startPolling]);

  const hangup = useCallback(() => {
    ppSipProvider.hangup();
    if (activeCallRef.current) {
      const callId = activeCallRef.current?.["call-id"] ?? snap.callId;
      if (callId) void supabase.functions.invoke("pp-ns-calls", { body: { action: "disconnect", call_id: callId } });
    }
    stopPolling();
  }, [snap.callId, stopPolling]);

  const answer = useCallback(async () => { await ppSipProvider.answer(); return true; }, []);
  const mute = useCallback(() => ppSipProvider.mute(), []);
  const unmute = useCallback(() => ppSipProvider.unmute(), []);
  const hold = useCallback(() => ppSipProvider.hold(), []);
  const unhold = useCallback(() => ppSipProvider.unhold(), []);
  const transfer = useCallback((target: string) => ppSipProvider.transfer(target), []);
  const sendDTMF = useCallback((k: string) => ppSipProvider.sendDTMF(k), []);

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
