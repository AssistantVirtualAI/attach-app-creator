import * as JsSIPModule from 'jssip';

declare global {
  interface Window {
    JsSIP: any;
  }
}

export interface SIPConfig {
  extension: string;
  password: string;
  domain: string;
  /** Primary WSS URL. Additional `wssUrls` may be supplied for fallback. */
  wssUrl: string;
  wssUrls?: string[];
  displayName?: string;
}

export class JsSIPUnavailableError extends Error {
  constructor(msg = 'JsSIP library failed to load') {
    super(msg);
    this.name = 'JsSIPUnavailableError';
  }
}

export function hasWebRTC(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).RTCPeerConnection ||
    (window as any).webkitRTCPeerConnection ||
    (window as any).mozRTCPeerConnection
  );
}

export const WEBRTC_UNAVAILABLE_MESSAGE =
  'WebRTC not supported in this browser. Open in Chrome or Safari, or use the native mobile app.';

function bundledJsSIP() {
  const mod: any = JsSIPModule as any;
  return mod?.UA && mod?.WebSocketInterface ? mod : mod?.default || null;
}

/** Resolves the bundled JsSIP module, falling back to window.JsSIP if present. */
export function waitForJsSIP(timeoutMs = 8000, intervalMs = 100): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      const bundled = bundledJsSIP();
      if (bundled) resolve(bundled);
      else reject(new JsSIPUnavailableError('No window (SSR/non-browser)'));
      return;
    }
    if (!hasWebRTC()) {
      reject(new JsSIPUnavailableError(WEBRTC_UNAVAILABLE_MESSAGE));
      return;
    }
    if (window.JsSIP) {
      resolve(window.JsSIP);
      return;
    }
    const bundled = bundledJsSIP();
    if (bundled) {
      window.JsSIP = bundled;
      resolve(bundled);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      if (window.JsSIP) {
        clearInterval(id);
        resolve(window.JsSIP);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(id);
        reject(new JsSIPUnavailableError(
          'Phone library failed to load. SIP calls require a WebRTC-compatible browser (Chrome or Safari) or the native mobile app.'
        ));
      }
    }, intervalMs);
  });
}

export function getJsSIP() {
  if (typeof window !== 'undefined' && window.JsSIP) return window.JsSIP;
  return bundledJsSIP();
}


/* ============================================================
   SDP rewriter — forces audio-only PCMU/PCMA, plain RTP
   (no DTLS/SRTP) so FusionPBX doesn't return 488 Not Acceptable.
   Mirrors the desktop softphone provider exactly.
   ============================================================ */
export function rewriteSdpForFusionPBX(sdp: string): string {
  let out = sdp;
  out = out.replace(/m=video[\s\S]*?(?=\r\nm=|$)/g, '');
  out = out.replace(/m=audio (\d+) [A-Z\/]+ [^\r\n]+/g, 'm=audio $1 RTP/AVP 0 8 101');
  out = out.replace(/^a=fingerprint:.*$/gm, '');
  out = out.replace(/^a=setup:.*$/gm, '');
  out = out.replace(/^a=dtls[-a-z]*:.*$/gm, '');
  out = out.replace(/^a=crypto:.*$/gm, '');
  out = out.replace(/^a=ice-options:.*$/gm, '');
  out = out.replace(/^a=rtpmap:(\d+) [^\r\n]+$/gm, (line, pt) =>
    pt === '0' || pt === '8' || pt === '101' ? line : '',
  );
  out = out.replace(/^a=fmtp:(\d+) [^\r\n]+$/gm, (line, pt) =>
    pt === '0' || pt === '8' || pt === '101' ? line : '',
  );
  out = out.replace(/^a=rtcp-fb:.*$/gm, '');
  out = out.replace(/^a=extmap:.*$/gm, '');
  out = out.replace(/\r?\n\r?\n+/g, '\r\n');
  return out;
}

