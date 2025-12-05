import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
] as const;

// Inline translations to avoid JSON import issues
const frTranslation = {
  common: {
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    add: "Ajouter",
    create: "Créer",
    loading: "Chargement...",
    error: "Erreur",
    success: "Succès",
    confirm: "Confirmer",
    search: "Rechercher",
    filter: "Filtrer",
    export: "Exporter",
    refresh: "Actualiser",
    close: "Fermer"
  },
  nav: {
    home: "Maison",
    dashboard: "Tableau de bord",
    conversations: "Conversations",
    analytics: "Analytiques",
    knowledgeBase: "Base de connaissances",
    agents: "Agents",
    clients: "Clients",
    integrations: "Intégrations",
    webhooks: "Webhooks",
    billing: "Facturation",
    settings: "Paramètres"
  },
  dashboard: {
    title: "Tableau de bord",
    subtitle: "Vue d'ensemble de votre activité",
    totalConversations: "Conversations",
    todayConversations: "aujourd'hui",
    thisWeek: "cette semaine",
    avgDuration: "Durée moyenne",
    avgSatisfaction: "Satisfaction",
    activeClients: "Clients actifs",
    totalAgents: "agents",
    totalMinutes: "Minutes totales",
    resolutionRate: "Taux de résolution",
    avgInteractions: "Interactions moyennes",
    quickActions: "Actions rapides",
    viewAllConversations: "Voir toutes les conversations",
    manageClients: "Gérer les clients",
    configureIntegrations: "Configurer les intégrations",
    newAgent: "Nouvel agent",
    recentActivity: "Activité récente"
  },
  auth: {
    login: "Connexion",
    register: "Inscription",
    logout: "Déconnexion",
    forgotPassword: "Mot de passe oublié ?"
  },
  clients: {
    title: "Clients",
    subtitle: "Gérez vos clients et leurs accès",
    addClient: "Ajouter un client"
  },
  agents: {
    title: "Agents",
    subtitle: "Configurez vos agents vocaux",
    addAgent: "Ajouter un agent"
  },
  conversations: {
    title: "Conversations",
    subtitle: "Historique des conversations",
    exportCSV: "Exporter CSV",
    exportPDF: "Exporter PDF"
  },
  analytics: {
    title: "Analytiques",
    subtitle: "Statistiques et rapports",
    workspaceMetrics: "Métriques Workspace",
    clientMetrics: "Métriques Client"
  },
  webhooks: {
    title: "Webhooks",
    subtitle: "Configurez vos webhooks sortants",
    addEndpoint: "Ajouter un endpoint",
    url: "URL",
    secret: "Secret",
    events: "Événements",
    status: "Statut",
    active: "Actif",
    inactive: "Inactif",
    deliveryLogs: "Logs de livraison",
    noEndpoints: "Aucun endpoint configuré",
    eventTypes: {
      "conversation.created": "Conversation créée",
      "conversation.completed": "Conversation terminée",
      "agent.created": "Agent créé",
      "agent.updated": "Agent mis à jour",
      "client.created": "Client créé",
      "subscription.updated": "Abonnement mis à jour"
    }
  },
  settings: {
    title: "Paramètres",
    subtitle: "Configurez votre espace de travail",
    language: "Langue",
    selectLanguage: "Sélectionner la langue"
  },
  billing: {
    title: "Facturation",
    subtitle: "Gérez votre abonnement"
  },
  filters: {
    dateRange: "Période",
    today: "Aujourd'hui",
    last7Days: "7 derniers jours",
    last30Days: "30 derniers jours",
    thisMonth: "Ce mois",
    lastMonth: "Mois dernier",
    custom: "Personnalisé",
    from: "Du",
    to: "Au",
    apply: "Appliquer"
  }
};

