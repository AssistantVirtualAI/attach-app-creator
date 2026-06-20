/**
 * Unit tests for the FusionPBX SDP rewriter.
 *
 * The rewriter is now PCMU-only: FusionPBX (per PBX admin) rejects Opus/PCMA
 * with 488 Not Acceptable. We also strip every WebRTC-ism (ICE, DTLS, msid,
 * ssrc, rtcp-fb, extmap) so the SDP looks like classic RTP/AVP.
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
  'a=ice-ufrag:abc',
  'a=ice-pwd:xyz',
  'a=ice-options:trickle',
  'a=candidate:1 1 udp 2113937151 192.168.1.2 60000 typ host',
  'a=end-of-candidates',
  'a=mid:0',
  'a=msid:stream track',
  'a=ssrc:1234 cname:abc',
  'a=rtcp-fb:111 transport-cc',
  'a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level',
  'm=video 49172 UDP/TLS/RTP/SAVPF 96 97',
  'c=IN IP4 0.0.0.0',
  'a=rtpmap:96 VP8/90000',
  'a=fingerprint:sha-256 DD:EE:FF',
].join('\r\n');

describe('rewriteSdpForFusionPBX', () => {
  const out = rewriteSdpForFusionPBX(RAW_SDP);

  it('forces m=audio to plain RTP/AVP with PCMU (PT 0) only', () => {
    expect(out).toMatch(/^m=audio \d+ RTP\/AVP 0$/m);
    expect(out).not.toMatch(/UDP\/TLS\/RTP\/SAVPF/);
  });

  it('removes every m=video section entirely', () => {
    expect(out).not.toMatch(/m=video/);
    expect(out).not.toMatch(/VP8/);
  });

  it('removes DTLS / SRTP lines', () => {
    expect(out).not.toMatch(/a=fingerprint/);
    expect(out).not.toMatch(/a=setup/);
    expect(out).not.toMatch(/a=dtls-id/);
    expect(out).not.toMatch(/a=crypto/);
  });

  it('removes every ICE artifact', () => {
    expect(out).not.toMatch(/a=ice-ufrag/);
    expect(out).not.toMatch(/a=ice-pwd/);
    expect(out).not.toMatch(/a=ice-options/);
    expect(out).not.toMatch(/a=candidate:/);
    expect(out).not.toMatch(/a=end-of-candidates/);
  });

  it('keeps only the PCMU rtpmap/fmtp entries', () => {
    const rtpmaps = out.match(/^a=rtpmap:(\d+) /gm) || [];
    const pts = rtpmaps.map((l) => l.match(/^a=rtpmap:(\d+) /)![1]);
    expect(new Set(pts)).toEqual(new Set(['0']));
    expect(out).not.toMatch(/a=rtpmap:111/);
    expect(out).not.toMatch(/a=fmtp:111/);
  });

  it('strips rtcp-fb, extmap, msid, ssrc and mid lines', () => {
    expect(out).not.toMatch(/a=rtcp-fb/);
    expect(out).not.toMatch(/a=extmap/);
    expect(out).not.toMatch(/a=msid/);
    expect(out).not.toMatch(/a=ssrc/);
    expect(out).not.toMatch(/a=mid:/);
  });
});
