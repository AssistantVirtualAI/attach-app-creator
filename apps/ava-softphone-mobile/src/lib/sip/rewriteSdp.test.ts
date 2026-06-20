/**
 * Unit tests for the FusionPBX SDP rewriter.
 * The rewriter now prefers Opus (with FEC/DTX) but keeps PCMU/PCMA as
 * fallbacks so FusionPBX continues to negotiate successfully even when
 * Opus is not enabled on the PBX side.
 */
import { describe, it, expect } from 'vitest';
import { rewriteSdpForFusionPBX } from './jssipProvider';

const RAW_SDP = [
  'v=0',
  'o=- 1 1 IN IP4 0.0.0.0',
  's=-',
  't=0 0',
  'm=audio 49170 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126',
  'c=IN IP4 0.0.0.0',
  'a=rtpmap:111 opus/48000/2',
  'a=rtpmap:103 ISAC/16000',
  'a=rtpmap:0 PCMU/8000',
  'a=rtpmap:8 PCMA/8000',
  'a=rtpmap:101 telephone-event/8000',
  'a=fmtp:111 minptime=10;useinbandfec=1',
  'a=fmtp:101 0-16',
  'a=fingerprint:sha-256 AA:BB:CC',
  'a=setup:actpass',
  'a=dtls-id:1',
  'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:abc',
  'a=ice-options:trickle',
  'a=rtcp-fb:111 transport-cc',
  'a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level',
  'm=video 49172 UDP/TLS/RTP/SAVPF 96 97',
  'c=IN IP4 0.0.0.0',
  'a=rtpmap:96 VP8/90000',
  'a=fingerprint:sha-256 DD:EE:FF',
].join('\r\n');

describe('rewriteSdpForFusionPBX', () => {
  const out = rewriteSdpForFusionPBX(RAW_SDP);

  it('rewrites m=audio to plain RTP/AVP with Opus(111) preferred then PCMU/PCMA/telephone-event', () => {
    expect(out).toMatch(/^m=audio \d+ RTP\/AVP 111 0 8 101$/m);
    expect(out).not.toMatch(/UDP\/TLS\/RTP\/SAVPF/);
  });

  it('removes every m=video section entirely', () => {
    expect(out).not.toMatch(/m=video/);
    expect(out).not.toMatch(/VP8/);
  });

  it('removes DTLS fingerprint, setup, dtls-id, crypto and ice-options', () => {
    expect(out).not.toMatch(/a=fingerprint/);
    expect(out).not.toMatch(/a=setup/);
    expect(out).not.toMatch(/a=dtls-id/);
    expect(out).not.toMatch(/a=crypto/);
    expect(out).not.toMatch(/a=ice-options/);
  });

  it('keeps only Opus/PCMU/PCMA/telephone-event rtpmap entries', () => {
    const rtpmaps = out.match(/^a=rtpmap:(\d+) /gm) || [];
    const pts = rtpmaps.map((l) => l.match(/^a=rtpmap:(\d+) /)![1]);
    expect(new Set(pts)).toEqual(new Set(['111', '0', '8', '101']));
  });

  it('injects Opus FEC/DTX/maxaveragebitrate fmtp', () => {
    expect(out).toMatch(/^a=fmtp:111 [^\r\n]*useinbandfec=1/m);
    expect(out).toMatch(/^a=fmtp:111 [^\r\n]*usedtx=1/m);
    expect(out).toMatch(/^a=fmtp:111 [^\r\n]*maxaveragebitrate=24000/m);
  });

  it('strips rtcp-fb and extmap lines', () => {
    expect(out).not.toMatch(/a=rtcp-fb/);
    expect(out).not.toMatch(/a=extmap/);
  });
});
