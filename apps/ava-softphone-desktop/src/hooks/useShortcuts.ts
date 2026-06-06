/**
 * Global keyboard shortcuts for the desktop console.
 *
 *   ⌘/Ctrl + K     — Command palette (handled in ConsoleLayout)
 *   ⌘/Ctrl + M     — Toggle mute on the active call
 *   ⌘/Ctrl + H     — Toggle hold
 *   Enter (incoming) — Answer
 *   Esc            — Hang up / dismiss incoming
 */
import { useEffect } from 'react';
import { callBus } from './useCallBus';

export function useCallShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = callBus.get();
      if (!c) return;
      const mod = e.metaKey || e.ctrlKey;

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
