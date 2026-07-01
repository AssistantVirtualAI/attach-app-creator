// Lightweight i18n for the desktop app (independent of the main web portal).
// Persists language choice to localStorage ('lemtel:lang') and exposes a hook
// + helper for non-React callers.

import { useEffect, useState, useCallback } from 'react';

export type DesktopLang = 'en' | 'fr';
const STORAGE_KEY = 'lemtel:lang';

const en = {
  // Nav (LeftRail)
  'nav.home': 'Home',
  'nav.dialer': 'Phone',
  'nav.calls': 'Call History',
  'nav.messages': 'SMS',
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
  'nav.pbxlive': 'PBX Live',
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
  'common.send': 'Send',
  'common.reject': 'Reject',

  // Telecom settings
  'telecom.title': 'Telecom Settings',
  'telecom.workingHours': 'Working Hours',
  'telecom.handling': 'Availability & Call Handling',
  'telecom.availability': 'Availability',
  'telecom.afterHours': 'After-hours',
  'telecom.extension': 'Extension',
  'telecom.externalNumber': 'External number',
  'telecom.saveSchedule': 'Save schedule',
  'telecom.resetDefault': 'Reset to org default',
  'telecom.saveHandling': 'Save handling',
  'telecom.on': 'On',

  // Days
  'day.sun': 'Sun', 'day.mon': 'Mon', 'day.tue': 'Tue',
  'day.wed': 'Wed', 'day.thu': 'Thu', 'day.fri': 'Fri', 'day.sat': 'Sat',

  // OrgChat
  'orgchat.channels': 'Channels',
  'orgchat.noChannels': 'No channels yet',
  'orgchat.searchPlaceholder': 'Search messages…',
  'orgchat.messagePlaceholder': 'Message…',
  'orgchat.selectChannel': 'Select a channel',
  'orgchat.sayHi': 'No messages yet — say hi 👋',
  'orgchat.noMatches': 'No matches',

  // Admin AI
  'aiadmin.title': 'AVA AI · Telecom Admin',
  'aiadmin.subtitle': 'Ask AVA to manage business hours, holidays, IVRs, users, DIDs, queues. Every change requires explicit confirmation.',
  'aiadmin.placeholder': 'Tell AVA what to change…',
  'aiadmin.propose': 'Propose',
  'aiadmin.confirmExecute': 'Confirm & execute',
  'aiadmin.adminOnly': 'Admin-only area.',
  'aiadmin.awaiting': 'Awaiting confirm',
  'aiadmin.executing': 'Executing…',
  'aiadmin.executed': 'Executed',
  'aiadmin.failed': 'Failed',
  'aiadmin.rejected': 'Rejected',

  // Reports
  'reports.title': 'Reports',
  'reports.eyebrow': 'Insights',
  'reports.subtitle': 'Call volume, performance, and AVA-generated executive summaries.',
  'reports.noCalls': 'No calls in this range',
  'reports.noCallsHint': 'Adjust the range or wait for call activity.',
  'reports.avaSummary': 'AVA Summary',
  'reports.generating': 'Generating…',
  'reports.totalCalls': 'Total calls',
  'reports.answered': 'Answered',
  'reports.missed': 'Missed',
  'reports.inbound': 'Inbound',
  'reports.outbound': 'Outbound',
  'reports.avgDuration': 'Avg duration',
  'reports.totalTalk': 'Total talk time',
  'reports.topExtensions': 'Top extensions',
  'reports.recentCalls': 'Recent calls',
  'reports.calls': 'calls',

  // Home dashboard
  'home.commandCenter': 'Command Center',
  'home.morning': 'Good morning',
  'home.afternoon': 'Good afternoon',
  'home.evening': 'Good evening',
  'home.subtitle': 'Live CDR, recordings, voicemail and AVA insights for your extension.',
  'home.ext': 'Ext',
  'home.pbxOnline': 'PBX Online',
  'home.pbxError': 'PBX Error',
  'home.connecting': 'Connecting',
  'home.syncLive': 'Sync Live',
  'home.syncOffline': 'Sync Offline',
  'home.range': 'Range',
  'home.rangeToday': 'Today',
  'home.rangeWeek': '7 days',
  'home.rangeMonth': '30 days',
  'home.rangeCustom': 'Custom',
  'home.rangeTodayLong': 'Today',
  'home.rangeWeekLong': 'Last 7 days',
  'home.rangeMonthLong': 'Last 30 days',
  'home.brief': 'Live Phone-System Brief',
  'home.loadingBrief': 'Loading the live PBX picture…',
  'home.callSingular': 'call',
  'home.callPlural': 'calls',
  'home.answered': 'answered',
  'home.missed': 'missed',
  'home.recordingSingular': 'recording',
  'home.recordingPlural': 'recordings',
  'home.latestCdr': 'Latest CDR',
  'home.noCdrYet': 'No CDR yet',
  'home.justNow': 'just now',
  'home.minAgo': 'min ago',
  'home.hoursAgo': 'h ago',
  'home.cdrFreshness': 'CDR freshness',
  'home.recordingCoverage': 'Recording coverage',
  'home.couldNotLoad': 'Could not load stats',
  'home.retry': 'Retry',
  'home.calls': 'Calls',
  'home.tileMissed': 'Missed',
  'home.tileAnswered': 'Answered',
  'home.tileRecordings': 'Recordings',
  'home.tileUnreadSms': 'Unread SMS',
  'home.tileVoicemail': 'Voicemail',
  'home.tileLiveCalls': 'Live Calls',
  'home.tileRealtime': 'Realtime',
  'home.scopedExt': 'Scoped to extension',
  'home.allThreads': 'All threads',
  'home.needsReview': 'Needs review',
  'home.inProgress': 'In progress',
  'home.live': 'Live',
  'home.off': 'Off',
  'home.idle': 'Idle',
  'home.latest': 'Latest',
  'home.noneInRange': 'None in range',
  'home.quickActions': 'Quick Actions',
  'home.newCall': 'New Call',
  'home.callHistory': 'Call History',
  'home.recordings': 'Recordings',
  'home.messages': 'SMS',
  'home.pbxLive': 'PBX Live',
  'home.pbxAdmin': 'PBX Admin',
  'home.aiAssistant': 'AI Assistant',
  'home.needsAttention': 'Needs Attention',
  'home.noActivity': 'no activity',
  'home.trendUnavailable': '⚠ trend unavailable',
  'home.clickToRetry': 'Could not load · click to retry',
} as const;

