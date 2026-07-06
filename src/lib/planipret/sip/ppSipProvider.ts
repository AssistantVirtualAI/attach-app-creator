// Planiprêt REST-only phone state types.
// No browser SIP, WebSocket, or local media registration is used for /mplanipret.

export type PpSipStatus = "idle" | "connecting" | "connected" | "registered" | "disconnected" | "error";
export type PpCallState = "idle" | "ringing-out" | "ringing-in" | "active" | "held" | "ended";

export interface PpSipConfig {
  extension: string;
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

const snap: PpSipSnapshot = {
  status: "registered",
  callState: "idle",
  remoteIdentity: "",
  remoteNumber: "",
  direction: null,
  callId: "",
  muted: false,
  onHold: false,
  startedAt: null,
  lastRegistrationAt: Date.now(),
};

export const ppSipProvider = {
  audioEl: null as HTMLAudioElement | null,
  subscribe(fn: (s: PpSipSnapshot) => void): () => void { fn(snap); return () => {}; },
  getSnapshot(): PpSipSnapshot { return snap; },
  getConfig(): PpSipConfig | null { return null; },
  async init(_cfg: PpSipConfig) {},
  async call(_number: string) {},
  answer() {},
  hangup() {},
  mute() {},
  unmute() {},
  hold() {},
  unhold() {},
  sendDTMF(_k: string) {},
  transfer(_target: string) {},
  getActivePeerConnection(): RTCPeerConnection | null { return null; },
  hasActiveCall(): boolean { return false; },
  async iceRestart(): Promise<boolean> { return false; },
  stop() {},
};