/** Modifier passed to JsSIP outbound call + incoming answer. */
export const sdpModifier = (description: any) => {
  if (description?.sdp) {
    try {
      description.sdp = rewriteSdpForFusionPBX(description.sdp);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SIP][SDP] rewrite error', e);
    }
  }
  return Promise.resolve(description);
};

/* ============================================================
   Failure classification — turns JsSIP error blobs into a
   short, user-facing line + actionable hint.
   ============================================================ */
export function classifySipFailure(input: {
  cause?: string;
  message?: string;
  status_code?: number;
  reason_phrase?: string;
}): string {
  const code = input.status_code;
  const reason = (input.reason_phrase || '').toLowerCase();
  const cause = (input.cause || input.message || '').toLowerCase();

  if (code === 488 || /not acceptable/.test(reason)) {
    return 'Codec rejected by PBX (488). Workaround active — contact your PBX admin.';
  }
  if (code === 401 || code === 403 || code === 407 || /auth/.test(reason) || /unauthor/.test(cause)) {
    return 'Authentication failed — check the SIP extension and password.';
  }
  if (code === 404 || /not found/.test(reason)) {
    return 'Number not found (404) — the dialed extension does not exist on this PBX.';
  }
  if (code === 486 || code === 600 || /busy/.test(reason)) {
    return 'Busy — the remote party rejected the call.';
  }
  if (code === 408 || /timeout/.test(reason) || /request timeout/.test(cause) || /registration timeout/.test(cause)) {
    return 'Registration timeout — PBX did not respond. Check network/firewall.';
  }
  if (/dns/.test(cause)) {
    return 'DNS resolution failed — SIP domain not reachable.';
  }
  if (/ssl|certificate|cert|tls|handshake/.test(cause)) {
    return 'SSL certificate rejected by the browser — the WSS endpoint is using a self-signed or untrusted certificate. Ask your administrator to install a valid CA-signed certificate on port 7443.';
  }
  if (/connection|websocket|network|transport/.test(cause)) {
    return 'WSS connection failed — check network/firewall (port 7443). If this persists, the SIP server may be presenting an invalid SSL certificate.';
  }
  if (code && code >= 400 && code < 700) {
    return `Call rejected (${code} ${input.reason_phrase || ''}).`.trim();
  }
  return input.cause || input.message || 'SIP initialization failed';
}

/** Build the list of WSS URLs to try, primary first. Only confirmed-working endpoints. */
export function buildWssFallbackList(config: SIPConfig): string[] {
  const list = [
    config.wssUrl,
    ...(config.wssUrls || []),
    'wss://node.lemtelcloud.net:7443', // confirmed OK
    'wss://pbxnode.lemtel.tel:7443',   // confirmed OK
  ];
  return Array.from(new Set(list.filter(Boolean)));
}

export async function createSIPUA(config: SIPConfig, timeoutMs = 8000) {
  const JsSIP = await waitForJsSIP(timeoutMs);
  const wssUrls = buildWssFallbackList(config);
  const sockets = wssUrls.map((url) => new JsSIP.WebSocketInterface(url));
  sockets.forEach((s: any) => { try { s.via_transport = 'wss'; } catch {} });
  return new JsSIP.UA({
    sockets,
    uri: `sip:${config.extension}@${config.domain}`,
    password: config.password,
    authorization_user: config.extension,
    realm: config.domain,
    contact_uri: `sip:${config.extension}@${config.domain};transport=wss`,
    display_name: config.displayName || config.extension,
    register: true,
    session_timers: false,
    register_expires: 300,
    connection_recovery_min_interval: 2,
    connection_recovery_max_interval: 30,
    use_preloaded_route: false,
    user_agent: 'Lemtel-Softphone-Mobile/2.3.5',
    hackWssInTransport: true,
    hackIpInContact: true,
    hackViaBranch: true,
    pcConfig: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    },
  });
}