const fr: Record<keyof typeof en, string> = {
  'nav.home': 'Accueil',
  'nav.dialer': 'Téléphone',
  'nav.calls': 'Historique d’appels',
  'nav.messages': 'SMS',
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
  'nav.pbxlive': 'PBX Live',
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
  'common.send': 'Envoyer',
  'common.reject': 'Rejeter',

  'telecom.title': 'Paramètres télécom',
  'telecom.workingHours': 'Heures de travail',
  'telecom.handling': 'Disponibilité et gestion des appels',
  'telecom.availability': 'Disponibilité',
  'telecom.afterHours': 'Hors heures',
  'telecom.extension': 'Poste',
  'telecom.externalNumber': 'Numéro externe',
  'telecom.saveSchedule': 'Enregistrer l’horaire',
  'telecom.resetDefault': 'Réinitialiser au défaut',
  'telecom.saveHandling': 'Enregistrer la gestion',
  'telecom.on': 'Actif',

  'day.sun': 'Dim', 'day.mon': 'Lun', 'day.tue': 'Mar',
  'day.wed': 'Mer', 'day.thu': 'Jeu', 'day.fri': 'Ven', 'day.sat': 'Sam',

  'orgchat.channels': 'Canaux',
  'orgchat.noChannels': 'Aucun canal',
  'orgchat.searchPlaceholder': 'Rechercher des messages…',
  'orgchat.messagePlaceholder': 'Message…',
  'orgchat.selectChannel': 'Choisissez un canal',
  'orgchat.sayHi': 'Aucun message — dites bonjour 👋',
  'orgchat.noMatches': 'Aucun résultat',

  'aiadmin.title': 'AVA IA · Admin télécom',
  'aiadmin.subtitle': 'Demandez à AVA de gérer horaires, congés, SVI, utilisateurs, numéros, files. Chaque changement requiert une confirmation explicite.',
  'aiadmin.placeholder': 'Dites à AVA ce qu’il faut changer…',
  'aiadmin.propose': 'Proposer',
  'aiadmin.confirmExecute': 'Confirmer et exécuter',
  'aiadmin.adminOnly': 'Zone réservée aux admins.',
  'aiadmin.awaiting': 'En attente de confirmation',
  'aiadmin.executing': 'Exécution…',
  'aiadmin.executed': 'Exécuté',
  'aiadmin.failed': 'Échec',
  'aiadmin.rejected': 'Rejeté',

  'reports.title': 'Rapports',
  'reports.eyebrow': 'Analyses',
  'reports.subtitle': 'Volume d’appels, performance et résumés exécutifs générés par AVA.',
  'reports.noCalls': 'Aucun appel sur cette période',
  'reports.noCallsHint': 'Ajustez la période ou attendez de l’activité.',
  'reports.avaSummary': 'Résumé AVA',
  'reports.generating': 'Génération…',
  'reports.totalCalls': 'Appels totaux',
  'reports.answered': 'Répondus',
  'reports.missed': 'Manqués',
  'reports.inbound': 'Entrants',
  'reports.outbound': 'Sortants',
  'reports.avgDuration': 'Durée moy.',
  'reports.totalTalk': 'Temps de parole',
  'reports.topExtensions': 'Top postes',
  'reports.recentCalls': 'Appels récents',
  'reports.calls': 'appels',
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
