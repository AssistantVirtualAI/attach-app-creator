// Simple Web Audio ringtone player — no audio files needed.
export class RingtonePlayer {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  start() {
    if (this.timer) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = () => {
        if (!this.ctx) return;
        this.osc = this.ctx.createOscillator();
        this.gain = this.ctx.createGain();
        this.osc.frequency.value = 440;
        this.osc.type = "sine";
        this.gain.gain.value = 0.15;
        this.osc.connect(this.gain).connect(this.ctx.destination);
        this.osc.start();
        setTimeout(() => {
          try { this.osc?.stop(); } catch {}
        }, 1000);
      };
      beep();
      this.timer = setInterval(beep, 1500);
    } catch (e) {
      console.warn("RingtonePlayer failed", e);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try { this.osc?.stop(); } catch {}
    try { this.ctx?.close(); } catch {}
    this.ctx = null;
    this.osc = null;
    this.gain = null;
  }
}

export const ringtone = new RingtonePlayer();
