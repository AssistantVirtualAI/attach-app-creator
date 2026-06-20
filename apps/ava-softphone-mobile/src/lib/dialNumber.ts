/**
 * Lance un appel UNIQUEMENT via le softphone SIP intégré.
 * On n'utilise plus jamais le composeur natif (tel:) — toute la voix passe
 * par le canal SIP/WebRTC de l'application pour garantir la qualité audio
 * (noise cancellation, codec Opus FEC/DTX, etc.).
 */
import { showMobileToast } from './mobileToast';

export type SoftphoneLike = {
  call?: (n: string) => boolean | void;
  reconnect?: () => void;
  snap?: { status?: string };
};

const sanitize = (raw: string) => raw.replace(/[^\d+*#]/g, '');

export function dialNumber(sp: SoftphoneLike | null | undefined, rawNumber: string | null | undefined): boolean {
  const number = sanitize(String(rawNumber || ''));
  if (!number) {
    showMobileToast('Numéro invalide', 'error');
    return false;
  }
  if (!sp || typeof sp.call !== 'function') {
    showMobileToast('Téléphone non initialisé', 'error');
    return false;
  }
  const status = sp.snap?.status;
  const sipReady = status === 'registered' || status === 'active' || status === 'ringing';
  if (!sipReady) {
    showMobileToast('Téléphone non connecté — reconnexion en cours…', 'error');
    try { sp.reconnect?.(); } catch {}
    return false;
  }
  try {
    const r = sp.call(number);
    if (r === false) {
      showMobileToast("Impossible de lancer l'appel SIP", 'error');
      return false;
    }
    return true;
  } catch (e: any) {
    showMobileToast(e?.message || "Échec de l'appel SIP", 'error');
    return false;
  }
}
