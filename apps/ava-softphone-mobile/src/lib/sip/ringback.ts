// Local ringback tone generator (North-American cadence: 2s on / 4s off,
// 440 + 480 Hz). Used when the PBX does not send early media so the user
// hears that the call is actually ringing.
let ctx: AudioContext | null = null;
let oscA: OscillatorNode | null = null;
let oscB: OscillatorNode | null = null;
let gain: GainNode | null = null;
let cadenceId: ReturnType<typeof setInterval> | null = null;
let running = false;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

/**
 * Prime the AudioContext synchronously during a user gesture (e.g. the call
 * button tap). iOS Safari/WKWebView only allows AudioContext creation inside
 * a gesture handler; calling this here guarantees ringback can play later
 * even though the actual oscillator nodes are created asynchronously after
 * the SIP stack starts the INVITE.
 */
export function primeRingbackContext(): void {
  void ensureCtx();
}

export function startRingback() {
  if (running) return;
  const c = ensureCtx();
  if (!c) return;
  running = true;
  try {
    gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(c.destination);
    oscA = c.createOscillator(); oscA.frequency.value = 440; oscA.connect(gain); oscA.start();
    oscB = c.createOscillator(); oscB.frequency.value = 480; oscB.connect(gain); oscB.start();

    const ON = 2000, OFF = 4000;
    const ramp = (target: number) => {
      if (!gain || !ctx) return;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.05);
    };
    ramp(0.08);
    const tick = () => { ramp(0); setTimeout(() => running && ramp(0.08), OFF); };
    cadenceId = setInterval(tick, ON + OFF);
    setTimeout(tick, ON);
  } catch (e) {
    console.warn('[ringback] start failed', e);
    stopRingback();
  }
}

export function stopRingback() {
  running = false;
  if (cadenceId) { clearInterval(cadenceId); cadenceId = null; }
  try { oscA?.stop(); } catch {} try { oscB?.stop(); } catch {}
  try { oscA?.disconnect(); oscB?.disconnect(); gain?.disconnect(); } catch {}
  oscA = oscB = null; gain = null;
}

export function describeEndReason(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const r = String(raw).toLowerCase();
  if (r.includes('486') || r.includes('busy')) return 'Ligne occupée';
  if (r.includes('603') || r.includes('decline')) return 'Appel refusé';
  if (r.includes('480') || r.includes('unavailable')) return 'Destinataire indisponible';
  if (r.includes('408') || r.includes('timeout') || r.includes('request timeout')) return 'Pas de réponse';
  if (r.includes('487') || r.includes('cancel')) return 'Appel annulé';
  if (r.includes('404')) return 'Numéro introuvable';
  if (r.includes('403')) return 'Appel interdit';
  if (r.includes('remote_bye')) return 'Le correspondant a raccroché';
  if (r.includes('local_hangup')) return null; // user initiated
  if (r.includes('5') && /\b5\d\d\b/.test(r)) return 'Erreur serveur PBX';
  return null;
}
