Plan:

1. Recordings
- Make `/planipret/mobile` use the same backend recording source as `/planipret/admin/recordings`: local `planipret_phone_calls` rows filtered by extension plus the `ns-get-recording` proxy.
- Stop mobile recordings from depending on the unstable live NS recordings list before showing rows.
- Pass the exact same lookup payload admin uses: `call_db_id`, `ns_callid`, `ns_orig_callid`, `ns_term_callid`, `ns_extension`.
- Make recording failures graceful: show rows anyway and only show an audio error inside the opened card, not a blank page.

2. NS-API configuration parity
- Update shared NS backend helpers to read the admin portal config (`planipret_integration_config` / integration secrets) as fallback/override for base URL, domain, and API key.
- Keep secrets server-side only.
- Ensure mobile/web endpoints call the canonical `pp-ns-*` / `ns-get-recording` functions, not older `ns-*` endpoints.

3. Microsoft email
- Align mobile Microsoft connect with admin portal’s `ms365` config key and the existing `/auth/microsoft/callback` callback.
- Fix config lookup mismatch where mobile reads provider `microsoft` while admin saves `ms365`.
- Make `ms365-actions` read the same admin portal config and return a useful reconnect/error state instead of silently showing no emails.

4. Call controls
- Replace remaining old `ns-calls` mobile overlay calls with `pp-ns-calls`.
- Normalize action names: hold, unhold/resume, transfer, disconnect/hangup, mute, dtmf.
- Use the actual NS call id fields (`ns_callid`/`ns_call_id`) for active call control instead of database row id when needed.

5. Validate
- Verify mobile calls/recordings/messages screens load without throwing.
- Verify backend functions return structured JSON/audio responses instead of 500/502 blank-screen failures.