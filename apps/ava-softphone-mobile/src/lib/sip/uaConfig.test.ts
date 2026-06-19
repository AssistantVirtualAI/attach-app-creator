/**
 * Configuration parity tests — the mobile JsSIP UA must be set up with the
 * same critical flags as the desktop softphone, and `createSIPUA` must
 * try every WSS fallback URL in declared order. A regression here would
 * resurrect the "Mobile SIP fails / desktop works" bug.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSIPUA, buildWssFallbackList, type SIPConfig } from './jssipProvider';

const cfg: SIPConfig = {
  extension: '300',
  password: 'VirtualAI2026!',
  domain: 'lemtel.lemtel.tel',
  wssUrl: 'wss://node.lemtelcloud.net:7443',
  displayName: 'Mobile 300',
};

function installFakeJsSIP(socketProbe: string[]) {
  const ua: any = { on: vi.fn(), start: vi.fn(), stop: vi.fn() };
  (window as any).JsSIP = {
    WebSocketInterface: vi.fn().mockImplementation((url: string) => {
      socketProbe.push(url);
      return { url };
    }),
    UA: vi.fn().mockImplementation((opts: any) => {
      (ua as any).__opts = opts;
      return ua;
    }),
  };
  return ua;
}

beforeEach(() => { if (!(window as any).RTCPeerConnection) (window as any).RTCPeerConnection = vi.fn(); });
afterEach(() => { delete (window as any).JsSIP; });

describe('buildWssFallbackList', () => {
  it('keeps primary first, dedupes, and appends known backups', () => {
    const list = buildWssFallbackList(cfg);
    expect(list[0]).toBe('wss://node.lemtelcloud.net:7443');
    expect(list).toContain('wss://lemtel.lemtel.tel:7443');
    expect(new Set(list).size).toBe(list.length); // no duplicates
  });

  it('honors caller-supplied wssUrls before defaults', () => {
    const list = buildWssFallbackList({ ...cfg, wssUrls: ['wss://custom:7443'] });
    expect(list[0]).toBe('wss://node.lemtelcloud.net:7443');
    expect(list[1]).toBe('wss://custom:7443');
  });
});

describe('createSIPUA configuration parity', () => {
  let attempts: string[];
  let ua: any;

  beforeEach(() => {
    attempts = [];
    ua = installFakeJsSIP(attempts);
  });

  it('attempts each fallback WSS URL in declared order', async () => {
    await createSIPUA(cfg, 200);
    const expected = buildWssFallbackList(cfg);
    expect(attempts).toEqual(expected);
  });

  it('builds the URI as sip:<extension>@<domain>', async () => {
    await createSIPUA(cfg, 200);
    expect(ua.__opts.uri).toBe('sip:300@lemtel.lemtel.tel');
  });

  it('passes the same critical flags as the desktop provider', async () => {
    await createSIPUA(cfg, 200);
    const o = ua.__opts;
    expect(o.password).toBe('VirtualAI2026!');
    expect(o.display_name).toBe('Mobile 300');
    expect(o.register).toBe(true);
    expect(o.register_expires).toBe(300);
    expect(o.session_timers).toBe(false);
    expect(o.use_preloaded_route).toBe(false);
    expect(o.user_agent).toMatch(/Lemtel/);
  });

  it('provides STUN servers for ICE', async () => {
    await createSIPUA(cfg, 200);
    const urls = ua.__opts.pcConfig.iceServers.map((s: any) => s.urls);
    expect(urls).toContain('stun:stun.l.google.com:19302');
  });

  it('passes one socket per fallback URL to the UA', async () => {
    await createSIPUA(cfg, 200);
    const expected = buildWssFallbackList(cfg);
    expect(ua.__opts.sockets).toHaveLength(expected.length);
  });
});
