/**
 * Global keyboard shortcuts for the desktop console.
 *
 *   ⌘/Ctrl + K          — Command palette (handled in ConsoleLayout)
 *   ⌘/Ctrl + 1..9       — Jump to a sidebar view
 *   ⌘/Ctrl + Shift + D  — Open dialer
 *   ⌘/Ctrl + Shift + C  — Open contacts
 *   ⌘/Ctrl + M          — Toggle mute on the active call
 *   ⌘/Ctrl + H          — Toggle hold
 *   ⌘/Ctrl + Enter      — Dial the number currently in the pad
 *   Enter (incoming)    — Answer
 *   Esc                 — Hang up / dismiss incoming
 */
import { useEffect } from 'react';
import { callBus } from './useCallBus';

const NAV_ORDER = ['home','dialer','calls','messages','voicemail','recordings','ai','contacts','admin'] as const;

export function emitNav(view: string) {
  window.dispatchEvent(new CustomEvent('lemtel:nav', { detail: view }));
}
export function emitDialNow() {
  window.dispatchEvent(new CustomEvent('lemtel:dial-now'));
}

export function useCallShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (NAV_ORDER[idx]) { e.preventDefault(); emitNav(NAV_ORDER[idx]); return; }
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault(); emitNav('dialer'); return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault(); emitNav('contacts'); return;
      }
      if (mod && e.key === 'Enter') {
        e.preventDefault(); emitDialNow(); return;
      }

      const c = callBus.get();
      if (!c) return;

      if (mod && e.key.toLowerCase() === 'm' && (c.status === 'active' || c.status === 'held')) {
        e.preventDefault();
        callBus.mute(!c.muted);
      } else if (mod && e.key.toLowerCase() === 'h' && (c.status === 'active' || c.status === 'held')) {
        e.preventDefault();
        callBus.hold(c.status !== 'held');
      } else if (e.key === 'Enter' && c.status === 'incoming') {
        e.preventDefault();
        callBus.answer();
      } else if (e.key === 'Escape' && (c.status === 'incoming' || c.status === 'active' || c.status === 'held')) {
        e.preventDefault();
        callBus.hangup();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
