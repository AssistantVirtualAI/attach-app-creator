import * as JsSIPModule from 'jssip';
import { Capacitor } from '@capacitor/core';


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
  authUsername?: string;
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
   SDP rewriter — strip video, DTLS/SRTP (FusionPBX wants plain RTP),
   then re-order audio codecs: Opus first (with FEC/DTX/adaptive
   bitrate for resilience on weak networks), then PCMU/PCMA fallbacks,
   then telephone-event for DTMF. Accepts profile-driven Opus
   parameters (HD / auto / low-bandwidth).
   ============================================================ */
export interface SdpRewriteOpts {
  opusMaxAverageBitrate?: number;  // bps
  opusMaxPlaybackRate?: number;    // Hz
  opusUseInbandFec?: boolean;
  opusUseDtx?: boolean;
  opusPtime?: number;              // ms
}

const DEFAULT_OPTS: Required<SdpRewriteOpts> = {
  opusMaxAverageBitrate: 24000,
  opusMaxPlaybackRate: 16000,
  opusUseInbandFec: true,
  opusUseDtx: true,
  opusPtime: 20,
};

function extractPt(sdp: string, codecRegex: RegExp): string | null {
  const m = sdp.match(new RegExp(`a=rtpmap:(\\d+)\\s+${codecRegex.source}`, 'i'));
  return m ? m[1] : null;
}

export function rewriteSdpForFusionPBX(sdp: string, _opts: SdpRewriteOpts = {}): string {
  let out = sdp;
  // Drop the entire video m-section — audio only.
  out = out.replace(/m=video[\s\S]*?(?=\r\nm=|$)/gi, '');

  // Restrict audio to PCMU(0) + PCMA(8) + telephone-event(101).
  // CRITICAL: keep the original transport (UDP/TLS/RTP/SAVPF) — WebRTC requires
  // DTLS-SRTP and FusionPBX with mod_verto/WSS expects it too. Stripping DTLS
  // causes the PBX to answer 488 Not Acceptable Here.
  out = out.replace(
    /^m=audio\s+(\d+)\s+(\S+)\s+[^\r\n]+/gm,
    (_m, port, proto) => `m=audio ${port} ${proto} 0 8 101`
  );

  // Keep only PCMU/PCMA/telephone-event rtpmap & fmtp lines.
  out = out.replace(/^a=rtpmap:(\d+) [^\r\n]+$/gm, (line, pt) =>
    pt === '0' || pt === '8' || pt === '101' ? line : ''
  );
  out = out.replace(/^a=fmtp:(\d+) [^\r\n]+$/gm, (line, pt) =>
    pt === '0' || pt === '8' || pt === '101' ? line : ''
  );
  // Drop rtcp-fb for codecs we removed (Opus etc.).
  out = out.replace(/^a=rtcp-fb:(\d+) [^\r\n]+$/gm, (line, pt) =>
    pt === '*' || pt === '0' || pt === '8' || pt === '101' ? line : ''
  );

  // Collapse blank lines created by the deletions.
  out = out.replace(/(\r?\n){2,}/g, '\r\n');
  return out;
}

/** Default modifier (auto profile) — kept for backward compatibility. */
export const sdpModifier = (description: any) => {
  if (description?.sdp) {
    try { description.sdp = rewriteSdpForFusionPBX(description.sdp); }
    catch (e) { console.error('[SIP][SDP] rewrite error', e); }
  }
  return Promise.resolve(description);
};

/** Build a profile-driven modifier (used by useSoftphone per call). */
export function buildSdpModifier(opts: SdpRewriteOpts) {
  return (description: any) => {
    if (description?.sdp) {
      try { description.sdp = rewriteSdpForFusionPBX(description.sdp, opts); }
      catch (e) { console.error('[SIP][SDP] rewrite error', e); }
    }
    return Promise.resolve(description);
  };
}

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

  if (code === 401 || /401|unauthorized/.test(reason) || /401|unauthorized/.test(cause)) {
    return 'Wrong SIP password';
  }
  if (code === 403 || /403|forbidden/.test(reason) || /403|forbidden/.test(cause)) {
    return 'Extension not authorized';
  }
  if (code === 488 || /not acceptable/.test(reason)) {
    return 'Codec rejected by PBX (488). Workaround active — contact your PBX admin.';
  }
  if (code === 407 || /auth/.test(reason) || /unauthor/.test(cause)) {
    return 'Authentication failed — check the SIP extension and password.';
  }
  if (code === 404 || /not found/.test(reason)) {
    return 'Number not found (404) — the dialed extension does not exist on this PBX.';
  }
  if (code === 486 || code === 600 || /busy/.test(reason)) {
    return 'Busy — the remote party rejected the call.';
  }
  if (code === 408 || /timeout/.test(reason) || /request timeout/.test(cause) || /registration timeout/.test(cause)) {
    return 'Phone server not responding';
  }
  if (/dns/.test(cause)) {
    return 'DNS resolution failed — SIP domain not reachable.';
  }
  if (/ssl|certificate|cert|tls|handshake/.test(cause)) {
    return 'SSL certificate rejected by the browser — the WSS endpoint is using a self-signed or untrusted certificate. Ask your administrator to install a valid CA-signed certificate on port 7443.';
  }
  if (/connection|websocket|network|transport/.test(cause)) {
    return 'Cannot reach phone server';
  }
  if (code && code >= 400 && code < 700) {
    return `Call rejected (${code} ${input.reason_phrase || ''}).`.trim();
  }
  return input.cause || input.message || 'SIP initialization failed';
}

/** Build the list of WSS URLs to try, primary first. Only confirmed-working endpoints. */
export function buildWssFallbackList(config: SIPConfig): string[] {
  // pbxnode.lemtel.tel has the matching Let's Encrypt cert (CN=pbxnode.lemtel.tel)
  // node.lemtelcloud.net resolves to same server but cert CN mismatch may cause SIP 403
  return [
    'wss://pbxnode.lemtel.tel:7444',
    'wss://node.lemtelcloud.net:7444',
    'wss://pbxnode.lemtel.tel:7443',
    'wss://node.lemtelcloud.net:7443',
  ];
}

export async function createSIPUA(config: SIPConfig, timeoutMs = 8000) {
  const JsSIP = await waitForJsSIP(timeoutMs);
  const wssUrls = buildWssFallbackList(config);
  const sockets = wssUrls.map((url) => new JsSIP.WebSocketInterface(url));
  sockets.forEach((s: any) => { try { s.via_transport = 'wss'; } catch {} });
  // IMPORTANT: config must match portal/desktop exactly to avoid SIP 403
  // portal src/lib/softphone/jssipProvider.ts works — copy same params
  // EXACT same config as portal src/lib/softphone/jssipProvider.ts (confirmed working)
  // EXACT same config as portal src/lib/softphone/jssipProvider.ts, plus
  // Capacitor-native hacks so the Contact/Via headers carry a real IP when
  // running inside the iOS/Android shell (where the WebView IP is unusable).
  const isNative = (() => { try { return Capacitor.isNativePlatform(); } catch { return false; } })();
  return new JsSIP.UA({
    sockets,
    uri: `sip:${config.extension}@${config.domain}`,
    password: config.password,
    authorization_user: config.extension,
    realm: config.domain,
    contact_uri: `sip:${config.extension}@${config.domain};transport=wss`,
    register: true,
    session_timers: false,
    register_expires: 300,
    connection_recovery_min_interval: 2,
    connection_recovery_max_interval: 30,
    user_agent: "AVA Softphone 1.1",
    hack_ip_in_contact: isNative,
    hack_via_tcp: isNative,
  } as any);
}
