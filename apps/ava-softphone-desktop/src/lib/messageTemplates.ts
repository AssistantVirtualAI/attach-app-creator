/**
 * SMS / message quick-reply templates with categories, search and per-contact
 * defaults. Persisted in localStorage so users can curate without a backend
 * round-trip. Variables like `{{name}}` are interpolated against the active
 * thread contact.
 */
const KEY = 'lemtel.msg.templates.v2';
const DEFAULTS_KEY = 'lemtel.msg.templateDefaults.v1';

export type TemplateCategory = 'Greeting' | 'Follow-up' | 'Scheduling' | 'Closing' | 'Custom';
export const CATEGORIES: TemplateCategory[] = ['Greeting', 'Follow-up', 'Scheduling', 'Closing', 'Custom'];

export interface MsgTemplate {
  id: string;
  label: string;
  body: string;
  category: TemplateCategory;
}

const DEFAULTS: MsgTemplate[] = [
  { id: 't1', category: 'Greeting',   label: 'Hello',                  body: 'Hi {{name}}, this is {{me}} at Lemtel — how can I help?' },
  { id: 't2', category: 'Follow-up',  label: 'Voicemail follow-up',    body: 'Hi {{name}}, just left you a voicemail. Call us back at your convenience.' },
  { id: 't3', category: 'Scheduling', label: 'Appointment confirm',    body: 'Confirming our appointment tomorrow. Reply YES to confirm or NO to reschedule.' },
  { id: 't4', category: 'Scheduling', label: 'Reschedule offer',       body: 'Hi {{name}}, would Tuesday or Thursday work better for our call?' },
  { id: 't5', category: 'Closing',    label: 'Thanks',                 body: 'Thanks {{name}}! Let me know if anything else comes up.' },
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

/** Map of threadId/contactId → templateId chosen as default for that contact. */
type DefaultMap = Record<string, string>;

function loadDefaults(): DefaultMap {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    return raw ? (JSON.parse(raw) as DefaultMap) : {};
  } catch { return {}; }
}

function saveDefaults(map: DefaultMap) {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(map));
}

export function getDefaultTemplateId(contactKey: string): string | null {
  return loadDefaults()[contactKey] || null;
}

export function setDefaultTemplate(contactKey: string, templateId: string | null) {
  const map = loadDefaults();
  if (templateId) map[contactKey] = templateId;
  else delete map[contactKey];
  saveDefaults(map);
}

export function filterTemplates(
  list: MsgTemplate[],
  query: string,
  category: TemplateCategory | 'All',
): MsgTemplate[] {
  const q = query.trim().toLowerCase();
  return list.filter((t) => {
    if (category !== 'All' && t.category !== category) return false;
    if (!q) return true;
    return t.label.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
  });
}
