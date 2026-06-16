// Field schemas mirroring the portal's FusionPBX edit forms.
// Consumed by PbxEditSheet via PbxResourceSection.
import type { FieldGroup } from '../components/console/admin/PbxEditSheet';

const BOOL = ['true', 'false'];

export const EXTENSION_GROUPS: FieldGroup[] = [
  {
    section: 'Identity',
    fields: [
      { key: 'extension', label: 'Extension #', cols: 1, required: true },
      { key: 'password', label: 'SIP Password', type: 'password', cols: 1 },
      { key: 'effective_caller_id_name', label: 'Caller ID Name', cols: 1 },
      { key: 'effective_caller_id_number', label: 'Caller ID Number', cols: 1 },
      { key: 'outbound_caller_id_name', label: 'Outbound CID Name', cols: 1 },
      { key: 'outbound_caller_id_number', label: 'Outbound CID Number', cols: 1 },
      { key: 'description', label: 'Description' },
    ],
  },
  {
    section: 'Voicemail',
    fields: [
      { key: 'voicemail_enabled', label: 'Voicemail', type: 'checkbox', cols: 1, hint: 'Enable mailbox' },
      { key: 'voicemail_password', label: 'Voicemail PIN', type: 'password', cols: 1 },
      { key: 'voicemail_mail_to', label: 'Email Voicemails To', cols: 1 },
      { key: 'voicemail_attach_file', label: 'Attach MP3', type: 'select', options: BOOL, cols: 1 },
      { key: 'voicemail_file', label: 'After email', type: 'select', cols: 1,
        options: [{ value: 'keep', label: 'Keep' }, { value: 'delete', label: 'Delete' }] },
      { key: 'voicemail_local_after_email', label: 'Local copy', type: 'select', options: BOOL, cols: 1 },
    ],
  },
  {
    section: 'Call Handling',
    fields: [
      { key: 'call_timeout', label: 'Call Timeout (s)', type: 'number', cols: 1 },
      { key: 'call_group', label: 'Call Group', cols: 1 },
      { key: 'user_context', label: 'Context', cols: 1, placeholder: 'default' },
      { key: 'accountcode', label: 'Account Code', cols: 1 },
      { key: 'toll_allow', label: 'Toll Allow', cols: 1, placeholder: 'domestic,international' },
      { key: 'hold_music', label: 'Hold Music', cols: 1, placeholder: 'default' },
      { key: 'do_not_disturb', label: 'DND', type: 'select', options: BOOL, cols: 1 },
      { key: 'enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
    ],
  },
  {
    section: 'Forwarding',
    fields: [
      { key: 'forward_all_enabled', label: 'Fwd All', type: 'select', options: BOOL, cols: 1 },
      { key: 'forward_all_destination', label: 'Fwd All Destination', cols: 1 },
      { key: 'forward_busy_enabled', label: 'Fwd Busy', type: 'select', options: BOOL, cols: 1 },
      { key: 'forward_busy_destination', label: 'Fwd Busy Destination', cols: 1 },
      { key: 'forward_no_answer_enabled', label: 'Fwd No Answer', type: 'select', options: BOOL, cols: 1 },
      { key: 'forward_no_answer_destination', label: 'Fwd No Answer Destination', cols: 1 },
    ],
  },
];

export const QUEUE_GROUPS: FieldGroup[] = [
  {
    section: 'Identity',
    fields: [
      { key: 'queue_name', label: 'Name', cols: 1, required: true },
      { key: 'queue_extension', label: 'Extension', cols: 1 },
      { key: 'queue_description', label: 'Description' },
      { key: 'queue_enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
    ],
  },
  {
    section: 'Strategy',
    fields: [
      { key: 'queue_strategy', label: 'Strategy', type: 'select', cols: 1, options: [
        'ring-all','longest-idle-agent','round-robin','top-down',
        'agent-with-least-talk-time','agent-with-fewest-calls',
        'sequentially-by-agent-order','random',
      ] },
      { key: 'queue_moh_sound', label: 'Hold Music', cols: 1, placeholder: '$${hold_music}' },
      { key: 'queue_record_template', label: 'Recording Template', cols: 1 },
      { key: 'queue_time_base_score', label: 'Time Base Score', type: 'select', options: ['queue','system'], cols: 1 },
    ],
  },
  {
    section: 'Wait & Abandon',
    fields: [
      { key: 'queue_max_wait_time', label: 'Max Wait (s)', type: 'number', cols: 1 },
      { key: 'queue_max_wait_time_with_no_agent', label: 'Max wait w/ no agent (s)', type: 'number', cols: 1 },
      { key: 'queue_max_wait_time_with_no_agent_time_reached', label: 'No-agent time reached (s)', type: 'number', cols: 1 },
      { key: 'queue_wrap_up_time', label: 'Wrap-up Time (s)', type: 'number', cols: 1 },
      { key: 'queue_agent_no_answer_delay_time', label: 'Agent No-Answer Delay (s)', type: 'number', cols: 1 },
      { key: 'queue_tier_rules_apply', label: 'Tier Rules Apply', type: 'select', options: BOOL, cols: 1 },
      { key: 'queue_tier_rule_wait_second', label: 'Tier Rule Wait (s)', type: 'number', cols: 1 },
      { key: 'queue_tier_rule_wait_multiply_level', label: 'Multiply by tier level', type: 'select', options: BOOL, cols: 1 },
      { key: 'queue_tier_rule_no_agent_no_wait', label: 'No agent → no wait', type: 'select', options: BOOL, cols: 1 },
      { key: 'queue_abandoned_resume_allowed', label: 'Resume After Abandon', type: 'select', options: BOOL, cols: 1 },
      { key: 'queue_discard_abandoned_after', label: 'Discard Abandoned After (s)', type: 'number', cols: 1 },
      { key: 'queue_timeout_action', label: 'Timeout Action', placeholder: 'transfer:200 XML default' },
      { key: 'queue_cid_prefix', label: 'Caller ID Prefix', cols: 1, placeholder: '[Sales]' },
    ],
  },
  {
    section: 'Announce',
    fields: [
      { key: 'queue_announce_sound', label: 'Announce Sound', cols: 1, type: 'tts-greeting',
        ttsFilenameSuggestion: (f) => `queue-${(f.queue_extension || 'announce')}.mp3` },
      { key: 'queue_announce_frequency', label: 'Frequency (s)', type: 'number', cols: 1 },
    ],
  },
];

export const IVR_GROUPS: FieldGroup[] = [
  {
    section: 'Identity',
    fields: [
      { key: 'ivr_menu_name', label: 'Name', cols: 1, required: true },
      { key: 'ivr_menu_extension', label: 'Extension', cols: 1 },
      { key: 'ivr_menu_description', label: 'Description' },
      { key: 'ivr_menu_enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
      { key: 'ivr_menu_direct_dial', label: 'Allow Direct Dial', type: 'select', options: BOOL, cols: 1 },
    ],
  },
  {
    section: 'Greetings (ElevenLabs)',
    description: 'Generate audio with AI, download, upload it to FusionPBX Recordings, then paste the filename.',
    fields: [
      { key: 'ivr_menu_greet_long', label: 'Long Greeting', type: 'tts-greeting',
        ttsFilenameSuggestion: (f) => `ivr-${(f.ivr_menu_extension || 'menu')}-long.mp3` },
      { key: 'ivr_menu_greet_short', label: 'Short Greeting', type: 'tts-greeting',
        ttsFilenameSuggestion: (f) => `ivr-${(f.ivr_menu_extension || 'menu')}-short.mp3` },
      { key: 'ivr_menu_invalid_sound', label: 'Invalid Sound', type: 'tts-greeting',
        ttsFilenameSuggestion: (f) => `ivr-${(f.ivr_menu_extension || 'menu')}-invalid.mp3` },
      { key: 'ivr_menu_exit_sound', label: 'Exit Sound', type: 'tts-greeting',
        ttsFilenameSuggestion: (f) => `ivr-${(f.ivr_menu_extension || 'menu')}-exit.mp3` },
    ],
  },
  {
    section: 'Behavior',
    fields: [
      { key: 'ivr_menu_timeout', label: 'Timeout (ms)', type: 'number', cols: 1 },
      { key: 'ivr_menu_max_failures', label: 'Max Failures', type: 'number', cols: 1 },
      { key: 'ivr_menu_max_timeouts', label: 'Max Timeouts', type: 'number', cols: 1 },
      { key: 'ivr_menu_digit_len', label: 'Digit Length', type: 'number', cols: 1 },
      { key: 'ivr_menu_inter_digit_timeout', label: 'Inter-Digit Timeout (ms)', type: 'number', cols: 1 },
      { key: 'ivr_menu_ringback', label: 'Ringback', cols: 1 },
      { key: 'ivr_menu_caller_id_name_prefix', label: 'CID Name Prefix', cols: 1 },
      { key: 'ivr_menu_exit_action', label: 'Exit Action', cols: 1, placeholder: 'hangup' },
      { key: 'ivr_menu_exit_data', label: 'Exit Data', cols: 1 },
    ],
  },
];

export const RING_GROUP_GROUPS: FieldGroup[] = [
  {
    section: 'Identity',
    fields: [
      { key: 'ring_group_name', label: 'Name', cols: 1, required: true },
      { key: 'ring_group_extension', label: 'Extension', cols: 1 },
      { key: 'ring_group_description', label: 'Description' },
      { key: 'ring_group_enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
      { key: 'ring_group_context', label: 'Context', cols: 1, placeholder: 'default' },
    ],
  },
  {
    section: 'Ring Strategy',
    fields: [
      { key: 'ring_group_strategy', label: 'Strategy', type: 'select', cols: 1,
        options: ['simultaneous', 'sequence', 'enterprise', 'rollover', 'random'] },
      { key: 'ring_group_call_timeout', label: 'Call Timeout (s)', type: 'number', cols: 1 },
      { key: 'ring_group_ringback', label: 'Ringback', cols: 1, placeholder: '${us-ring}' },
      { key: 'ring_group_cid_name_prefix', label: 'CID Name Prefix', cols: 1 },
      { key: 'ring_group_cid_number_prefix', label: 'CID Number Prefix', cols: 1 },
      { key: 'ring_group_distinctive_ring', label: 'Distinctive Ring', cols: 1 },
    ],
  },
  {
    section: 'Members',
    description: 'Comma-separated extensions (e.g. 1001,1002,1003). For advanced per-member delay/timeout, edit in the portal.',
    fields: [
      { key: 'ring_group_destinations', label: 'Member Extensions' },
    ],
  },
  {
    section: 'Fallback',
    fields: [
      { key: 'ring_group_timeout_app', label: 'Timeout App', cols: 1, placeholder: 'voicemail' },
      { key: 'ring_group_timeout_data', label: 'Timeout Data', cols: 1 },
      { key: 'ring_group_forward_enabled', label: 'Forward Enabled', type: 'select', options: BOOL, cols: 1 },
      { key: 'ring_group_forward_destination', label: 'Forward Destination', cols: 1 },
      { key: 'ring_group_missed_call_app', label: 'Missed Call App', cols: 1, placeholder: 'email' },
      { key: 'ring_group_missed_call_data', label: 'Missed Call Data', cols: 1 },
    ],
  },
];

export const TIME_CONDITION_GROUPS: FieldGroup[] = [
  {
    section: 'Identity',
    fields: [
      { key: 'dialplan_name', label: 'Name', cols: 1, required: true },
      { key: 'dialplan_number', label: 'Match', cols: 1 },
      { key: 'dialplan_enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
      { key: 'dialplan_order', label: 'Order', type: 'number', cols: 1 },
      { key: 'dialplan_description', label: 'Description' },
    ],
  },
  {
    section: 'Schedule',
    description: 'Use FreeSWITCH time-of-day fields (cron-like).',
    fields: [
      { key: 'tc_wday', label: 'Weekday', cols: 1, placeholder: '1-5 (Mon-Fri)' },
      { key: 'tc_mday', label: 'Day of Month', cols: 1, placeholder: '1-31' },
      { key: 'tc_mon', label: 'Month', cols: 1, placeholder: '1-12' },
      { key: 'tc_hour', label: 'Hour', cols: 1, placeholder: '9-17' },
      { key: 'tc_minute', label: 'Minute', cols: 1, placeholder: '0-59' },
      { key: 'tc_match_destination', label: 'Match Destination' },
      { key: 'tc_nomatch_destination', label: 'No-Match Destination' },
    ],
  },
];

export const CONFERENCE_GROUPS: FieldGroup[] = [
  {
    section: 'Identity',
    fields: [
      { key: 'conference_room_name', label: 'Name', cols: 1, required: true },
      { key: 'conference_room_extension', label: 'Extension', cols: 1 },
      { key: 'conference_room_pin', label: 'PIN', cols: 1 },
      { key: 'conference_room_max_members', label: 'Max Members', type: 'number', cols: 1 },
      { key: 'conference_room_enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
      { key: 'conference_room_record', label: 'Auto-Record', type: 'select', options: BOOL, cols: 1 },
      { key: 'conference_room_description', label: 'Description' },
    ],
  },
];

export const HOLD_MUSIC_GROUPS: FieldGroup[] = [
  {
    section: 'Source',
    fields: [
      { key: 'music_on_hold_name', label: 'Name', cols: 1, required: true },
      { key: 'music_on_hold_path', label: 'Path', cols: 1 },
      { key: 'music_on_hold_rate', label: 'Rate', type: 'select', options: ['8000','16000','32000','48000'], cols: 1 },
      { key: 'music_on_hold_enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
      { key: 'music_on_hold_description', label: 'Description' },
    ],
  },
];

export const GATEWAY_GROUPS: FieldGroup[] = [
  {
    section: 'SIP',
    fields: [
      { key: 'gateway', label: 'Name', cols: 1, required: true },
      { key: 'username', label: 'Username', cols: 1 },
      { key: 'password', label: 'Password', type: 'password', cols: 1 },
      { key: 'realm', label: 'Realm', cols: 1 },
      { key: 'proxy', label: 'Proxy (host[:port])', cols: 1 },
      { key: 'register', label: 'Register', type: 'select', options: BOOL, cols: 1 },
      { key: 'enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
      { key: 'expire_seconds', label: 'Expire (s)', type: 'number', cols: 1 },
    ],
  },
];

export const DIALPLAN_GROUPS: FieldGroup[] = [
  {
    section: 'Identity',
    fields: [
      { key: 'dialplan_name', label: 'Name', cols: 1, required: true },
      { key: 'dialplan_number', label: 'Number', cols: 1 },
      { key: 'dialplan_context', label: 'Context', cols: 1 },
      { key: 'dialplan_order', label: 'Order', type: 'number', cols: 1 },
      { key: 'dialplan_continue', label: 'Continue', type: 'select', options: BOOL, cols: 1 },
      { key: 'dialplan_enabled', label: 'Enabled', type: 'select', options: BOOL, cols: 1 },
      { key: 'dialplan_description', label: 'Description' },
    ],
  },
  { section: 'XML', fields: [{ key: 'dialplan_xml', label: 'XML Definition', type: 'textarea' }] },
];
