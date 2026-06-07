declare global {
  interface Window {
    JsSIP: any;
  }
}

export function getJsSIP() {
  if (typeof window !== 'undefined' && window.JsSIP) return window.JsSIP;
  return null;
}

export interface SIPConfig {
  extension: string;
  password: string;
  domain: string;
  wssUrl: string;
  displayName?: string;
}

export function createSIPUA(config: SIPConfig) {
  const JsSIP = getJsSIP();
  if (!JsSIP) {
    console.warn('JsSIP not loaded');
    return null;
  }

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
