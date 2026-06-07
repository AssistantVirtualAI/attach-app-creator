// JsSIP UA lifecycle manager + event emitter.
// Used by useSoftphone hook; do not import directly into components.
declare global { interface Window { JsSIP: any } }

export type SipStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "registered"
  | "disconnected"
  | "error";

export type CallState =
  | "idle"
  | "ringing-out"
  | "ringing-in"
  | "active"
  | "held"
  | "ended";

export interface SoftphoneSnapshot {
  status: SipStatus;
  callState: CallState;
  remoteIdentity: string;
  remoteNumber: string;
  errorCause?: string;
  muted: boolean;
  onHold: boolean;
  direction: "in" | "out" | null;
  startedAt: number | null;
}

export interface SoftphoneConfig {
  extension: string;
  displayName: string;
  sipDomain: string;
  wssUrl: string;
  wssUrls?: string[];
  password: string;
  mock: boolean;
}

type Listener = (snap: SoftphoneSnapshot) => void;

class JsSipProvider {
  private ua: any = null;
  private session: any = null;
  private config: SoftphoneConfig | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private mockTimers: ReturnType<typeof setTimeout>[] = [];
  private snap: SoftphoneSnapshot = {
    status: "idle",
    callState: "idle",
    remoteIdentity: "",
    remoteNumber: "",
    muted: false,
    onHold: false,
    direction: null,
    startedAt: null,
  };
  audioEl: HTMLAudioElement | null = null;

