// Planipret mobile — passive network monitor.
// Exposes a live snapshot of the connection (Wi-Fi / cellular / none), effective type,
// downlink, RTT and a coarse quality label used by the handover controller.
//
// Uses the Network Information API on the browser and @capacitor/network when running
// inside Capacitor (installed lazily to keep the web bundle small).

export type NetType = "wifi" | "cellular" | "ethernet" | "unknown" | "none";
export type NetQuality = "excellent" | "good" | "poor" | "offline";

export interface NetSnapshot {
  type: NetType;
  effectiveType?: string; // "4g" | "3g" | "2g" | "slow-2g"
  downlink?: number;      // Mbps
  rtt?: number;           // ms
  saveData?: boolean;
  quality: NetQuality;
  at: number;
}

type Listener = (s: NetSnapshot) => void;

function classify(type: NetType, effective?: string, downlink?: number, rtt?: number): NetQuality {
  if (type === "none") return "offline";
  if (rtt != null && rtt > 400) return "poor";
  if (downlink != null && downlink > 0 && downlink < 0.5) return "poor";
  if (effective === "2g" || effective === "slow-2g") return "poor";
  if (rtt != null && rtt > 150) return "good";
  if (downlink != null && downlink < 2) return "good";
  if (effective === "3g") return "good";
  return "excellent";
}

class NetworkMonitor {
  private listeners = new Set<Listener>();
  private snap: NetSnapshot = { type: "unknown", quality: "excellent", at: Date.now() };
  private started = false;
  private capUnsub: (() => void) | null = null;

  getSnapshot(): NetSnapshot { return this.snap; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    if (!this.started) this.start();
    return () => { this.listeners.delete(fn); };
  }

  private emit(patch: Partial<NetSnapshot>) {
    const merged: NetSnapshot = { ...this.snap, ...patch, at: Date.now() } as NetSnapshot;
    merged.quality = classify(merged.type, merged.effectiveType, merged.downlink, merged.rtt);
    this.snap = merged;
    this.listeners.forEach((l) => { try { l(merged); } catch {} });
  }

  private readBrowser(): Partial<NetSnapshot> {
    if (typeof navigator === "undefined") return {};
    const nav: any = navigator;
    const c = nav.connection || nav.mozConnection || nav.webkitConnection;
    const online = typeof nav.onLine === "boolean" ? nav.onLine : true;
    let type: NetType = "unknown";
    if (!online) type = "none";
    else if (c?.type === "wifi") type = "wifi";
    else if (c?.type === "cellular") type = "cellular";
    else if (c?.type === "ethernet") type = "ethernet";
    return {
      type,
      effectiveType: c?.effectiveType,
      downlink: c?.downlink,
      rtt: c?.rtt,
      saveData: c?.saveData,
    };
  }

  private start() {
    this.started = true;
    if (typeof window === "undefined") return;
    this.emit(this.readBrowser());

    const onChange = () => this.emit(this.readBrowser());
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    const nav: any = navigator;
    const c = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (c && typeof c.addEventListener === "function") {
      c.addEventListener("change", onChange);
    }

    // Best-effort Capacitor integration.
    (async () => {
      try {
        const w: any = window;
        if (!w?.Capacitor) return;
        const mod = await import(/* @vite-ignore */ "@capacitor/network").catch(() => null);
        if (!mod?.Network) return;
        const status = await mod.Network.getStatus();
        this.emit({
          type: status.connected
            ? (status.connectionType === "wifi" ? "wifi"
              : status.connectionType === "cellular" ? "cellular"
              : status.connectionType === "none" ? "none" : "unknown")
            : "none",
        });
        const handle = await mod.Network.addListener("networkStatusChange", (s: any) => {
          this.emit({
            type: s.connected
              ? (s.connectionType === "wifi" ? "wifi"
                : s.connectionType === "cellular" ? "cellular"
                : s.connectionType === "none" ? "none" : "unknown")
              : "none",
          });
        });
        this.capUnsub = () => { try { handle.remove?.(); } catch {} };
      } catch {}
    })();
  }
}

export const networkMonitor = new NetworkMonitor();
