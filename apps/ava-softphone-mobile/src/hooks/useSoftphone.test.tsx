import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSoftphone } from './useSoftphone';

type Handler = (...args: any[]) => void;

function makeFakeSession(direction: 'incoming' | 'outgoing' = 'incoming', user = '5145551234') {
  const handlers: Record<string, Handler[]> = {};
  return {
    direction,
    remote_identity: { uri: { user } },
    on(evt: string, cb: Handler) {
      (handlers[evt] = handlers[evt] || []).push(cb);
    },
    emit(evt: string, ...args: any[]) {
      (handlers[evt] || []).forEach((h) => h(...args));
    },
    terminate: vi.fn(),
    answer: vi.fn(),
  };
}

function installFakeJsSIP() {
  const uaHandlers: Record<string, Handler[]> = {};
  const ua = {
    on: vi.fn((evt: string, cb: Handler) => {
      (uaHandlers[evt] = uaHandlers[evt] || []).push(cb);
    }),
    start: vi.fn(),
    stop: vi.fn(),
    call: vi.fn(),
    emit: (evt: string, ...args: any[]) =>
      (uaHandlers[evt] || []).forEach((h) => h(...args)),
  };
  (window as any).JsSIP = {
    WebSocketInterface: vi.fn().mockImplementation(() => ({})),
    UA: vi.fn().mockImplementation(() => ua),
  };
  return ua;
}

const cfg = {
  extension: '300',
  password: 'pw',
  domain: 'lemtel.tel',
  wssUrl: 'wss://sip.example.com:7443',
  displayName: 'Test',
};

describe('useSoftphone', () => {
  beforeEach(() => {
    delete (window as any).JsSIP;
  });
  afterEach(() => {
    delete (window as any).JsSIP;
  });

  it('reports error when JsSIP never loads (short timeout)', async () => {
    const { result } = renderHook(() => useSoftphone(cfg, { jsSipTimeoutMs: 50 }));
    expect(result.current.sipStatus).toBe('connecting');
    await waitFor(() => expect(result.current.sipStatus).toBe('error'), { timeout: 1500 });
    expect(result.current.sipError).toMatch(/library failed to load/i);
  });

  it('transitions to registered on UA "registered" event', async () => {
    const ua = installFakeJsSIP();
    const { result } = renderHook(() => useSoftphone(cfg));
    await waitFor(() => expect(ua.start).toHaveBeenCalled());
    act(() => ua.emit('registered'));
    expect(result.current.sipStatus).toBe('registered');
    expect(result.current.sipError).toBe('');
  });

  it('transitions to error on registrationFailed', async () => {
    const ua = installFakeJsSIP();
    const { result } = renderHook(() => useSoftphone(cfg));
    await waitFor(() => expect(ua.start).toHaveBeenCalled());
    act(() => ua.emit('registrationFailed', { cause: 'Forbidden' }));
    expect(result.current.sipStatus).toBe('error');
    expect(result.current.sipError).toBe('Forbidden');
  });

  it('handles incoming call: ringing -> active -> idle (after ended)', async () => {
    vi.useFakeTimers();
    const ua = installFakeJsSIP();
    const { result } = renderHook(() => useSoftphone(cfg));
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => expect(ua.start).toHaveBeenCalled());

    const session = makeFakeSession('incoming', '5145559999');
    act(() => ua.emit('newRTCSession', { session }));
    expect(result.current.callState).toBe('ringing');
    expect(result.current.activeCallNumber).toBe('5145559999');

    act(() => session.emit('confirmed'));
    expect(result.current.callState).toBe('active');

    act(() => session.emit('ended'));
    expect(result.current.callState).toBe('ended');
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(result.current.callState).toBe('idle');
    expect(result.current.activeCallNumber).toBe('');
    vi.useRealTimers();
  });
});
