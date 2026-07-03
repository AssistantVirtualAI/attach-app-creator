// Planipret mobile — softphone hook bound to the NS-API PBX.
//
// This is fully independent from the Lemtel softphone: registration uses the
// NS-API SIP credentials returned by the `ns-resolve-sip-credentials` edge
// function, and RTP flows through NS-API. Layered on top:
//   - Stronger microphone constraints (getAudioConstraints) with a
//     `navigator.mediaDevices.getUserMedia` proxy scoped to Planipret calls.
//   - Auto network handover (Wi-Fi ↔ LTE) via handoverController.
//   - Live call-quality sampling via callQualitySampler.
//   - Outbound fallback to `ns-calls action:start` when WebRTC is not registered
//     ("both, with fallback" policy).

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ppSipProvider, type PpSipSnapshot } from "@/lib/planipret/sip/ppSipProvider";
import { networkMonitor, type NetSample } from "@/lib/planipret/network/networkMonitor";
import { handoverController } from "@/lib/planipret/net/handoverController";
import { callQualitySampler, type CallQualitySnapshot } from "@/lib/planipret/audio/callQualitySampler";
import { getAudioConstraints, type NCMode } from "@/lib/planipret/audio/audioConstraints";
import { ensureMicPermission, type MicPermissionState } from "@/lib/planipret/audio/micPermission";

let gumProxyInstalled = false;
let gumOriginal: typeof navigator.mediaDevices.getUserMedia | null = null;

function readNCMode(): NCMode {
  try { return (localStorage.getItem("pp_nc_mode") as NCMode) || "standard"; }
  catch { return "standard"; }
}
function readNCEnabled(): boolean {
  try { const v = localStorage.getItem("pp_nc_enabled"); return v === null ? true : v === "1"; }
  catch { return true; }
}

/** Install a one-time getUserMedia proxy that upgrades audio-only requests with
 *  the Planipret NC constraints. Idempotent and safe to call multiple times. */
function ensureGumProxy() {
  if (gumProxyInstalled || typeof navigator === "undefined") return;
  const md: any = navigator.mediaDevices;
  if (!md?.getUserMedia) return;
  gumOriginal = md.getUserMedia.bind(md);
  md.getUserMedia = async (constraints: MediaStreamConstraints) => {
    try {
      const wantsAudioOnly = constraints && constraints.audio && !constraints.video;
      if (wantsAudioOnly && readNCEnabled()) {
        const cfg = getAudioConstraints(readNCMode());
        const merged: MediaStreamConstraints = {
          audio: { ...(cfg.audio as any), ...(typeof constraints.audio === "object" ? constraints.audio : {}) },
          video: false,
        };
        return await gumOriginal!(merged);
      }
    } catch { /* fall through */ }
    return gumOriginal!(constraints);
  };
  gumProxyInstalled = true;
}

export type OutboundResult =
  | { via: "webrtc"; ok: true }
  | { via: "pbx"; ok: true }
  | { via: "none"; ok: false; error: string; micState?: MicPermissionState };

export function useMplanipretSoftphone() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<PpSipSnapshot>(() => ppSipProvider.getSnapshot());
  const [loading, setLoading] = useState(false);
  const [net, setNet] = useState<NetSample>(networkMonitor.current());
  const [quality, setQuality] = useState<CallQualitySnapshot | null>(null);

  // Subscribe to the SIP snapshot.
  useEffect(() => ppSipProvider.subscribe(setSnap), []);

  // Boot audio proxy + network monitor + handover once.
  useEffect(() => {
    ensureGumProxy();
    handoverController.start();
    const un = networkMonitor.subscribe(setNet);
    return () => { un(); };
  }, []);

  // Resolve NS-API SIP credentials and register the softphone per user.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ns-resolve-sip-credentials", { body: { client_type: "mobile" } });
        if (cancelled) return;
        if (error || !data || (data as any)?.error) return;
        const d = data as any;
        await ppSipProvider.init({
          extension: String(d.sip_extension),
          sipUsername: String(d.sip_username || d.sip_extension),
          sipDomain: String(d.sip_domain),
          sipProxy: d.sip_proxy,
          wssUrl: String(d.sip_wss_url),
          wssUrls: Array.isArray(d.sip_wss_urls) ? d.sip_wss_urls : undefined,
          password: String(d.sip_password),
          displayName: String(d.sip_extension),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Live call quality only while a call is active.
  useEffect(() => {
    const active = snap.callState === "active" || snap.callState === "held";
    if (!active) { setQuality(null); return; }
    const un = callQualitySampler.subscribe(setQuality);
    return () => { un(); };
  }, [snap.callState]);

  const registered = snap.status === "registered";

  const callViaPBX = useCallback(async (destination: string): Promise<OutboundResult> => {
    const { data, error } = await supabase.functions.invoke("ns-calls", { body: { action: "start", destination } });
    if (error || (data as any)?.success === false) {
      return { via: "none", ok: false, error: (data as any)?.error ?? error?.message ?? "PBX call failed" };
    }
    return { via: "pbx", ok: true };
  }, []);

  const placeCall = useCallback(async (destination: string): Promise<OutboundResult> => {
    if (!destination) return { via: "none", ok: false, error: "empty destination" };
    // Ask for the mic BEFORE dialing so the user sees a clear prompt/fallback.
    const mic = await ensureMicPermission();
    if (mic.state !== "granted") {
      // Stop any temporary probe stream — real call will re-acquire via the SIP layer.
      try { mic.stream?.getTracks().forEach((tr) => tr.stop()); } catch {}
      return { via: "none", ok: false, error: mic.error ?? "microphone unavailable", micState: mic.state };
    }
    try { mic.stream?.getTracks().forEach((tr) => tr.stop()); } catch {}
    if (registered) {
      try { await ppSipProvider.call(destination); return { via: "webrtc", ok: true }; }
      catch { /* fall through */ }
    }
    return await callViaPBX(destination);
  }, [registered, callViaPBX]);

  return useMemo(() => ({
    snap,
    loading,
    net,
    quality,
    placeCall,
    call: (n: string) => ppSipProvider.call(n),
    answer: () => ppSipProvider.answer(),
    hangup: () => ppSipProvider.hangup(),
    mute: () => ppSipProvider.mute(),
    unmute: () => ppSipProvider.unmute(),
    hold: () => ppSipProvider.hold(),
    unhold: () => ppSipProvider.unhold(),
    sendDTMF: (k: string) => ppSipProvider.sendDTMF(k),
    transfer: (t: string) => ppSipProvider.transfer(t),
    setAudioEl: (el: HTMLAudioElement | null) => { ppSipProvider.audioEl = el; },
    forceHandover: () => handoverController.forceHandover(),
  }), [snap, loading, net, quality, placeCall]);
}
