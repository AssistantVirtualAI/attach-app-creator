// JsSIP UA lifecycle manager — desktop softphone.
// Mirrors the web app provider with extras: attended transfer, audio device pinning.
declare global { interface Window { JsSIP: any } }

export type SipStatus =
  | 'idle' | 'connecting' | 'connected' | 'registered'
  | 'disconnected' | 'error';

export type CallState =
  | 'idle' | 'ringing-out' | 'ringing-in'
  | 'active' | 'held' | 'ended';

export interface SoftphoneSnapshot {
  status: SipStatus;
  callState: CallState;
  remoteIdentity: string;
  remoteNumber: string;
  errorCause?: string;
  muted: boolean;
  onHold: boolean;
  direction: 'in' | 'out' | null;
  startedAt: number | null;
}

export interface SoftphoneConfig {
  extension: string;
  displayName: string;
  sipDomain: string;
  wssUrl: string;
  password: string;
  mock?: boolean;
}

type Listener = (snap: SoftphoneSnapshot) => void;

class JsSipProvider {
  private ua: any = null;
  private session: any = null;
  private secondSession: any = null; // attended transfer hold-buffer
  private config: SoftphoneConfig | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private snap: SoftphoneSnapshot = {
    status: 'idle',
    callState: 'idle',
    remoteIdentity: '',
    remoteNumber: '',
    muted: false,
    onHold: false,
    direction: null,
    startedAt: null,
  };
  audioEl: HTMLAudioElement | null = null;
  outputDeviceId: string | null = null;

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
  hasActiveCall() { return !!this.session; }

  async init(cfg: SoftphoneConfig) {
    if (this.ua) this.stop();
    this.config = cfg;

    if (cfg.mock || !cfg.password) {
      this.update({ status: 'registered' });
      return;
    }

    if (!window.JsSIP) {
      this.update({ status: 'error', errorCause: 'JsSIP not loaded' });
      return;
    }

    try {
      const socket = new window.JsSIP.WebSocketInterface(cfg.wssUrl);
      const ua = new window.JsSIP.UA({
        sockets: [socket],
        uri: `sip:${cfg.extension}@${cfg.sipDomain}`,
        password: cfg.password,
        register: true,
        session_timers: false,
        register_expires: 300,
        user_agent: 'Lemtel Softphone 1.1',
      });

      ua.on('connected', () => this.update({ status: 'connected' }));
      ua.on('disconnected', () => {
        this.update({ status: 'disconnected' });
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => { try { ua.start(); } catch { /* noop */ } }, 5000);
      });
      ua.on('registered', () => this.update({ status: 'registered' }));
      ua.on('registrationFailed', (e: any) => {
        this.update({ status: 'error', errorCause: e?.cause || 'registration failed' });
      });
      ua.on('newRTCSession', (e: any) => this.attachSession(e.session, e.originator));

      ua.start();
      this.ua = ua;
      this.update({ status: 'connecting' });
    } catch (err: any) {
      this.update({ status: 'error', errorCause: String(err?.message || err) });
    }
  }

  private attachSession(session: any, originator: string) {
    // If we already have a primary session, treat this as a secondary (attended xfer).
    if (this.session && originator !== 'remote') {
      this.secondSession = session;
      this.bindSecondary(session);
      return;
    }

    this.session = session;
    const incoming = originator === 'remote';
    const remoteUri = session.remote_identity?.uri?.user || '';
    const remoteName = session.remote_identity?.display_name || remoteUri;

    this.update({
      callState: incoming ? 'ringing-in' : 'ringing-out',
      remoteIdentity: remoteName,
      remoteNumber: remoteUri,
      direction: incoming ? 'in' : 'out',
      muted: false,
      onHold: false,
    });

    session.on('progress', () => {
      if (!incoming) this.update({ callState: 'ringing-out' });
    });
    session.on('confirmed', () => {
      this.update({ callState: 'active', startedAt: Date.now() });
    });
    session.on('failed', (e: any) => {
      this.update({ callState: 'ended', errorCause: e?.cause });
      setTimeout(() => this.resetCall(), 2500);
    });
    session.on('ended', () => {
      this.update({ callState: 'ended' });
      setTimeout(() => this.resetCall(), 2500);
    });
    session.on('hold', () => this.update({ onHold: true, callState: 'held' }));
    session.on('unhold', () => this.update({ onHold: false, callState: 'active' }));
    session.on('muted', () => this.update({ muted: true }));
    session.on('unmuted', () => this.update({ muted: false }));

    this.bindMedia(session);
  }

  private bindSecondary(session: any) {
    session.on('ended', () => { this.secondSession = null; });
    session.on('failed', () => { this.secondSession = null; });
    this.bindMedia(session);
  }

  private bindMedia(session: any) {
    const pc = session.connection;
    if (!pc) return;
    pc.addEventListener('track', (ev: any) => {
      if (this.audioEl && ev.streams[0]) {
        this.audioEl.srcObject = ev.streams[0];
        if (this.outputDeviceId && (this.audioEl as any).setSinkId) {
          (this.audioEl as any).setSinkId(this.outputDeviceId).catch(() => { /* noop */ });
        }
        this.audioEl.play().catch(() => { /* noop */ });
      }
    });
  }

  private resetCall() {
    this.session = null;
    this.secondSession = null;
    this.update({
      callState: 'idle',
      remoteIdentity: '',
      remoteNumber: '',
      direction: null,
      startedAt: null,
      muted: false,
      onHold: false,
    });
  }

  call(number: string) {
    if (!this.config || !this.ua) return;
    const target = `sip:${number}@${this.config.sipDomain}`;
    this.ua.call(target, { mediaConstraints: { audio: true, video: false } });
  }

  answer() {
    this.session?.answer({ mediaConstraints: { audio: true, video: false } });
  }

  hangup() {
    try { this.session?.terminate(); } catch { /* noop */ }
  }

  mute() { this.session?.mute({ audio: true }); }
  unmute() { this.session?.unmute({ audio: true }); }
  hold() { this.session?.hold(); }
  unhold() { this.session?.unhold(); }

  sendDTMF(key: string) {
    this.session?.sendDTMF(key, { duration: 100, interToneGap: 70 });
  }

  /** Blind transfer — refer current call to target extension. */
  blindTransfer(target: string) {
    if (!this.session || !this.config) return;
    this.session.refer(`sip:${target}@${this.config.sipDomain}`);
  }

  /** Attended transfer — start a consult call. Caller must then complete with completeAttendedTransfer(). */
  startAttendedConsult(target: string) {
    if (!this.ua || !this.session || !this.config) return;
    this.session.hold();
    const uri = `sip:${target}@${this.config.sipDomain}`;
    this.ua.call(uri, { mediaConstraints: { audio: true, video: false } });
  }

  /** After consult is established, transfer original call to the consult party. */
  completeAttendedTransfer() {
    if (!this.session || !this.secondSession) return;
    try { this.session.refer(this.secondSession); } catch { /* noop */ }
  }

  cancelAttendedConsult() {
    try { this.secondSession?.terminate(); } catch { /* noop */ }
    this.secondSession = null;
    this.session?.unhold();
  }

  hasConsult() { return !!this.secondSession; }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try { this.ua?.stop(); } catch { /* noop */ }
    this.ua = null;
    this.session = null;
    this.secondSession = null;
    this.update({ status: 'disconnected', callState: 'idle', direction: null, startedAt: null });
  }
}

export const sipProvider = new JsSipProvider();
