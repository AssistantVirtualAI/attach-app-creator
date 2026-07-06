// Planipret mobile — dedicated JsSIP UA bound to the NS-API PBX.
//
// This is intentionally independent from the Lemtel `sipProvider` in
// `@/lib/softphone/jssipProvider` so /mplanipret talks only to the NS-API
// (NetSapiens) telephony backend. It re-uses the JsSIP browser library and
// wires the same media pipeline: NC-aware getUserMedia, RTCPeerConnection
// stats sampling, and ICE-restart support for Wi-Fi ↔ LTE handover.

import JsSIP from "jssip";

export type PpSipStatus = "idle" | "connecting" | "connected" | "registered" | "disconnected" | "error";
export type PpCallState = "idle" | "ringing-out" | "ringing-in" | "active" | "held" | "ended";

export interface PpSipConfig {
  extension: string;
  sipUsername: string;
  sipDomain: string;
  sipProxy?: string;
  wssUrl: string;
  wssUrls?: string[];
  password: string;
  displayName?: string;
}

export interface PpSipSnapshot {
  status: PpSipStatus;
  callState: PpCallState;
  remoteIdentity: string;
  remoteNumber: string;
  direction: "in" | "out" | null;
  callId: string;
  muted: boolean;
  onHold: boolean;
  startedAt: number | null;
  errorCause?: string;
  lastRegistrationAt: number | null;
}


type Listener = (s: PpSipSnapshot) => void;

function splitSipIdentity(username: string, fallbackDomain: string) {
  const raw = String(username || "").trim();
  const at = raw.indexOf("@");
  const authUser = at > -1 ? raw.slice(0, at) : raw;
  const usernameDomain = at > -1 ? raw.slice(at + 1) : "";
  return {
    authUser,
    domain: usernameDomain || fallbackDomain,
  };
}

class PpSipProvider {
  private ua: any = null;
  private session: any = null;
  private cfg: PpSipConfig | null = null;
  private listeners = new Set<Listener>();
  private snap: PpSipSnapshot = {
    status: "idle",
    callState: "idle",
    remoteIdentity: "",
    remoteNumber: "",
    direction: null,
    callId: "",
    muted: false,
    onHold: false,
    startedAt: null,
    lastRegistrationAt: null,
  };

