import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Lang = 'en' | 'fr';

const DICT = {
  en: {
    'common.signOut': 'Sign out',
    'common.on': 'On',
    'common.off': 'Off',
    'common.none': 'None',
    'common.copy': 'Copy',
    'common.clear': 'Clear',
    'common.openSettings': 'Open device settings',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.today': 'Today',
    'common.range7d': '7 days',
    'common.range30d': '30 days',

    'header.callHistory': 'Call history',
    'header.toggleTheme': 'Toggle theme',
    'header.toggleLang': 'Switch language',

    'dashboard.domain': 'Domain',
    'dashboard.myActivity': 'My activity',
    'dashboard.myExtension': 'My extension',
    'dashboard.breakdown': 'Breakdown',
    'dashboard.domainMetrics': 'Domain metrics',
    'dashboard.myMetrics': 'My metrics',
    'dashboard.callsPerDay': 'Calls per day',
    'dashboard.topExtensions': 'Top extensions',
    'dashboard.insights': 'Insights',
    'dashboard.avaAssistant': 'AVA assistant',
    'dashboard.avaSummary': 'AVA summary',
    'dashboard.openChat': 'Open chat',
    'dashboard.noActivity': 'No activity in this range.',
    'dashboard.greeting': 'Hi,',
    'dashboard.callsLine': '{total} calls · {answered} answered · {missed} missed.',

    'm.totalCalls': 'Total calls',
    'm.answered': 'Answered',
    'm.missed': 'Missed',
    'm.voicemails': 'Voicemails',
    'm.answerRate': 'Answer rate',
    'm.avgDuration': 'Avg duration',
    'm.totalTalk': 'Total talk',
    'm.peakHour': 'Peak hour',
    'm.outbound': 'Outbound',
    'm.failedDials': 'Failed dials',
    'm.dialSuccess': 'Dial success',
    'm.activeExt': 'Active ext.',
    'm.myCalls': 'My calls',
    'm.myAnswered': 'My answered',
    'm.myMissed': 'My missed',
    'm.myVoicemails': 'My voicemails',
    'm.myRecordings': 'My recordings',
    'm.myAvgDuration': 'My avg duration',
    'm.answerRateLabel': 'Answer rate',
    'm.direction': 'Direction',
    'm.inbound': 'Inbound',
    'm.outboundLong': 'Outbound',
    'm.talkTime': 'Talk time',
    'm.avg': 'avg',
    'm.target': 'target',

    'settings.profile': 'Profile',
    'settings.admin': 'Domain admin',
    'settings.user': 'User',
    'settings.calling': 'Calling',
    'settings.availability': 'Availability',
    'settings.dnd': 'Do not disturb',
    'settings.callForwarding': 'Call forwarding',
    'settings.voicemailGreeting': 'Voicemail greeting',
    'settings.account': 'Account',
    'settings.extDevices': 'Extension & devices',
    'settings.extension': 'Extension',
    'settings.sipDomain': 'SIP domain',
    'settings.client': 'Client',
    'settings.dataScope': 'Data scope',
    'settings.role': 'Role',
    'settings.devices': 'Devices',
    'settings.notifications': 'Notifications',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',
    'settings.diagnostics': 'Diagnostics',
    'settings.about': 'About',
    'settings.privacy': 'Privacy',
    'settings.permissions': 'Permissions',
    'settings.security': 'Security & data',
    'settings.adminTitle': 'Workspace controls',
    'settings.workspace': 'Admin',
    'settings.usersExt': 'Users & extensions',
    'settings.phoneNumbers': 'Phone numbers',
    'settings.ivrs': 'IVRs, queues & routing',
    'settings.voiceAgents': 'Voice agents',
    'settings.syncStatus': 'Sync status',
    'settings.openPortal': 'Open portal',
    'settings.audioOutput': 'Audio output',
    'settings.ringtone': 'Ringtone',
    'settings.haptics': 'Haptics',
    'settings.autoAnswer': 'Auto-answer',
    'settings.clearCache': 'Clear app cache',
    'settings.signOut': 'Sign out',
    'settings.helpSupport': 'Help & support',
    'settings.privacyPolicy': 'Privacy policy',
    'settings.termsOfService': 'Terms of service',
    'settings.dataSafety': 'Data safety',
    'settings.deleteAccount': 'Delete account',
    'settings.version': 'Version',
    'settings.scopeDomain': 'Domain-wide PBX',
    'settings.scopeOwn': 'Own extension only',
    'settings.pushEnabled': 'Push enabled',
    'settings.pushDisabled': 'Push disabled',
    'settings.defaultGreeting': 'Default · Lemtel AVA',
  },
  fr: {
    'common.signOut': 'Déconnexion',
    'common.on': 'Activé',
    'common.off': 'Désactivé',
    'common.none': 'Aucun',
    'common.copy': 'Copier',
    'common.clear': 'Effacer',
    'common.openSettings': "Ouvrir les paramètres de l'appareil",
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.today': "Aujourd'hui",
    'common.range7d': '7 jours',
    'common.range30d': '30 jours',

    'header.callHistory': 'Historique des appels',
    'header.toggleTheme': 'Changer de thème',
    'header.toggleLang': 'Changer de langue',

    'dashboard.domain': 'Domaine',
    'dashboard.myActivity': 'Mon activité',
    'dashboard.myExtension': 'Mon extension',
    'dashboard.breakdown': 'Détails',
    'dashboard.domainMetrics': 'Statistiques du domaine',
    'dashboard.myMetrics': 'Mes statistiques',
    'dashboard.callsPerDay': 'Appels par jour',
    'dashboard.topExtensions': 'Meilleures extensions',
    'dashboard.insights': 'Aperçus',
    'dashboard.avaAssistant': 'Assistant AVA',
    'dashboard.avaSummary': 'Résumé AVA',
    'dashboard.openChat': 'Ouvrir le chat',
    'dashboard.noActivity': 'Aucune activité dans cette période.',
    'dashboard.greeting': 'Bonjour,',
    'dashboard.callsLine': '{total} appels · {answered} répondus · {missed} manqués.',

    'm.totalCalls': 'Appels totaux',
    'm.answered': 'Répondus',
    'm.missed': 'Manqués',
    'm.voicemails': 'Messageries',
    'm.answerRate': 'Taux de réponse',
    'm.avgDuration': 'Durée moy.',
    'm.totalTalk': 'Temps total',
    'm.peakHour': 'Heure de pointe',
    'm.outbound': 'Sortants',
    'm.failedDials': 'Échecs d\'appel',
    'm.dialSuccess': 'Succès d\'appel',
    'm.activeExt': 'Ext. actives',
    'm.myCalls': 'Mes appels',
    'm.myAnswered': 'Mes répondus',
    'm.myMissed': 'Mes manqués',
    'm.myVoicemails': 'Mes messageries',
    'm.myRecordings': 'Mes enregistrements',
    'm.myAvgDuration': 'Ma durée moy.',
    'm.answerRateLabel': 'Taux de réponse',
    'm.direction': 'Direction',
    'm.inbound': 'Entrants',
    'm.outboundLong': 'Sortants',
    'm.talkTime': 'Temps de parole',
    'm.avg': 'moy.',
    'm.target': 'cible',

    'settings.profile': 'Profil',
    'settings.admin': 'Admin du domaine',
    'settings.user': 'Utilisateur',
    'settings.calling': 'Appels',
    'settings.availability': 'Disponibilité',
    'settings.dnd': 'Ne pas déranger',
    'settings.callForwarding': "Transfert d'appel",
    'settings.voicemailGreeting': 'Message de messagerie',
    'settings.account': 'Compte',
    'settings.extDevices': 'Extension et appareils',
    'settings.extension': 'Extension',
    'settings.sipDomain': 'Domaine SIP',
    'settings.client': 'Client',
    'settings.dataScope': 'Portée des données',
    'settings.role': 'Rôle',
    'settings.devices': 'Appareils',
    'settings.notifications': 'Notifications',
    'settings.appearance': 'Apparence',
    'settings.theme': 'Thème',
    'settings.language': 'Langue',
    'settings.themeDark': 'Sombre',
    'settings.themeLight': 'Clair',
    'settings.diagnostics': 'Diagnostics',
    'settings.about': 'À propos',
    'settings.privacy': 'Confidentialité',
    'settings.permissions': 'Permissions',
    'settings.security': 'Sécurité et données',
    'settings.adminTitle': 'Contrôles administrateur',
    'settings.workspace': 'Admin',
    'settings.usersExt': 'Utilisateurs et extensions',
    'settings.phoneNumbers': 'Numéros de téléphone',
    'settings.ivrs': 'SVI, files et routage',
    'settings.voiceAgents': 'Agents vocaux',
    'settings.syncStatus': 'État de synchronisation',
    'settings.openPortal': 'Ouvrir le portail',
    'settings.audioOutput': 'Sortie audio',
    'settings.ringtone': 'Sonnerie',
    'settings.haptics': 'Vibrations',
    'settings.autoAnswer': 'Réponse automatique',
    'settings.clearCache': "Vider le cache de l'application",
    'settings.signOut': 'Déconnexion',
    'settings.helpSupport': 'Aide et support',
    'settings.privacyPolicy': 'Politique de confidentialité',
    'settings.termsOfService': "Conditions d'utilisation",
    'settings.dataSafety': 'Sécurité des données',
    'settings.deleteAccount': 'Supprimer le compte',
    'settings.version': 'Version',
    'settings.scopeDomain': 'PBX complet du domaine',
    'settings.scopeOwn': 'Mon extension uniquement',
    'settings.pushEnabled': 'Notifications activées',
    'settings.pushDisabled': 'Notifications désactivées',
    'settings.defaultGreeting': 'Par défaut · Lemtel AVA',
  },
} as const;

type Key = keyof typeof DICT['en'];

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
}

const I18nCtx = createContext<Ctx | null>(null);
const STORAGE = 'ava.mobile.lang';

export function MobileI18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE);
      if (stored === 'en' || stored === 'fr') return stored;
      return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
    } catch { return 'en'; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE, lang); } catch {}
  }, [lang]);

  const t: Ctx['t'] = (key, vars) => {
    let v = (DICT[lang] as any)[key] ?? (DICT.en as any)[key] ?? key;
    if (vars) for (const [k, val] of Object.entries(vars)) v = v.replace(`{${k}}`, String(val));
    return v;
  };

  return (
    <I18nCtx.Provider value={{ lang, setLang: setLangState, toggle: () => setLangState((l) => (l === 'fr' ? 'en' : 'fr')), t }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useT() {
  const c = useContext(I18nCtx);
  if (!c) {
    // Fallback when used outside provider (e.g. in tests)
    return { lang: 'en' as Lang, setLang: () => {}, toggle: () => {}, t: ((k: Key) => (DICT.en as any)[k] ?? k) as Ctx['t'] };
  }
  return c;
}