const enTranslation = {
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    create: "Create",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    confirm: "Confirm",
    search: "Search",
    filter: "Filter",
    export: "Export",
    refresh: "Refresh",
    close: "Close"
  },
  nav: {
    home: "Home",
    dashboard: "Dashboard",
    conversations: "Conversations",
    analytics: "Analytics",
    knowledgeBase: "Knowledge Base",
    agents: "Agents",
    clients: "Clients",
    integrations: "Integrations",
    webhooks: "Webhooks",
    billing: "Billing",
    settings: "Settings"
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Overview of your activity",
    totalConversations: "Conversations",
    todayConversations: "today",
    thisWeek: "this week",
    avgDuration: "Average Duration",
    avgSatisfaction: "Satisfaction",
    activeClients: "Active Clients",
    totalAgents: "agents",
    totalMinutes: "Total Minutes",
    resolutionRate: "Resolution Rate",
    avgInteractions: "Average Interactions",
    quickActions: "Quick Actions",
    viewAllConversations: "View all conversations",
    manageClients: "Manage clients",
    configureIntegrations: "Configure integrations",
    newAgent: "New agent",
    recentActivity: "Recent Activity"
  },
  auth: {
    login: "Login",
    register: "Sign Up",
    logout: "Logout",
    forgotPassword: "Forgot password?"
  },
  clients: {
    title: "Clients",
    subtitle: "Manage your clients and their access",
    addClient: "Add Client"
  },
  agents: {
    title: "Agents",
    subtitle: "Configure your voice agents",
    addAgent: "Add Agent"
  },
  conversations: {
    title: "Conversations",
    subtitle: "Conversation history",
    exportCSV: "Export CSV",
    exportPDF: "Export PDF"
  },
  analytics: {
    title: "Analytics",
    subtitle: "Statistics and reports",
    workspaceMetrics: "Workspace Metrics",
    clientMetrics: "Client Metrics"
  },
  webhooks: {
    title: "Webhooks",
    subtitle: "Configure your outbound webhooks",
    addEndpoint: "Add Endpoint",
    url: "URL",
    secret: "Secret",
    events: "Events",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    deliveryLogs: "Delivery Logs",
    noEndpoints: "No endpoints configured",
    eventTypes: {
      "conversation.created": "Conversation Created",
      "conversation.completed": "Conversation Completed",
      "agent.created": "Agent Created",
      "agent.updated": "Agent Updated",
      "client.created": "Client Created",
      "subscription.updated": "Subscription Updated"
    }
  },
  settings: {
    title: "Settings",
    subtitle: "Configure your workspace",
    language: "Language",
    selectLanguage: "Select Language"
  },
  billing: {
    title: "Billing",
    subtitle: "Manage your subscription"
  },
  filters: {
    dateRange: "Date Range",
    today: "Today",
    last7Days: "Last 7 days",
    last30Days: "Last 30 days",
    thisMonth: "This month",
    lastMonth: "Last month",
    custom: "Custom",
    from: "From",
    to: "To",
    apply: "Apply"
  }
};

const esTranslation = {
  common: {
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    add: "Añadir",
    create: "Crear",
    loading: "Cargando...",
    error: "Error",
    success: "Éxito",
    confirm: "Confirmar",
    search: "Buscar",
    filter: "Filtrar",
    export: "Exportar",
    refresh: "Actualizar",
    close: "Cerrar"
  },
  nav: {
    home: "Inicio",
    dashboard: "Panel",
    conversations: "Conversaciones",
    analytics: "Analíticas",
    knowledgeBase: "Base de conocimientos",
    agents: "Agentes",
    clients: "Clientes",
    integrations: "Integraciones",
    webhooks: "Webhooks",
    billing: "Facturación",
    settings: "Configuración"
  },
  dashboard: {
    title: "Panel",
    subtitle: "Resumen de tu actividad",
    totalConversations: "Conversaciones",
    todayConversations: "hoy",
    thisWeek: "esta semana",
    avgDuration: "Duración media",
    avgSatisfaction: "Satisfacción",
    activeClients: "Clientes activos",
    totalAgents: "agentes",
    totalMinutes: "Minutos totales",
    resolutionRate: "Tasa de resolución",
    avgInteractions: "Interacciones medias",
    quickActions: "Acciones rápidas",
    viewAllConversations: "Ver todas las conversaciones",
    manageClients: "Gestionar clientes",
    configureIntegrations: "Configurar integraciones",
    newAgent: "Nuevo agente",
    recentActivity: "Actividad reciente"
  },
  auth: {
    login: "Iniciar sesión",
    register: "Registrarse",
    logout: "Cerrar sesión",
    forgotPassword: "¿Olvidaste tu contraseña?"
  },
  clients: {
    title: "Clientes",
    subtitle: "Gestiona tus clientes y sus accesos",
    addClient: "Añadir cliente"
  },
  agents: {
    title: "Agentes",
    subtitle: "Configura tus agentes de voz",
    addAgent: "Añadir agente"
  },
  conversations: {
    title: "Conversaciones",
    subtitle: "Historial de conversaciones",
    exportCSV: "Exportar CSV",
    exportPDF: "Exportar PDF"
  },
  analytics: {
    title: "Analíticas",
    subtitle: "Estadísticas e informes",
    workspaceMetrics: "Métricas del Workspace",
    clientMetrics: "Métricas del Cliente"
  },
  webhooks: {
    title: "Webhooks",
    subtitle: "Configura tus webhooks salientes",
    addEndpoint: "Añadir endpoint",
    url: "URL",
    secret: "Secreto",
    events: "Eventos",
    status: "Estado",
    active: "Activo",
    inactive: "Inactivo",
    deliveryLogs: "Logs de entrega",
    noEndpoints: "No hay endpoints configurados",
    eventTypes: {
      "conversation.created": "Conversación creada",
      "conversation.completed": "Conversación completada",
      "agent.created": "Agente creado",
      "agent.updated": "Agente actualizado",
      "client.created": "Cliente creado",
      "subscription.updated": "Suscripción actualizada"
    }
  },
  settings: {
    title: "Configuración",
    subtitle: "Configura tu espacio de trabajo",
    language: "Idioma",
    selectLanguage: "Seleccionar idioma"
  },
  billing: {
    title: "Facturación",
    subtitle: "Gestiona tu suscripción"
  },
  filters: {
    dateRange: "Rango de fechas",
    today: "Hoy",
    last7Days: "Últimos 7 días",
    last30Days: "Últimos 30 días",
    thisMonth: "Este mes",
    lastMonth: "Mes pasado",
    custom: "Personalizado",
    from: "Desde",
    to: "Hasta",
    apply: "Aplicar"
  }
};