  audioEl: HTMLAudioElement | null = null;
  private lastSig = "";

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    return () => { this.listeners.delete(fn); };
  }
  getSnapshot(): PpSipSnapshot { return this.snap; }
  getConfig(): PpSipConfig | null { return this.cfg; }

  private update(patch: Partial<PpSipSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => { try { l(this.snap); } catch {} });
  }

  private log(level: "info" | "warn" | "error", msg: string, detail?: any) {
    const fn = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    // eslint-disable-next-line no-console
    (console as any)[fn](`[pp-sip] ${msg}`, detail ?? "");
  }

  private emitRegistration(registered: boolean, detail: Record<string, unknown> = {}) {
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(new CustomEvent("pp:sip-registered", {
        detail: { registered, extension: this.cfg?.extension, ...detail },
      }));
    } catch {}
  }

  private async probeWssCandidates(urls: string[], timeoutMs = 3000): Promise<string[]> {
    const test = (url: string) => new Promise<string | null>((resolve) => {
      let done = false;
      const finish = (ok: boolean) => { if (done) return; done = true; try { ws.close(); } catch {} resolve(ok ? url : null); };
      let ws: WebSocket;
      try { ws = new WebSocket(url, ["sip"]); } catch { resolve(null); return; }
      ws.onopen = () => finish(true);
      ws.onerror = () => finish(false);
      ws.onclose = () => finish(false);
      setTimeout(() => finish(false), timeoutMs);
    });
    const results = await Promise.all(urls.map(test));
    return results.filter((u): u is string => !!u);
  }

  async init(cfg: PpSipConfig) {

    if (!cfg.extension || !cfg.sipDomain || !cfg.wssUrl || !cfg.password) {
      this.update({ status: "error", errorCause: "invalid_config" });
      return;
    }
    const sig = `${cfg.extension}|${cfg.sipDomain}|${cfg.wssUrl}|${cfg.password}`;
    if (this.ua && sig === this.lastSig && (this.snap.status === "registered" || this.snap.status === "connected")) {
      return;
    }
    if (this.ua) this.stop();
    this.cfg = cfg;
    this.lastSig = sig;
    this.update({ status: "connecting", errorCause: undefined });

    try {
      const rawUrls = Array.from(new Set([cfg.wssUrl, ...(cfg.wssUrls || [])].filter(Boolean))) as string[];
      const urls = await this.probeWssCandidates(rawUrls);
      if (urls.length === 0) {
        this.log("error", "no reachable WSS endpoint", { candidates: rawUrls });
        this.update({ status: "error", errorCause: "no_wss_reachable" });
        return;
      }
      this.log("info", "wss reachable", urls);
      const sip = splitSipIdentity(cfg.sipUsername || cfg.extension, cfg.sipDomain);
      const uriUser = String(cfg.extension).trim();
      const sockets = urls.map((u) => new (JsSIP as any).WebSocketInterface(u));

      const ua = new (JsSIP as any).UA({
        sockets,
        // The SIP Address-of-Record must remain the broker extension. The
        // dedicated mobile device id is only the auth username; using it as the
        // URI user makes NetSapiens try to register a non-existent user/device
        // directly and leaves the app stuck offline.
        uri: `sip:${uriUser}@${sip.domain}`,
        password: cfg.password,
        authorization_user: sip.authUser || uriUser,
        realm: sip.domain,
        contact_uri: `sip:${uriUser}@${sip.domain};transport=wss;q=1.0`,
        register: true,
        session_timers: false,
        register_expires: 300,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 30,
        user_agent: "Planipret Softphone 1.0",
      });

      this.log("info", "register init", {
        uri: `sip:${uriUser}@${sip.domain}`,
        authorization_user: sip.authUser || uriUser,
        wss: urls,
      });
      ua.on("connecting", () => { this.log("info", "ws connecting"); this.update({ status: "connecting" }); });
      ua.on("connected", () => { this.log("info", "ws connected"); this.update({ status: "connected" }); });
      ua.on("disconnected", (e: any) => { this.log("warn", "ws disconnected", { code: e?.code, reason: e?.reason, error: e?.error?.message }); this.update({ status: "disconnected" }); this.emitRegistration(false, { reason: "disconnected" }); });
      ua.on("registered", () => { this.log("info", "registered"); this.update({ status: "registered", errorCause: undefined, lastRegistrationAt: Date.now() }); this.emitRegistration(true); });
      ua.on("unregistered", () => this.log("warn", "unregistered"));
      ua.on("registrationFailed", (e: any) => {
        const code = e?.response?.status_code;
        const reason = e?.response?.reason_phrase;
        const cause = [code, reason, e?.cause].filter(Boolean).join(" ") || "registration_failed";
        this.log("error", `registration failed: ${cause}`, {
          status_code: code,
          reason_phrase: reason,
          cause: e?.cause,
          authorization_user: sip.authUser || uriUser,
          uri: `sip:${uriUser}@${sip.domain}`,
        });
        this.update({ status: "error", errorCause: cause });
        this.emitRegistration(false, { reason: cause });
      });
      ua.on("newRTCSession", (e: any) => this.attachSession(e.session, e.originator));

      ua.start();
      this.ua = ua;
    } catch (err: any) {
      const msg = String(err?.message || err);
      this.log("error", `UA init failed: ${msg}`);
      this.update({ status: "error", errorCause: msg });
    }
  }

  private attachSession(session: any, originator: string) {
    this.session = session;
    const incoming = originator === "remote";
    const remoteUri = session.remote_identity?.uri?.user || "";
    const remoteName = session.remote_identity?.display_name || remoteUri;
    // SIP Call-ID is the shared identifier between mobile and widget for the
    // same call — used to coordinate collision handling via Supabase.
    const callId: string = session?.request?.call_id
      || session?.request?.getHeader?.("Call-ID")
      || session?.id
      || "";
    this.update({
      callState: incoming ? "ringing-in" : "ringing-out",
      remoteIdentity: remoteName,
      remoteNumber: remoteUri,
      direction: incoming ? "in" : "out",
      callId,
      muted: false,
      onHold: false,
    });

    session.on("progress", () => { if (!incoming) this.update({ callState: "ringing-out" }); });
    session.on("confirmed", () => this.update({ callState: "active", startedAt: Date.now() }));
    session.on("failed", (e: any) => {
      this.update({ callState: "ended", errorCause: e?.cause || "failed" });
      setTimeout(() => this.resetCall(), 2000);
    });
    session.on("ended", () => {
      this.update({ callState: "ended" });
      setTimeout(() => this.resetCall(), 2000);
    });
    session.on("hold", () => this.update({ onHold: true, callState: "held" }));
    session.on("unhold", () => this.update({ onHold: false, callState: "active" }));
    session.on("muted", () => this.update({ muted: true }));
    session.on("unmuted", () => this.update({ muted: false }));

    const pc: RTCPeerConnection | undefined = session.connection;
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
      callId: "",
      startedAt: null,
      muted: false,
      onHold: false,
    });
  }


  async call(number: string) {
    if (!this.cfg || !this.ua) return;
    this.update({ callState: "ringing-out", remoteIdentity: number, remoteNumber: number, direction: "out", errorCause: undefined });
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const target = `sip:${number}@${this.cfg.sipDomain}`;
      this.ua.call(target, {
        mediaStream,
        mediaConstraints: { audio: true, video: false },
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      });
    } catch (err: any) {
      const msg = String(err?.message || err);
      this.log("error", `call failed: ${msg}`);
      this.update({ callState: "ended", errorCause: msg });
      setTimeout(() => this.resetCall(), 1500);
    }
  }

  answer() {
    if (!this.session) return;
    this.session.answer({
      mediaConstraints: { audio: true, video: false },
      rtcAnswerConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
    });
  }
  hangup() { try { this.session?.terminate(); } catch {} }
  mute() { this.session?.mute({ audio: true }); }
  unmute() { this.session?.unmute({ audio: true }); }
  hold() { this.session?.hold(); }
  unhold() { this.session?.unhold(); }
  sendDTMF(k: string) { this.session?.sendDTMF(k, { duration: 100, interToneGap: 70 }); }
  transfer(target: string) {
    if (!this.session || !this.cfg) return;
    this.session.refer(`sip:${target}@${this.cfg.sipDomain}`);
  }

  // ---- Quality/handover helpers used by the audio & network modules ----
  getActivePeerConnection(): RTCPeerConnection | null {
    return (this.session as any)?.connection ?? null;
  }
  hasActiveCall(): boolean {
    return !!this.session && (this.snap.callState === "active" || this.snap.callState === "held");
  }
  async iceRestart(): Promise<boolean> {
    const s = this.session;
    if (!s) return false;
    try {
      if (typeof s.renegotiate === "function") {
        s.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
        return true;
      }
      const pc: RTCPeerConnection | undefined = s.connection;
      if (pc && typeof pc.restartIce === "function") { pc.restartIce(); return true; }
    } catch (e: any) {
      this.log("error", `ice restart failed: ${e?.message || e}`);
    }
    return false;
  }
  async forceReregister() {
    try {
      if (!this.ua) return;
      try { this.ua.unregister({ all: true }); } catch {}
      setTimeout(() => { try { this.ua?.register(); } catch {} }, 250);
    } catch {}
  }

  stop() {
    try { this.ua?.stop(); } catch {}
    this.ua = null;
    this.session = null;
    this.update({ status: "disconnected", callState: "idle", direction: null, startedAt: null });
  }
}

export const ppSipProvider = new PpSipProvider();
