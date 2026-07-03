// Planipret mobile — softphone hook aligned on the Lemtel engine.
//
// This is a thin adapter over `useSoftphone`. It re-uses the shared sipProvider so
// there is exactly one WebRTC/JsSIP stack in the app, and layers on top:
//   - Stronger microphone constraints (getAudioConstraints) with noise cancellation
//     modes (`pp_nc_mode`) applied via a `navigator.mediaDevices.getUserMedia` proxy
//     scoped to the current call.
//   - Auto network handover (Wi-Fi ↔ LTE) via handoverController.
//   - Live call-quality sampling via callQualitySampler.
//   - Fallback to `ns-calls action:start` (PBX click-to-call) when WebRTC is not
//     registered (matches the "both, with fallback" outbound policy).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSoftphone } from "@/hooks/useSoftphone";
import { supabase } from "@/integrations/supabase/client";
import { networkMonitor, type NetSnapshot } from "@/lib/planipret/net/networkMonitor";
import { handoverController } from "@/lib/planipret/net/handoverController";
import { callQualitySampler, type CallQualitySnapshot } from "@/lib/planipret/audio/callQualitySampler";
import { getAudioConstraints, type NCMode } from "@/lib/planipret/audio/audioConstraints";

let gumProxyInstalled = false;
let gumOriginal: typeof navigator.mediaDevices.getUserMedia | null = null;

function readNCMode(): NCMode {
  try { return (localStorage.getItem("pp_nc_mode") as NCMode) || "standard"; }
  catch { return "standard"; }
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
      const wantsAudioOnly = constraints
        && constraints.audio
        && !constraints.video;
      if (wantsAudioOnly) {
        const cfg = getAudioConstraints(readNCMode());
        const merged: MediaStreamConstraints = {
          audio: { ...(cfg.audio as any), ...(typeof constraints.audio === "object" ? constraints.audio : {}) },
          video: false,
        };
        return await gumOriginal!(merged);
      }
    } catch {
      // fall through to original
    }
    return gumOriginal!(constraints);
  };
  gumProxyInstalled = true;
}

export type OutboundResult =
  | { via: "webrtc"; ok: true }
  | { via: "pbx"; ok: true }
  | { via: "none"; ok: false; error: string };

export function useMplanipretSoftphone() {
  const sp = useSoftphone();
  const [net, setNet] = useState<NetSnapshot>(networkMonitor.getSnapshot());
  const [quality, setQuality] = useState<CallQualitySnapshot | null>(null);

  // Boot: audio proxy + network monitor + handover.
  useEffect(() => {
    ensureGumProxy();
    handoverController.start();
    const un = networkMonitor.subscribe(setNet);
    return () => { un(); };
  }, []);

  // Live call quality only while a call is active.
  useEffect(() => {
    const active = sp.snap.callState === "active" || sp.snap.callState === "held";
    if (!active) { setQuality(null); return; }
    const un = callQualitySampler.subscribe(setQuality);
    return () => { un(); };
  }, [sp.snap.callState]);

  const registered = sp.snap.status === "registered";
  const callViaWebRTC = useCallback((n: string) => sp.call(n), [sp]);

  const callViaPBX = useCallback(async (destination: string) => {
    const { data, error } = await supabase.functions.invoke("ns-calls", { body: { action: "start", destination } });
    if (error || (data as any)?.success === false) {
      return { via: "none" as const, ok: false, error: (data as any)?.error ?? error?.message ?? "PBX call failed" };
    }
    return { via: "pbx" as const, ok: true };
  }, []);

  const placeCall = useCallback(async (destination: string): Promise<OutboundResult> => {
    if (!destination) return { via: "none", ok: false, error: "empty destination" };
    // WebRTC first, PBX fallback.
    if (registered) {
      try { callViaWebRTC(destination); return { via: "webrtc", ok: true }; }
      catch { /* fall through to PBX */ }
    }
    return await callViaPBX(destination);
  }, [registered, callViaWebRTC, callViaPBX]);

  return useMemo(() => ({
    ...sp,
    net,
    quality,
    placeCall,
    forceHandover: () => handoverController.forceHandover(),
  }), [sp, net, quality, placeCall]);
}