const deTranslation = {
  common: {
    save: "Speichern",
    cancel: "Abbrechen",
    delete: "Löschen",
    edit: "Bearbeiten",
    add: "Hinzufügen",
    create: "Erstellen",
    loading: "Laden...",
    error: "Fehler",
    success: "Erfolg",
    confirm: "Bestätigen",
    search: "Suchen",
    filter: "Filtern",
    export: "Exportieren",
    refresh: "Aktualisieren",
    close: "Schließen"
  },
  nav: {
    home: "Startseite",
    dashboard: "Dashboard",
    conversations: "Gespräche",
    analytics: "Analytik",
    knowledgeBase: "Wissensbasis",
    agents: "Agenten",
    clients: "Kunden",
    integrations: "Integrationen",
    webhooks: "Webhooks",
    billing: "Abrechnung",
    settings: "Einstellungen"
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Übersicht Ihrer Aktivitäten",
    totalConversations: "Gespräche",
    todayConversations: "heute",
    thisWeek: "diese Woche",
    avgDuration: "Durchschnittliche Dauer",
    avgSatisfaction: "Zufriedenheit",
    activeClients: "Aktive Kunden",
    totalAgents: "Agenten",
    totalMinutes: "Gesamtminuten",
    resolutionRate: "Lösungsrate",
    avgInteractions: "Durchschn. Interaktionen",
    quickActions: "Schnellaktionen",
    viewAllConversations: "Alle Gespräche anzeigen",
    manageClients: "Kunden verwalten",
    configureIntegrations: "Integrationen konfigurieren",
    newAgent: "Neuer Agent",
    recentActivity: "Letzte Aktivität"
  },
  auth: {
    login: "Anmelden",
    register: "Registrieren",
    logout: "Abmelden",
    forgotPassword: "Passwort vergessen?"
  },
  clients: {
    title: "Kunden",
    subtitle: "Verwalten Sie Ihre Kunden und deren Zugriff",
    addClient: "Kunde hinzufügen"
  },
  agents: {
    title: "Agenten",
    subtitle: "Konfigurieren Sie Ihre Sprachagenten",
    addAgent: "Agent hinzufügen"
  },
  conversations: {
    title: "Gespräche",
    subtitle: "Gesprächsverlauf",
    exportCSV: "CSV exportieren",
    exportPDF: "PDF exportieren"
  },
  analytics: {
    title: "Analytik",
    subtitle: "Statistiken und Berichte",
    workspaceMetrics: "Workspace-Metriken",
    clientMetrics: "Kunden-Metriken"
  },
  webhooks: {
    title: "Webhooks",
    subtitle: "Konfigurieren Sie Ihre ausgehenden Webhooks",
    addEndpoint: "Endpoint hinzufügen",
    url: "URL",
    secret: "Geheimnis",
    events: "Ereignisse",
    status: "Status",
    active: "Aktiv",
    inactive: "Inaktiv",
    deliveryLogs: "Zustellungsprotokolle",
    noEndpoints: "Keine Endpoints konfiguriert",
    eventTypes: {
      "conversation.created": "Gespräch erstellt",
      "conversation.completed": "Gespräch abgeschlossen",
      "agent.created": "Agent erstellt",
      "agent.updated": "Agent aktualisiert",
      "client.created": "Kunde erstellt",
      "subscription.updated": "Abonnement aktualisiert"
    }
  },
  settings: {
    title: "Einstellungen",
    subtitle: "Konfigurieren Sie Ihren Arbeitsbereich",
    language: "Sprache",
    selectLanguage: "Sprache auswählen"
  },
  billing: {
    title: "Abrechnung",
    subtitle: "Verwalten Sie Ihr Abonnement"
  },
  filters: {
    dateRange: "Datumsbereich",
    today: "Heute",
    last7Days: "Letzte 7 Tage",
    last30Days: "Letzte 30 Tage",
    thisMonth: "Diesen Monat",
    lastMonth: "Letzten Monat",
    custom: "Benutzerdefiniert",
    from: "Von",
    to: "Bis",
    apply: "Anwenden"
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'es', 'de'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    resources: {
      fr: { translation: frTranslation },
      en: { translation: enTranslation },
      es: { translation: esTranslation },
      de: { translation: deTranslation },
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
