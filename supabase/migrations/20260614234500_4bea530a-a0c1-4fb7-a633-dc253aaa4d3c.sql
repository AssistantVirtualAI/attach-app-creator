
-- Lock down sensitive columns: revoke table-wide SELECT and re-grant per-column excluding secrets.

-- lemtel_softphone_users (exclude sip_password)
REVOKE SELECT ON public.lemtel_softphone_users FROM authenticated, anon;
GRANT SELECT (id, customer_id, portal_user_id, extension, sip_domain, display_name, status, device_type, last_seen, created_at, updated_at) ON public.lemtel_softphone_users TO authenticated;

-- organization_integrations (exclude api_key)
REVOKE SELECT ON public.organization_integrations FROM authenticated, anon;
GRANT SELECT (id, user_id, platform, agent_id, additional_config, is_active, created_at, updated_at, last_tested_at, test_status, test_error, organization_id) ON public.organization_integrations TO authenticated;

-- pbx_conferences (exclude pin, moderator_pin)
REVOKE SELECT ON public.pbx_conferences FROM authenticated, anon;
GRANT SELECT (id, organization_id, pbx_uuid, name, extension, max_members, record, description, enabled, pbx_etag, last_synced_at, created_at, updated_at) ON public.pbx_conferences TO authenticated;

-- pbx_extensions (exclude password, voicemail_password)
REVOKE SELECT ON public.pbx_extensions FROM authenticated, anon;
GRANT SELECT (
  id, organization_id, client_id, pbx_uuid, extension, effective_cid_name, effective_cid_number,
  call_group, voicemail_enabled, call_recording, do_not_disturb, forward_all_destination,
  enabled, description, raw_data, synced_at, created_at, updated_at, domain_uuid,
  accountcode, outbound_cid_name, outbound_cid_number, emergency_cid_name, emergency_cid_number,
  directory_first_name, directory_last_name, directory_visible, directory_exten_visible,
  limit_max, limit_destination, voicemail_mail_to, voicemail_transcription,
  voicemail_custom_prompt, voicemail_file, voicemail_keep_local, missed_call_app, missed_call_data,
  call_timeout, call_screen, hold_music, extension_language, extension_dialect, extension_voice,
  extension_type, toll_allow, forward_all_enabled, forward_busy_destination, forward_busy_enabled,
  forward_no_answer_destination, forward_no_answer_enabled, forward_user_not_registered_destination,
  forward_user_not_registered_enabled, user_record, absolute_codec_string, max_registrations,
  force_ping, sip_force_contact, sip_force_expires, sip_bypass_media, cidr, auth_acl,
  assigned_user_ids, device_lines, portal_user_id, org_id
) ON public.pbx_extensions TO authenticated;
-- Note: raw_data may contain the password as JSON. Strip it where exposed via a future safe view if needed.

-- pbx_softphone_users (exclude sip_password)
REVOKE SELECT ON public.pbx_softphone_users FROM authenticated, anon;
GRANT SELECT (
  id, organization_id, client_id, portal_user_id, extension_id, extension, sip_domain, display_name,
  status, last_seen_at, created_at, updated_at, forward_enabled, forward_to, dnd_enabled, wss_url,
  device_type, last_seen_ios, last_seen_android, last_seen_mac, last_seen_windows, last_seen_linux,
  last_seen_web, active_platforms, total_calls, account_status, custom_status, status_emoji,
  out_of_office_until, cc_role, cc_queues, cc_status, cc_pause_reason, cc_calls_today,
  cc_avg_handle_time, cc_logged_in_at, cc_skills, app_access_enabled
) ON public.pbx_softphone_users TO authenticated;

-- Tighten cc_agent_activity SELECT to supervisors/managers/admins
DROP POLICY IF EXISTS org_cc_agent_activity_read ON public.cc_agent_activity;
CREATE POLICY org_cc_agent_activity_read ON public.cc_agent_activity
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
    OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
    OR public.is_cc_supervisor(auth.uid())
  );

-- Tighten cc_queue_stats SELECT to supervisors/managers/admins
DROP POLICY IF EXISTS org_cc_queue_stats_read ON public.cc_queue_stats;
CREATE POLICY org_cc_queue_stats_read ON public.cc_queue_stats
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), organization_id, 'org_admin'::app_role)
    OR public.has_role(auth.uid(), organization_id, 'manager'::app_role)
    OR public.is_cc_supervisor(auth.uid())
  );
