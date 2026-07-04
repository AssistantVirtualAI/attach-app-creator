// Planipret mobile — handover controller.
// Reacts to network changes (Wi-Fi ↔ LTE ↔ none) via the shared networkMonitor and
// triggers either a fast SIP re-registration when idle, or an ICE restart when a call
// is active, so RTP resumes on the new interface without dropping the call.

import { networkMonitor, type NetSample } from "@/lib/planipret/network/networkMonitor";
import { ppSipProvider } from "@/lib/planipret/sip/ppSipProvider";

export type HandoverEvent =
  | { kind: "network-change"; from: string; to: string; at: number }
  | { kind: "quality-drop"; from: string; to: string; at: number }
  | { kind: "ice-restart"; at: number; ok: boolean; reason: "network-change" | "quality-drop" }
  | { kind: "reregister"; at: number };

type Listener = (e: HandoverEvent) => void;

class HandoverController {
  private listeners = new Set<Listener>();
  private lastType: string = "unknown";
  private lastQuality: NetSample["quality"] = "good";
  private started = false;
  private unsubNet: (() => void) | null = null;
  private inFlight = false;
  private lastActionAt = 0;

  async start() {
    if (this.started) return;
    this.started = true;
    try { await networkMonitor.init(); } catch {}
    this.unsubNet = networkMonitor.subscribe((s) => this.onNet(s));
  }
  stop() {
    this.started = false;
    this.unsubNet?.();
    this.unsubNet = null;
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  private emit(e: HandoverEvent) { this.listeners.forEach((l) => { try { l(e); } catch {} }); }

  private autoEnabled(): boolean {
    try { const v = localStorage.getItem("pp_auto_handover"); return v === null ? true : v === "1"; }
    catch { return true; }
  }

  private async runHandover(reason: "network-change" | "quality-drop") {
    if (this.inFlight) return;
    if (!this.autoEnabled()) return;
    this.inFlight = true;
    this.lastActionAt = Date.now();
    try {
      if (ppSipProvider.hasActiveCall()) {
        const ok = await ppSipProvider.iceRestart();
        this.emit({ kind: "ice-restart", at: Date.now(), ok, reason });
      } else if (reason === "network-change") {
        await ppSipProvider.forceReregister();
        this.emit({ kind: "reregister", at: Date.now() });
      }
    } finally {
      this.inFlight = false;
    }
  }

  private async onNet(s: NetSample) {
    const prev = this.lastType;
    const prevQ = this.lastQuality;
    this.lastType = s.type;
    this.lastQuality = s.quality;

    // Interface change (Wi-Fi ↔ LTE ↔ none): trigger handover.
    if (prev !== "unknown" && prev !== s.type && Date.now() - this.lastActionAt > 1500) {
      this.emit({ kind: "network-change", from: prev, to: s.type, at: Date.now() });
      if (s.connected) await this.runHandover("network-change");
      return;
    }

    // Quality dropped to poor while on a call: try ICE restart to pick the best path.
    if (
      s.connected &&
      ppSipProvider.hasActiveCall() &&
      prevQ !== "poor" &&
      s.quality === "poor" &&
      Date.now() - this.lastActionAt > 5000
    ) {
      this.emit({ kind: "quality-drop", from: prevQ, to: s.quality, at: Date.now() });
      await this.runHandover("quality-drop");
    }
  }

  async forceHandover(): Promise<boolean> {
    if (ppSipProvider.hasActiveCall()) return ppSipProvider.iceRestart();
    await ppSipProvider.forceReregister();
    return true;
  }
}

export const handoverController = new HandoverController();
