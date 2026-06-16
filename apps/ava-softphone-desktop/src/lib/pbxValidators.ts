// Shared FusionPBX field validation rules.
// Mirrors the portal forms so desktop edit sheet, portal form, and any popup
// produce identical required / format / range errors.

export type ValidationRule =
  | { kind: 'required' }
  | { kind: 'regex'; pattern: RegExp; message: string }
  | { kind: 'range'; min?: number; max?: number; message?: string }
  | { kind: 'enum'; values: string[]; message?: string }
  | { kind: 'email' };

export type RuleMap = Record<string, ValidationRule[]>;

const EXT = /^[0-9*#+]{2,10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+?[1-9]\d{6,14}$/;

export const EXTENSION_RULES: RuleMap = {
  extension: [{ kind: 'required' }, { kind: 'regex', pattern: EXT, message: 'Digits only (2–10)' }],
  password: [{ kind: 'required' }, { kind: 'regex', pattern: /^.{8,}$/, message: 'Min 8 characters' }],
  voicemail_password: [{ kind: 'regex', pattern: /^[0-9]{3,10}$/, message: 'Digits only (3–10)' }],
  voicemail_mail_to: [{ kind: 'email' }],
  effective_caller_id_number: [{ kind: 'regex', pattern: /^[0-9*#+]{0,15}$/, message: 'Digits only' }],
  outbound_caller_id_number: [{ kind: 'regex', pattern: /^\+?[0-9]{0,15}$/, message: 'Digits, optional +' }],
  call_timeout: [{ kind: 'range', min: 5, max: 600 }],
  forward_all_destination: [{ kind: 'regex', pattern: /^[0-9*#+]{0,20}$/, message: 'Digits only' }],
  forward_busy_destination: [{ kind: 'regex', pattern: /^[0-9*#+]{0,20}$/, message: 'Digits only' }],
  forward_no_answer_destination: [{ kind: 'regex', pattern: /^[0-9*#+]{0,20}$/, message: 'Digits only' }],
};

export const QUEUE_RULES: RuleMap = {
  queue_name: [{ kind: 'required' }, { kind: 'regex', pattern: /^[A-Za-z0-9 _-]{2,64}$/, message: '2–64 chars' }],
  queue_extension: [{ kind: 'regex', pattern: EXT, message: 'Digits only (2–10)' }],
  queue_strategy: [{ kind: 'enum', values: [
    'ring-all','longest-idle-agent','round-robin','top-down',
    'agent-with-least-talk-time','agent-with-fewest-calls',
    'sequentially-by-agent-order','random',
  ] }],
  queue_max_wait_time: [{ kind: 'range', min: 0, max: 86400 }],
  queue_max_wait_time_with_no_agent: [{ kind: 'range', min: 0, max: 86400 }],
  queue_max_wait_time_with_no_agent_time_reached: [{ kind: 'range', min: 0, max: 86400 }],
  queue_wrap_up_time: [{ kind: 'range', min: 0, max: 3600 }],
  queue_agent_no_answer_delay_time: [{ kind: 'range', min: 0, max: 3600 }],
  queue_tier_rule_wait_second: [{ kind: 'range', min: 0, max: 3600 }],
  queue_discard_abandoned_after: [{ kind: 'range', min: 0, max: 86400 }],
  queue_announce_frequency: [{ kind: 'range', min: 0, max: 3600 }],
};

export const IVR_RULES: RuleMap = {
  ivr_menu_name: [{ kind: 'required' }, { kind: 'regex', pattern: /^[A-Za-z0-9 _-]{2,64}$/, message: '2–64 chars' }],
  ivr_menu_extension: [{ kind: 'regex', pattern: EXT, message: 'Digits only (2–10)' }],
  ivr_menu_timeout: [{ kind: 'range', min: 0, max: 60000 }],
  ivr_menu_max_failures: [{ kind: 'range', min: 0, max: 20 }],
  ivr_menu_max_timeouts: [{ kind: 'range', min: 0, max: 20 }],
  ivr_menu_digit_len: [{ kind: 'range', min: 1, max: 10 }],
  ivr_menu_inter_digit_timeout: [{ kind: 'range', min: 0, max: 60000 }],
};

export const RING_GROUP_RULES: RuleMap = {
  ring_group_name: [{ kind: 'required' }, { kind: 'regex', pattern: /^[A-Za-z0-9 _-]{2,64}$/, message: '2–64 chars' }],
  ring_group_extension: [{ kind: 'regex', pattern: EXT, message: 'Digits only (2–10)' }],
  ring_group_strategy: [{ kind: 'enum', values: ['simultaneous','sequence','enterprise','rollover','random'] }],
  ring_group_call_timeout: [{ kind: 'range', min: 5, max: 600 }],
  ring_group_missed_call_data: [{ kind: 'email' }],
  ring_group_forward_destination: [{ kind: 'regex', pattern: /^[0-9*#+]{0,20}$/, message: 'Digits only' }],
};

export const TIME_CONDITION_RULES: RuleMap = {
  dialplan_name: [{ kind: 'required' }],
  dialplan_order: [{ kind: 'range', min: 0, max: 999 }],
};

export const CONFERENCE_RULES: RuleMap = {
  conference_room_name: [{ kind: 'required' }],
  conference_room_extension: [{ kind: 'regex', pattern: EXT, message: 'Digits only (2–10)' }],
  conference_room_pin: [{ kind: 'regex', pattern: /^[0-9]{0,10}$/, message: 'Digits only' }],
  conference_room_max_members: [{ kind: 'range', min: 2, max: 500 }],
};

export const GATEWAY_RULES: RuleMap = {
  gateway: [{ kind: 'required' }],
  expire_seconds: [{ kind: 'range', min: 30, max: 86400 }],
};

export const DIALPLAN_RULES: RuleMap = {
  dialplan_name: [{ kind: 'required' }],
  dialplan_order: [{ kind: 'range', min: 0, max: 999 }],
};

export const HOLD_MUSIC_RULES: RuleMap = {
  music_on_hold_name: [{ kind: 'required' }],
  music_on_hold_rate: [{ kind: 'enum', values: ['8000','16000','32000','48000'] }],
};

export const ALL_RULES: Record<string, RuleMap> = {
  extension: EXTENSION_RULES,
  queue: QUEUE_RULES,
  ivr: IVR_RULES,
  ring_group: RING_GROUP_RULES,
  time_condition: TIME_CONDITION_RULES,
  conference: CONFERENCE_RULES,
  gateway: GATEWAY_RULES,
  dialplan: DIALPLAN_RULES,
  hold_music: HOLD_MUSIC_RULES,
};

/** Run a single rule against a value. Returns null when valid, else error message. */
export function runRule(rule: ValidationRule, value: any): string | null {
  const v = value;
  const empty = v === undefined || v === null || String(v).trim() === '';
  switch (rule.kind) {
    case 'required': return empty ? 'Required' : null;
    case 'email':
      if (empty) return null;
      return EMAIL.test(String(v)) ? null : 'Invalid email';
    case 'regex':
      if (empty) return null;
      return rule.pattern.test(String(v)) ? null : rule.message;
    case 'enum':
      if (empty) return null;
      return rule.values.includes(String(v)) ? null : (rule.message || `Must be one of ${rule.values.join(', ')}`);
    case 'range': {
      if (empty) return null;
      const n = Number(v);
      if (Number.isNaN(n)) return 'Must be a number';
      if (rule.min !== undefined && n < rule.min) return rule.message || `Min ${rule.min}`;
      if (rule.max !== undefined && n > rule.max) return rule.message || `Max ${rule.max}`;
      return null;
    }
  }
}

/** Validate a record against a RuleMap. Returns { field: errorMessage }. */
export function validateRecord(record: Record<string, any>, rules: RuleMap): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, list] of Object.entries(rules)) {
    for (const rule of list) {
      const err = runRule(rule, record[key]);
      if (err) { errors[key] = err; break; }
    }
  }
  return errors;
}

// Helper used by E164-aware fields (e.g. external IVR destinations).
export const isE164 = (v: string) => E164.test(v);
