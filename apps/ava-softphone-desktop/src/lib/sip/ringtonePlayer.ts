// Web Audio ringtone — no audio file needed.
export class RingtonePlayer {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private osc: OscillatorNode | null = null;

  start() {
    if (this.timer) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = () => {
        if (!this.ctx) return;
        this.osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        this.osc.frequency.value = 440;
        this.osc.type = 'sine';
        gain.gain.value = 0.15;
        this.osc.connect(gain).connect(this.ctx.destination);
        this.osc.start();
        setTimeout(() => { try { this.osc?.stop(); } catch { /* noop */ } }, 800);
      };
      beep();
      this.timer = setInterval(beep, 1400);
    } catch {
      /* noop */
    }
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    try { this.osc?.stop(); } catch { /* noop */ }
    try { this.ctx?.close(); } catch { /* noop */ }
    this.ctx = null;
    this.osc = null;
  }
}

export const ringtone = new RingtonePlayer();
