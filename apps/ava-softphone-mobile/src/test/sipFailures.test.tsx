/**
 * WebRTC capability + WSS SSL/handshake failure surfacing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSoftphone } from '../hooks/useSoftphone';
import { classifySipFailure } from '../lib/sip/jssipProvider';

const cfg = {
  extension: '300',
  password: 'pw',
  domain: 'lemtel.lemtel.tel',
  wssUrl: 'wss://node.lemtelcloud.net:7443',
};

const originalRTC = (window as any).RTCPeerConnection;
beforeEach(() => { delete (window as any).RTCPeerConnection; });
afterEach(() => { (window as any).RTCPeerConnection = originalRTC; });

describe('WebRTC capability check', () => {
  it('immediately surfaces a detailed error when RTCPeerConnection is missing', () => {
    const { result } = renderHook(() => useSoftphone(cfg));
    expect(result.current.sipStatus).toBe('error');
    expect(result.current.sipError).toMatch(/WebRTC not supported/i);
  });
});

describe('classifySipFailure SSL/TLS handling', () => {
  it('flags SSL certificate failures with a specific user-facing message', () => {
    expect(classifySipFailure({ cause: 'SSL handshake failed' })).toMatch(/ssl certificate rejected|untrusted certificate/i);
    expect(classifySipFailure({ cause: 'TLS certificate error' })).toMatch(/ssl certificate rejected|untrusted certificate/i);
  });
  it('still classifies plain WSS / DNS / auth / timeout reasons', () => {
    expect(classifySipFailure({ cause: 'WebSocket transport error' })).toMatch(/wss connection failed/i);
    expect(classifySipFailure({ cause: 'DNS lookup failed' })).toMatch(/dns/i);
    expect(classifySipFailure({ cause: 'Forbidden', status_code: 403 })).toMatch(/authentication failed/i);
    expect(classifySipFailure({ cause: 'Request Timeout', status_code: 408 })).toMatch(/timeout/i);
  });
});
