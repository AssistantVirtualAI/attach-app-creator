// Shared definition of the 35 AVA tools pushed to the ElevenLabs agent.
// Used by elevenlabs-manage-agent (sync_all_tools) and the admin UI status table.

export function buildAvaToolsArray(supabaseUrl: string, anonKey: string) {
  const SUPABASE_TOOL_URL = `${supabaseUrl}/functions/v1/ava-tool-executor`;
  const TOOL_HEADERS = [
    { key: "Content-Type", value: "application/json" },
    { key: "Authorization", value: `Bearer ${anonKey}` },
  ];

  const mk = (name: string, description: string, properties: Record<string, any> = {}, required: string[] = []) => ({
    type: "webhook",
    name,
    description,
    api: {
      url: SUPABASE_TOOL_URL,
      method: "POST",
      headers: TOOL_HEADERS,
      request_body_schema: {
        type: "object",
        properties: {
          tool_name: { type: "string", value: name, description: "Tool identifier" },
          parameters: { type: "object", properties, ...(required.length ? { required } : {}) },
        },
        required: ["tool_name", "parameters"],
      },
    },
  });

  return [
    // Telephony
    mk("make_call", "Lance un appel téléphonique vers un numéro ou contact. Demande toujours confirmation avant d'appeler.", {
      to_number: { type: "string", description: "Numéro E.164 (ex: +15145551234)" },
      contact_name: { type: "string", description: "Nom du contact (optionnel)" },
    }, ["to_number"]),
    mk("get_active_calls", "Récupère la liste des appels en cours actifs."),
    mk("hangup_call", "Raccroche et termine un appel actif.", { call_id: { type: "string", description: "ID de l'appel" } }, ["call_id"]),
    mk("get_call_history", "Récupère l'historique des appels avec scores IA et températures de leads.", {
      limit: { type: "number", description: "Nombre d'appels (défaut: 10)" },
      days: { type: "number", description: "Jours dans le passé (défaut: 7)" },
      direction: { type: "string", description: "inbound, outbound ou missed" },
    }),
    mk("get_recording", "Récupère l'URL d'un enregistrement d'appel.", { call_id: { type: "string", description: "ID de l'appel" } }, ["call_id"]),
    mk("get_transcript", "Récupère la transcription textuelle d'un appel.", { call_id: { type: "string", description: "ID de l'appel" } }, ["call_id"]),
    mk("send_sms", "Envoie un SMS. Demande confirmation avant d'envoyer.", {
      to: { type: "string", description: "Numéro destinataire E.164" },
      message: { type: "string", description: "Contenu du message" },
      contact_name: { type: "string", description: "Nom du contact (optionnel)" },
    }, ["to", "message"]),
    mk("get_voicemails", "Récupère les messages vocaux.", {
      folder: { type: "string", description: "inbox ou saved (défaut: inbox)" },
      limit: { type: "number", description: "Nombre (défaut: 10)" },
    }),

    // AI analysis
    mk("analyze_call", "Analyse une transcription d'appel avec Claude pour coaching et score lead.", { call_id: { type: "string", description: "ID de l'appel" } }, ["call_id"]),
    mk("get_hot_leads", "Récupère les leads chauds (score >= 8) sans suivi depuis 24h.", { limit: { type: "number", description: "Nombre (défaut: 5)" } }),
    mk("get_coaching_summary", "Résumé des performances de coaching.", { period: { type: "string", description: "today, week ou month (défaut: week)" } }),

    // Maestro CRM
    mk("search_client", "Cherche un client dans Maestro CRM.", { query: { type: "string", description: "Nom, téléphone ou email" } }, ["query"]),
    mk("get_client_profile", "Profil complet d'un client Maestro.", { client_id: { type: "string", description: "ID du client" } }, ["client_id"]),
    mk("get_client_history", "Historique des communications client.", {
      client_id: { type: "string", description: "ID du client" },
      limit: { type: "number", description: "Nombre d'entrées (défaut: 20)" },
    }, ["client_id"]),
    mk("create_task", "Crée une tâche de suivi dans Maestro. Demande confirmation.", {
      client_id: { type: "string", description: "ID du client" },
      title: { type: "string", description: "Description de la tâche" },
      due_date: { type: "string", description: "ISO 8601 (optionnel)" },
      priority: { type: "string", description: "low, medium ou high" },
      notes: { type: "string", description: "Notes (optionnel)" },
    }, ["client_id", "title"]),
    mk("create_appointment", "Crée un rendez-vous dans Maestro + M365.", {
      client_id: { type: "string", description: "ID du client" },
      title: { type: "string", description: "Titre" },
      start_datetime: { type: "string", description: "ISO 8601" },
      duration_minutes: { type: "number", description: "Durée (défaut: 60)" },
      type: { type: "string", description: "phone, in-person ou video" },
      notes: { type: "string", description: "Notes (optionnel)" },
    }, ["client_id", "title", "start_datetime"]),
    mk("get_pending_tasks", "Liste des tâches en attente.", {
      limit: { type: "number", description: "Nombre (défaut: 10)" },
      priority: { type: "string", description: "Filtre (optionnel)" },
    }),
    mk("get_upcoming_appointments", "Prochains rendez-vous.", { days: { type: "number", description: "Jours en avant (défaut: 7)" } }),
    mk("create_client", "Crée un prospect dans Maestro. Demande confirmation.", {
      phone: { type: "string", description: "Numéro E.164" },
      first_name: { type: "string", description: "Prénom (optionnel)" },
      last_name: { type: "string", description: "Nom (optionnel)" },
      notes: { type: "string", description: "Notes (optionnel)" },
    }, ["phone"]),

    // Microsoft 365
    mk("read_emails", "Lit les derniers courriels M365.", {
      limit: { type: "number", description: "Nombre (défaut: 10)" },
      unread_only: { type: "boolean", description: "Seulement non lus" },
    }),
    mk("send_email", "Envoie un courriel via M365. Demande confirmation.", {
      to_email: { type: "string", description: "Destinataire" },
      to_name: { type: "string", description: "Nom (optionnel)" },
      subject: { type: "string", description: "Sujet" },
      body: { type: "string", description: "Corps" },
    }, ["to_email", "subject", "body"]),
    mk("get_calendar_today", "Rendez-vous du calendrier M365 aujourd'hui."),
    mk("get_calendar_week", "Rendez-vous des 7 prochains jours."),

    // Navigation & stats
    mk("navigate_to", "Navigue vers une page de l'app Planiprêt.", {
      route: { type: "string", description: "Route ex: /mplanipret/home, /mplanipret/calls, /mplanipret/messages?tab=sms, /mplanipret/voicemail, /mplanipret/stats" },
    }, ["route"]),
    mk("get_daily_briefing", "Brief quotidien: emails, rendez-vous, appels, leads chauds, tâches."),
    mk("get_my_stats", "Statistiques d'appels et performance.", { period: { type: "string", description: "today, week ou month" } }),
    mk("generate_voicemail_greeting", "Génère un nouveau message de boîte vocale avec ElevenLabs. Demande confirmation.", {
      text: { type: "string", description: "Texte à générer" },
      voice_id: { type: "string", description: "ID voix (optionnel)" },
    }, ["text"]),
    mk("explain_feature", "Explique une fonctionnalité Planiprêt.", {
      feature: { type: "string", description: "calls, recordings, transcripts, ai_coaching, maestro, ms365, voicemail_greeting, sms, team_chat, contacts, stats, voice_agent, pipeline" },
    }, ["feature"]),
    mk("get_integration_status", "Statut de toutes les intégrations: NS-API, Maestro, M365, ElevenLabs."),
  ];
}

export const EXPECTED_TOOL_NAMES = [
  "make_call","get_active_calls","hangup_call","get_call_history","get_recording","get_transcript","send_sms","get_voicemails",
  "analyze_call","get_hot_leads","get_coaching_summary",
  "search_client","get_client_profile","get_client_history","create_task","create_appointment","get_pending_tasks","get_upcoming_appointments","create_client",
  "read_emails","send_email","get_calendar_today","get_calendar_week",
  "navigate_to","get_daily_briefing","get_my_stats","generate_voicemail_greeting","explain_feature","get_integration_status",
];
