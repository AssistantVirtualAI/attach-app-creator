declare global {
  interface Window {
    JsSIP: any;
  }
}

export interface SIPConfig {
  extension: string;
  password: string;
  domain: string;
  wssUrl: string;
  displayName?: string;
}

export class JsSIPUnavailableError extends Error {
  constructor(msg = 'JsSIP library failed to load') {
    super(msg);
    this.name = 'JsSIPUnavailableError';
  }
}

/** Polls for window.JsSIP until found or timeout (default 8s). */
export function waitForJsSIP(timeoutMs = 8000, intervalMs = 100): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new JsSIPUnavailableError('No window (SSR/non-browser)'));
      return;
    }
    if (window.JsSIP) {
      resolve(window.JsSIP);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      if (window.JsSIP) {
        clearInterval(id);
        resolve(window.JsSIP);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(id);
        reject(new JsSIPUnavailableError());
      }
    }, intervalMs);
  });
}

export function getJsSIP() {
  if (typeof window !== 'undefined' && window.JsSIP) return window.JsSIP;
  return null;
}

export async function createSIPUA(config: SIPConfig, timeoutMs = 8000) {
  const JsSIP = await waitForJsSIP(timeoutMs);
  const socket = new JsSIP.WebSocketInterface(config.wssUrl);
  return new JsSIP.UA({
    sockets: [socket],
    uri: `sip:${config.extension}@${config.domain}`,
    password: config.password,
    display_name: config.displayName || config.extension,
    register: true,
    session_timers: false,
    register_expires: 300,
    user_agent: 'Lemtel Telecom Mobile 1.0',
    pcConfig: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    },
  });
}
