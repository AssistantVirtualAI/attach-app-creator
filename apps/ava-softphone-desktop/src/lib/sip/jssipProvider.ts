import * as JsSIP from 'jssip';

// Module load probe — captured at import time so debug report can show it.
const JSSIP_MODULE_INFO = (() => {
  try {
    const keys = JsSIP ? Object.keys(JsSIP as any) : [];
    return {
      loaded: !!(JsSIP && (JsSIP as any).UA),
      version: (JsSIP as any)?.version || (JsSIP as any)?.default?.version || 'unknown',
      exports: keys.slice(0, 20),
      source: 'npm:jssip',
    };
  } catch (e: any) {
    return { loaded: false, version: 'unknown', exports: [], source: 'npm:jssip', error: String(e?.message || e) };
  }
})();

// JsSIP UA lifecycle manager — desktop softphone.
// Mirrors the web app provider with extras: attended transfer, audio device pinning.

export type SipStatus =
  | 'idle' | 'connecting' | 'connected' | 'registered'
  | 'disconnected' | 'error';

export type CallState =
  | 'idle' | 'ringing-out' | 'ringing-in'
  | 'active' | 'held' | 'ended';

export interface SipEvent {
  at: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

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
  events: SipEvent[];
}

export interface SoftphoneConfig {
  extension: string;
  displayName: string;
  sipDomain: string;
  wssUrl: string;
  wssUrls?: string[];
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
    events: [],
  };
  audioEl: HTMLAudioElement | null = null;
  outputDeviceId: string | null = null;
  inputDeviceId: string | null = null;
  boundOutputLabel: string = 'System default';
  boundInputLabel: string = 'System default';
  private wssAttempted: string[] = [];
  private lastCallError: string | null = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.snap);
    return () => this.listeners.delete(fn);
  }

  private update(patch: Partial<SoftphoneSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l(this.snap));
  }

  private logEvent(level: SipEvent['level'], message: string) {
    const next = [...this.snap.events, { at: Date.now(), level, message }].slice(-50);
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[SIP] ${message}`);
    this.update({ events: next });
  }

  getConfig() { return this.config; }
  getSnapshot() { return this.snap; }
  hasActiveCall() { return !!this.session; }

  async restart() {
    const cfg = this.config;
    this.logEvent('info', 'Manual restart requested');
    this.stop();
    if (cfg) await this.init(cfg);
  }


  async init(cfg: SoftphoneConfig) {
    if (this.ua) this.stop();
    this.config = cfg;

    if (cfg.mock || !cfg.password) {
      this.logEvent('warn', cfg.mock ? 'Mock mode — skipping JsSIP init' : 'No SIP password — skipping JsSIP init');
      this.update({ status: 'registered' });
      return;
    }

    if (!JSSIP_MODULE_INFO.loaded) {
      const msg = `JsSIP module failed to load: ${JSSIP_MODULE_INFO['error' as keyof typeof JSSIP_MODULE_INFO] || 'no UA export'}`;
      this.logEvent('error', msg);
      this.update({ status: 'error', errorCause: msg });
      return;
    }
    this.logEvent('info', `JsSIP module ready (version=${JSSIP_MODULE_INFO.version})`);

    const isElectron = typeof window !== 'undefined' &&
      typeof window.navigator !== 'undefined' &&
      window.navigator.userAgent.includes('Electron');
    this.logEvent('info', isElectron
      ? 'Running in Electron — direct WSS, no CORS/mixed-content'
      : 'Running in browser — WSS may be blocked by CORS/mixed-content');

    try {
      const fallbackUrls = Array.from(new Set([
        cfg.wssUrl,
        ...(cfg.wssUrls || []),
        'wss://lemtel.lemtel.tel:7443',
        'wss://pbxnode.lemtel.tel:7443',
        'wss://170.39.199.132:7443',
      ].filter(Boolean)));
      this.wssAttempted = fallbackUrls;

      this.logEvent('info', `Init sip:${cfg.extension}@${cfg.sipDomain} via ${fallbackUrls.length} WSS endpoint(s): ${fallbackUrls.join(', ')}`);

      const sockets = fallbackUrls.map(
        (url) => new JsSIP.WebSocketInterface(url),
      );
      sockets.forEach((s: any) => { try { s.via_transport = 'wss'; } catch { /* noop */ } });

      const ua = new JsSIP.UA({
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
        user_agent: 'Lemtel Telecom 1.1',
        hackWssInTransport: true,
      });

      ua.on('connecting', () => {
        this.logEvent('info', 'WebSocket connecting…');
        this.update({ status: 'connecting' });
      });
      ua.on('connected', () => {
        this.logEvent('info', 'WebSocket connected ✓');
        this.update({ status: 'connected' });
      });
      ua.on('disconnected', (e: any) => {
        const cause = e?.code ? `code=${e.code} reason=${e.reason || ''}` : (e?.reason || 'unknown');
        this.logEvent('warn', `Disconnected (${cause}) — reconnecting in 5s`);
        this.update({ status: 'disconnected', errorCause: cause });
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.logEvent('info', 'Reconnect attempt…');
          try { ua.start(); } catch { /* noop */ }
        }, 5000);
      });
      ua.on('registered', () => {
        this.logEvent('info', 'Registered ✓');
        this.update({ status: 'registered', errorCause: undefined });
      });
      ua.on('unregistered', () => {
        this.logEvent('warn', 'Unregistered');
      });
      ua.on('registrationFailed', (e: any) => {
        const code = e?.response?.status_code;
        const reason = e?.response?.reason_phrase || e?.cause || 'registration failed';
        const detail = code ? `${code} ${reason}` : reason;
        this.logEvent('error', `Registration failed: ${detail}`);
        this.update({ status: 'error', errorCause: detail });
      });
      ua.on('newRTCSession', (e: any) => this.attachSession(e.session, e.originator));

      try {
        ua.start();
        this.logEvent('info', 'UA.start() invoked');
      } catch (startErr: any) {
        this.logEvent('error', `UA.start() threw: ${String(startErr?.message || startErr)}`);
        throw startErr;
      }
      this.ua = ua;
      this.update({ status: 'connecting' });
    } catch (err: any) {
      this.logEvent('error', `Init exception: ${String(err?.message || err)}`);
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
      const cause = e?.cause || 'unknown';
      const reason = e?.message?.reason_phrase || e?.response?.reason_phrase || '';
      const code = e?.message?.status_code || e?.response?.status_code;
      const detail = [cause, code, reason].filter(Boolean).join(' ');
      this.lastCallError = detail;
      this.logEvent('error', `Call failed: ${detail}`);
      this.update({ callState: 'ended', errorCause: detail });
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

  /** Ensure mic permission before placing a call. Returns null on success or error message. */
  async ensureMicPermission(): Promise<string | null> {
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      };
      if (this.inputDeviceId) (audioConstraints as any).deviceId = { exact: this.inputDeviceId };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      const track = stream.getAudioTracks()[0];
      if (track) {
        this.boundInputLabel = track.label || 'System default';
        this.logEvent('info', `Mic ready: ${this.boundInputLabel}`);
      }
      stream.getTracks().forEach((t) => t.stop());
      return null;
    } catch (err: any) {
      const msg = `Microphone access denied: ${err?.message || err}`;
      this.logEvent('error', msg);
      return msg;
    }
  }

  /** List + verify audio devices. Returns labels of currently bound input/output. */
  async testAudioDevices(): Promise<{ input: string; output: string; inputs: number; outputs: number; error?: string }> {
    try {
      // Trigger permission so labels populate.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      const inDev = this.inputDeviceId
        ? inputs.find((d) => d.deviceId === this.inputDeviceId)
        : inputs.find((d) => d.deviceId === 'default') || inputs[0];
      const outDev = this.outputDeviceId
        ? outputs.find((d) => d.deviceId === this.outputDeviceId)
        : outputs.find((d) => d.deviceId === 'default') || outputs[0];
      this.boundInputLabel = inDev?.label || 'System default';
      this.boundOutputLabel = outDev?.label || 'System default';
      this.logEvent('info', `Device test OK — in: ${this.boundInputLabel} / out: ${this.boundOutputLabel} (${inputs.length} in, ${outputs.length} out)`);
      return {
        input: this.boundInputLabel,
        output: this.boundOutputLabel,
        inputs: inputs.length,
        outputs: outputs.length,
      };
    } catch (err: any) {
      const msg = String(err?.message || err);
      this.logEvent('error', `Device test failed: ${msg}`);
      return { input: '—', output: '—', inputs: 0, outputs: 0, error: msg };
    }
  }

  async call(number: string): Promise<string | null> {
    if (!this.config || !this.ua) {
      this.logEvent('error', 'UA not ready — cannot call');
      return 'SIP not initialized';
    }
    const target = `sip:${number}@${this.config.sipDomain}`;
    this.logEvent('info', `Dialing ${number}`);
    try {
      // Let JsSIP handle getUserMedia internally. Pre-fetching the stream
      // causes "Bad Media Description" + unhandled rejections that crash
      // the Electron renderer (black screen).
      this.ua.call(target, {
        mediaConstraints: { audio: true, video: false },
      } as any);
      this.lastCallError = null;
      return null;
    } catch (e: any) {
      const msg = `call() threw: ${e?.message || e}`;
      this.logEvent('error', msg);
      this.lastCallError = msg;
      this.update({ callState: 'idle', errorCause: e?.message || 'Call failed' });
      return msg;
    }
  }

  /** Build a debug report JSON with secrets masked. */
  buildDebugReport(): string {
    const cfg = this.config;
    const masked = cfg ? {
      extension: cfg.extension,
      displayName: cfg.displayName,
      sipDomain: cfg.sipDomain,
      wssUrl: cfg.wssUrl,
      wssUrls: cfg.wssUrls,
      password: cfg.password ? `***${cfg.password.length}chars***` : '(none)',
      mock: !!cfg.mock,
    } : null;
    const report = {
      generatedAt: new Date().toISOString(),
      jssipModule: JSSIP_MODULE_INFO,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
      isElectron: typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron'),
      config: masked,
      wssAttempted: this.wssAttempted,
      audio: {
        input: this.boundInputLabel,
        output: this.boundOutputLabel,
        inputDeviceId: this.inputDeviceId,
        outputDeviceId: this.outputDeviceId,
      },
      sip: {
        status: this.snap.status,
        callState: this.snap.callState,
        errorCause: this.snap.errorCause || null,
        lastCallError: this.lastCallError,
        hasUA: !!this.ua,
        hasSession: !!this.session,
      },
      events: this.snap.events,
    };
    return JSON.stringify(report, null, 2);
  }

  downloadDebugReport() {
    try {
      const json = this.buildDebugReport();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lemtel-softphone-debug-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.logEvent('info', 'Debug report downloaded');
    } catch (err: any) {
      this.logEvent('error', `Debug report failed: ${err?.message || err}`);
    }
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
