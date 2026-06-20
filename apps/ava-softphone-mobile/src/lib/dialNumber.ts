/**
 * Lance un appel sur le bon canal :
 *  1. Essaie le softphone SIP si disponible (sp.call retourne true).
 *  2. Sinon, ouvre le composeur natif via `tel:` (Capacitor / navigateur).
 *
 * `sp.call` peut retourner `boolean | void`. On considère `false` ou une
 * exception comme un échec et on tombe alors sur `tel:`.
 */
import { showMobileToast } from './mobileToast';

export type SoftphoneLike = {
  call?: (n: string) => boolean | void;
  snap?: { status?: string };
};

const sanitize = (raw: string) => raw.replace(/[^\d+*#]/g, '');

export function dialNumber(sp: SoftphoneLike | null | undefined, rawNumber: string | null | undefined): boolean {
  const number = sanitize(String(rawNumber || ''));
  if (!number) {
    showMobileToast('Numéro invalide', 'error');
    return false;
  }
  // 1) SIP if registered.
  const sipReady = sp?.snap?.status === 'registered' || sp?.snap?.status === 'active' || sp?.snap?.status === 'ringing';
  if (sipReady && typeof sp?.call === 'function') {
    try {
      const r = sp.call(number);
      if (r !== false) return true;
    } catch { /* fallthrough to tel: */ }
  }
  // 2) Fallback: system dialer.
  try {
    // Capacitor WebView and mobile browsers handle `tel:` natively.
    window.location.href = `tel:${number}`;
    return true;
  } catch (e: any) {
    showMobileToast(e?.message || 'Impossible de lancer l\'appel', 'error');
    return false;
  }
}
