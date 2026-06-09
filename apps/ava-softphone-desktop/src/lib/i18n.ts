// Lightweight i18n for the desktop app (independent of the main web portal).
// Persists language choice to localStorage ('lemtel:lang') and exposes a hook
// + helper for non-React callers.

import { useEffect, useState, useCallback } from 'react';

export type DesktopLang = 'en' | 'fr';
const STORAGE_KEY = 'lemtel:lang';

const en = {
  // Nav (LeftRail)
  'nav.home': 'Home',
  'nav.dialer': 'Dialer',
  'nav.calls': 'Calls',
  'nav.messages': 'Messages',
  'nav.voicemail': 'Voicemail',
  'nav.recordings': 'Recordings',
  'nav.ai': 'AVA AI',
  'nav.contacts': 'Contacts',
  'nav.admin': 'Admin',
  'nav.settings': 'Settings',
  'nav.telecom': 'Telecom',
  'nav.orgchat': 'Org Chat',
  'nav.aiadmin': 'AI Admin',
  'nav.reports': 'Reports',
  'nav.search': 'Search',

  // Status pills
  'status.connected': 'Connected',
  'status.registered': 'Registered',
  'status.syncPending': 'Sync pending',
  'status.syncFailed': 'Sync failed',
  'status.notConfigured': 'Not configured',
  'status.online': 'Online',
  'status.offline': 'Offline',
  'status.busy': 'Busy',
  'status.dnd': 'Do not disturb',
  'status.away': 'Away',

  // State view
  'state.loading': 'Loading…',
  'state.empty': 'Nothing here yet',
  'state.error': 'Something went wrong',
  'state.retry': 'Retry',

  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
} as const;

const fr: Record<keyof typeof en, string> = {
  'nav.home': 'Accueil',
  'nav.dialer': 'Clavier',
  'nav.calls': 'Appels',
  'nav.messages': 'Messages',
  'nav.voicemail': 'Messagerie',
  'nav.recordings': 'Enregistrements',
  'nav.ai': 'AVA IA',
  'nav.contacts': 'Contacts',
  'nav.admin': 'Admin',
  'nav.settings': 'Paramètres',
  'nav.telecom': 'Télécom',
  'nav.orgchat': 'Chat équipe',
  'nav.aiadmin': 'IA Admin',
  'nav.reports': 'Rapports',
  'nav.search': 'Rechercher',

  'status.connected': 'Connecté',
  'status.registered': 'Enregistré',
  'status.syncPending': 'Sync en cours',
  'status.syncFailed': 'Sync échouée',
  'status.notConfigured': 'Non configuré',
  'status.online': 'En ligne',
  'status.offline': 'Hors ligne',
  'status.busy': 'Occupé',
  'status.dnd': 'Ne pas déranger',
  'status.away': 'Absent',

  'state.loading': 'Chargement…',
  'state.empty': 'Rien pour l’instant',
  'state.error': 'Une erreur est survenue',
  'state.retry': 'Réessayer',

  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.confirm': 'Confirmer',
  'common.delete': 'Supprimer',
  'common.edit': 'Modifier',
};

const dict: Record<DesktopLang, Record<string, string>> = { en, fr };
export type I18nKey = keyof typeof en;

function readLang(): DesktopLang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'fr' || v === 'en') return v;
  } catch { /* noop */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en';
  return nav.startsWith('fr') ? 'fr' : 'en';
}

export function getLang(): DesktopLang { return readLang(); }

export function setLang(lang: DesktopLang) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent('lemtel:lang', { detail: lang }));
}

export function t(key: I18nKey, lang: DesktopLang = readLang()): string {
  return dict[lang][key] ?? dict.en[key] ?? key;
}

export function useTranslation() {
  const [lang, setLangState] = useState<DesktopLang>(readLang);
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as DesktopLang;
      if (detail === 'en' || detail === 'fr') setLangState(detail);
    };
    window.addEventListener('lemtel:lang', onChange as EventListener);
    return () => window.removeEventListener('lemtel:lang', onChange as EventListener);
  }, []);
  const translate = useCallback((key: I18nKey) => t(key, lang), [lang]);
  return { t: translate, lang, setLang: (l: DesktopLang) => { setLang(l); setLangState(l); } };
}
