/**
 * SMS / message quick-reply templates. Persisted in localStorage so users can
 * curate their own list without a backend round-trip. Variables like
 * `{{name}}` are interpolated against the active thread contact.
 */
const KEY = 'lemtel.msg.templates.v1';

export interface MsgTemplate {
  id: string;
  label: string;
  body: string;
}

const DEFAULTS: MsgTemplate[] = [
  { id: 't1', label: 'Greeting', body: 'Hi {{name}}, this is {{me}} at Lemtel — how can I help?' },
  { id: 't2', label: 'Voicemail follow-up', body: 'Hi {{name}}, just left you a voicemail. Call us back at your convenience.' },
  { id: 't3', label: 'Appointment confirm', body: 'Confirming our appointment tomorrow. Reply YES to confirm or NO to reschedule.' },
  { id: 't4', label: 'Closing', body: 'Thanks {{name}}! Let me know if anything else comes up.' },
];

export function loadTemplates(): MsgTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as MsgTemplate[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULTS;
  } catch { return DEFAULTS; }
}

export function saveTemplates(list: MsgTemplate[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function interpolate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}
