// Planipret mobile — handover controller.
// Reacts to network changes (Wi-Fi ↔ LTE ↔ none) via the shared networkMonitor and
// triggers either a fast SIP re-registration when idle, or an ICE restart when a call
// is active, so RTP resumes on the new interface without dropping the call.

import { networkMonitor, type NetSample } from "@/lib/planipret/network/networkMonitor";
import { ppSipProvider } from "@/lib/planipret/sip/ppSipProvider";

export type HandoverEvent =
  | { kind: "network-change"; from: string; to: string; at: number }
  | { kind: "ice-restart"; at: number; ok: boolean }
  | { kind: "reregister"; at: number };

type Listener = (e: HandoverEvent) => void;

class HandoverController {
  private listeners = new Set<Listener>();
  private lastType: string = "unknown";
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

  private async onNet(s: NetSample) {
    const prev = this.lastType;
    this.lastType = s.type;
    if (prev === "unknown") return;
    if (prev === s.type) return;
    if (Date.now() - this.lastActionAt < 1500) return;
    this.lastActionAt = Date.now();
    this.emit({ kind: "network-change", from: prev, to: s.type, at: Date.now() });
    if (!s.connected) return;
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      if (sipProvider.hasActiveCall()) {
        const ok = await sipProvider.iceRestart();
        this.emit({ kind: "ice-restart", at: Date.now(), ok });
      } else {
        await sipProvider.forceReregister();
        this.emit({ kind: "reregister", at: Date.now() });
      }
    } finally {
      this.inFlight = false;
    }
  }

  async forceHandover(): Promise<boolean> {
    if (sipProvider.hasActiveCall()) return sipProvider.iceRestart();
    await sipProvider.forceReregister();
    return true;
  }
}

export const handoverController = new HandoverController();
