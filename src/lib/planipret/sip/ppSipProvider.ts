// Planiprêt web softphone — real SIP.js UserAgent for the _web device.
// Registers as `<ext>_web` over WSS so NetSapiens sees it as SIP.js/0.21 and
// audio flows through WebRTC in the browser.

import {
  Inviter,
  Invitation,
  Registerer,
  RegistererState,
  Session,
  SessionState,
  UserAgent,
  UserAgentOptions,
  URI,
} from "sip.js";

export type PpSipStatus = "idle" | "connecting" | "connected" | "registered" | "disconnected" | "error";
export type PpCallState = "idle" | "ringing-out" | "ringing-in" | "active" | "held" | "ended";

export interface PpSipConfig {
  wsUrl: string;             // wss://voice.ava-telecom.ca:8001
  domain: string;            // planipret.ca
  username: string;          // <ext>_web
  authUser: string;          // <ext>_web
  password: string;
  extension: string;         // 113
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

const snap: PpSipSnapshot = {
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

const listeners = new Set<Listener>();
let ua: UserAgent | null = null;
let registerer: Registerer | null = null;
let session: Session | null = null;
let cfg: PpSipConfig | null = null;
let audioEl: HTMLAudioElement | null = null;

function emit() {
  const s = { ...snap };
  listeners.forEach((l) => { try { l(s); } catch { /* ignore */ } });
}
function patch(p: Partial<PpSipSnapshot>) { Object.assign(snap, p); emit(); }

function attachRemoteMedia(sess: Session) {
  const pc = (sess as any).sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined;
  if (!pc || !audioEl) return;
  const remoteStream = new MediaStream();
  pc.getReceivers().forEach((r) => { if (r.track) remoteStream.addTrack(r.track); });
  audioEl.srcObject = remoteStream;
  audioEl.play().catch(() => { /* user gesture required — ignored */ });
}

function wireSession(sess: Session, direction: "in" | "out") {
  session = sess;
  patch({
    direction,
    remoteIdentity: sess.remoteIdentity?.displayName || sess.remoteIdentity?.uri?.user || "",
    remoteNumber: sess.remoteIdentity?.uri?.user || "",
    callId: (sess as any).id ?? "",
  });
  sess.stateChange.addListener((state) => {
    switch (state) {
      case SessionState.Establishing:
        patch({ callState: direction === "out" ? "ringing-out" : "ringing-in" });
        break;
      case SessionState.Established:
        attachRemoteMedia(sess);
        patch({ callState: "active", startedAt: Date.now() });
        break;
      case SessionState.Terminated:
        patch({ callState: "ended" });
        session = null;
        setTimeout(() => patch({
          callState: "idle", callId: "", remoteNumber: "", remoteIdentity: "",
          direction: null, startedAt: null, muted: false, onHold: false,
        }), 800);
        break;
    }
  });
}

export const ppSipProvider = {
  get audioEl() { return audioEl; },
  set audioEl(el: HTMLAudioElement | null) { audioEl = el; },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    fn({ ...snap });
    return () => { listeners.delete(fn); };
  },
  getSnapshot(): PpSipSnapshot { return { ...snap }; },
  getConfig(): PpSipConfig | null { return cfg; },

  async init(config: PpSipConfig): Promise<void> {
    if (ua && cfg && cfg.username === config.username && cfg.wsUrl === config.wsUrl) return;
    await this.stop();
    cfg = config;
    patch({ status: "connecting", errorCause: undefined });

    const uri = UserAgent.makeURI(`sip:${config.username}@${config.domain}`);
    if (!uri) { patch({ status: "error", errorCause: "invalid_uri" }); return; }

    const options: UserAgentOptions = {
      uri,
      transportOptions: { server: config.wsUrl },
      authorizationUsername: config.authUser,
      authorizationPassword: config.password,
      displayName: config.displayName ?? config.extension,
      userAgentString: "SIP.js/0.21.2 Planipret-Web",
      logBuiltinEnabled: false,
      sessionDescriptionHandlerFactoryOptions: {
        constraints: { audio: true, video: false },
        peerConnectionConfiguration: {
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
        },
      },
      delegate: {
        onInvite(inv: Invitation) {
          wireSession(inv, "in");
          patch({ callState: "ringing-in" });
        },
      },
    };

    ua = new UserAgent(options);
    try {
      await ua.start();
      patch({ status: "connected" });
      registerer = new Registerer(ua, { expires: 300 });
      registerer.stateChange.addListener((s) => {
        if (s === RegistererState.Registered) {
          patch({ status: "registered", lastRegistrationAt: Date.now(), errorCause: undefined });
        } else if (s === RegistererState.Unregistered) {
          patch({ status: "disconnected" });
        }
      });
      await registerer.register();
    } catch (e: any) {
      console.error("[ppSip] init failed", e);
      patch({ status: "error", errorCause: e?.message || String(e) });
    }
  },

  async call(number: string): Promise<void> {
    if (!ua || !cfg) throw new Error("SIP not ready");
    const target = UserAgent.makeURI(`sip:${number}@${cfg.domain}`);
    if (!target) throw new Error("invalid target");
    const inv = new Inviter(ua, target, {
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } as any },
    });
    wireSession(inv, "out");
    patch({ callState: "ringing-out", remoteNumber: number, remoteIdentity: number });
    await inv.invite();
  },

  async answer(): Promise<void> {
    if (session instanceof Invitation) {
      await session.accept({
        sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } as any },
      });
    }
  },

  hangup(): void {
    if (!session) return;
    try {
      if (session instanceof Inviter) {
        if (session.state === SessionState.Establishing || session.state === SessionState.Initial) {
          void session.cancel();
        } else {
          void session.bye();
        }
      } else if (session instanceof Invitation) {
        if (session.state === SessionState.Established) void session.bye();
        else void session.reject();
      } else {
        void (session as any).bye?.();
      }
    } catch { /* ignore */ }
  },

  mute(): void {
    const pc = (session as any)?.sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined;
    pc?.getSenders().forEach((s) => { if (s.track && s.track.kind === "audio") s.track.enabled = false; });
    patch({ muted: true });
  },
  unmute(): void {
    const pc = (session as any)?.sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined;
    pc?.getSenders().forEach((s) => { if (s.track && s.track.kind === "audio") s.track.enabled = true; });
    patch({ muted: false });
  },
  hold(): void { patch({ onHold: true, callState: "held" }); },
  unhold(): void { patch({ onHold: false, callState: "active" }); },
  sendDTMF(k: string): void {
    const sdh: any = (session as any)?.sessionDescriptionHandler;
    try { sdh?.sendDtmf?.(k); } catch { /* ignore */ }
  },
  transfer(target: string): void {
    if (!session || !cfg) return;
    const uri = UserAgent.makeURI(`sip:${target}@${cfg.domain}`);
    if (uri) { try { (session as any).refer?.(uri); } catch { /* ignore */ } }
  },
  getActivePeerConnection(): RTCPeerConnection | null {
    return ((session as any)?.sessionDescriptionHandler?.peerConnection as RTCPeerConnection) ?? null;
  },
  hasActiveCall(): boolean { return !!session; },
  async iceRestart(): Promise<boolean> { return false; },

  async stop(): Promise<void> {
    try { if (registerer) await registerer.unregister(); } catch { /* ignore */ }
    try { if (ua) await ua.stop(); } catch { /* ignore */ }
    registerer = null;
    ua = null;
    session = null;
    patch({ status: "disconnected" });
  },
};