  private clearMockTimers() {
    this.mockTimers.forEach((t) => clearTimeout(t));
    this.mockTimers = [];
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.snap);
    return () => this.listeners.delete(fn);
  }

  private update(patch: Partial<SoftphoneSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l(this.snap));
  }

  getConfig() { return this.config; }
  getSnapshot() { return this.snap; }

  async init(cfg: SoftphoneConfig) {
    if (this.ua) this.stop();
    this.config = cfg;

    if (cfg.mock || !cfg.password) {
      // Mock mode — fake "registered" state
      this.update({ status: "registered" });
      return;
    }

    if (!window.JsSIP) {
      this.update({ status: "error", errorCause: "JsSIP not loaded" });
      return;
    }

    try {
      const fallbackUrls = Array.from(new Set([
        cfg.wssUrl,
        ...(cfg.wssUrls || []),
        'wss://lemtel.lemtel.tel:7443',
        'wss://pbxnode.lemtel.tel:7443',
      ].filter(Boolean)));
      const sockets = fallbackUrls.map((u) => new window.JsSIP.WebSocketInterface(u));
      const ua = new window.JsSIP.UA({
        sockets,
        uri: `sip:${cfg.extension}@${cfg.sipDomain}`,
        password: cfg.password,
        authorization_user: cfg.extension,
        realm: cfg.sipDomain,
        contact_uri: `sip:${cfg.extension}@${cfg.sipDomain};transport=wss`,
        register: true,
        session_timers: false,
        register_expires: 300,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 30,
        user_agent: "AVA Softphone 1.0",
      });

      ua.on("connected", () => this.update({ status: "connected" }));
      ua.on("disconnected", () => {
        this.update({ status: "disconnected" });
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => { try { ua.start(); } catch {} }, 5000);
      });
      ua.on("registered", () => this.update({ status: "registered" }));
      ua.on("registrationFailed", (e: any) => {
        this.update({ status: "error", errorCause: e?.cause || "registration failed" });
      });
      ua.on("newRTCSession", (e: any) => this.attachSession(e.session, e.originator));

      ua.start();
      this.ua = ua;
      this.update({ status: "connecting" });
    } catch (err: any) {
      this.update({ status: "error", errorCause: String(err?.message || err) });
    }
  }

  private attachSession(session: any, originator: string) {
    this.session = session;
    const incoming = originator === "remote";
    const remoteUri = session.remote_identity?.uri?.user || "";
    const remoteName = session.remote_identity?.display_name || remoteUri;

    this.update({
      callState: incoming ? "ringing-in" : "ringing-out",
      remoteIdentity: remoteName,
      remoteNumber: remoteUri,
      direction: incoming ? "in" : "out",
      muted: false,
      onHold: false,
    });

    session.on("progress", () => {
      if (!incoming) this.update({ callState: "ringing-out" });
    });
    session.on("confirmed", () => {
      this.update({ callState: "active", startedAt: Date.now() });
    });
    session.on("failed", (e: any) => {
      this.update({ callState: "ended", errorCause: e?.cause });
      setTimeout(() => this.resetCall(), 2500);
    });
    session.on("ended", () => {
      this.update({ callState: "ended" });
      setTimeout(() => this.resetCall(), 2500);
    });
    session.on("hold", () => this.update({ onHold: true, callState: "held" }));
    session.on("unhold", () => this.update({ onHold: false, callState: "active" }));
    session.on("muted", () => this.update({ muted: true }));
    session.on("unmuted", () => this.update({ muted: false }));

    const pc = session.connection;
    if (pc) {
      pc.addEventListener("track", (ev: any) => {
        if (this.audioEl && ev.streams[0]) {
          this.audioEl.srcObject = ev.streams[0];
          this.audioEl.play().catch(() => {});
        }
      });
    }
  }

  private resetCall() {
    this.session = null;
    this.update({
      callState: "idle",
      remoteIdentity: "",
      remoteNumber: "",
      direction: null,
      startedAt: null,
      muted: false,
      onHold: false,
    });
  }

  call(number: string) {
    if (!this.config) return;
    if (this.config.mock || !this.ua) {
      // Simulate a call in mock mode
      this.clearMockTimers();
      this.update({
        callState: "ringing-out",
        remoteIdentity: number,
        remoteNumber: number,
        direction: "out",
      });
      this.mockTimers.push(
        setTimeout(() => {
          // Only auto-connect if still ringing (user didn't hang up)
          if (this.snap.callState === "ringing-out") {
            this.update({ callState: "active", startedAt: Date.now() });
          }
        }, 1500)
      );
      return;
    }
    const target = `sip:${number}@${this.config.sipDomain}`;
    this.ua.call(target, { mediaConstraints: { audio: true, video: false } });
  }

  answer() {
    if (this.session) {
      this.session.answer({ mediaConstraints: { audio: true, video: false } });
    } else if (this.config?.mock) {
      this.clearMockTimers();
      this.update({ callState: "active", startedAt: Date.now() });
    }
  }

  hangup() {
    if (this.session) {
      try { this.session.terminate(); } catch {}
    }
    if (this.config?.mock || !this.session) {
      this.clearMockTimers();
      this.update({ callState: "ended", startedAt: null });
      this.mockTimers.push(setTimeout(() => this.resetCall(), 800));
    }
  }

  mute() { this.session?.mute({ audio: true }); if (this.config?.mock) this.update({ muted: true }); }
  unmute() { this.session?.unmute({ audio: true }); if (this.config?.mock) this.update({ muted: false }); }

  hold() { this.session?.hold(); if (this.config?.mock) this.update({ onHold: true, callState: "held" }); }
  unhold() { this.session?.unhold(); if (this.config?.mock) this.update({ onHold: false, callState: "active" }); }

  sendDTMF(key: string) {
    this.session?.sendDTMF(key, { duration: 100, interToneGap: 70 });
  }

  transfer(target: string) {
    if (!this.session || !this.config) return;
    this.session.refer(`sip:${target}@${this.config.sipDomain}`);
  }

  // Simulate incoming call (used by mock mode / test buttons)
  simulateIncoming(number: string) {
    this.update({
      callState: "ringing-in",
      remoteIdentity: number,
      remoteNumber: number,
      direction: "in",
    });
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.clearMockTimers();
    try { this.ua?.stop(); } catch {}
    this.ua = null;
    this.session = null;
    this.update({ status: "disconnected", callState: "idle", direction: null, startedAt: null });
  }
}

export const sipProvider = new JsSipProvider();
