## Plan

1. **Fix Call History crash**
   - Update the desktop Call History page to use the realtime refresh hook correctly.
   - Add a null-safe guard so loading the page cannot crash while the workspace/tenant is still resolving.
   - Keep the error boundary as a fallback, but make the page load normally instead of showing “Cannot destructure property 'table'…”.

2. **Show all domain recordings in Admin**
   - Split recordings behavior into two scopes:
     - **User views**: only the current extension.
     - **Admin views**: all recordings for the active workspace/domain.
   - Change the desktop Admin > Call Recordings screen so it does not reuse the extension-filtered `ava.recordings()` query.
   - If the database policy still limits an admin to their own extension, add/fix the backend access path so admin recordings are read by workspace/domain, not by user extension.

3. **Resolve SIP 403 for extension 300**
   - Verify the active SIP URI, auth username, SIP domain, WSS endpoint, and password source without exposing the password.
   - Fix the credential precedence issue: ensure the password source used by registration matches the canonical PBX extension password.
   - Update the password sync function so it writes both extension password fields, not only the softphone-user copy/raw metadata.
   - Pass `auth_username` from the credential function through the desktop hook into the JsSIP provider instead of hardcoding it.
   - Add clearer SIP diagnostics showing which source was used: extension password, softphone stored password, or PBX proxy fallback.

4. **Remove duplicate BUSY/status control**
   - Keep the top profile/status pill only.
   - Remove the lower manual status selector from the softphone header.
   - Keep status changes wired through the existing profile menu so Busy/Available still works.

5. **Make the desktop app medium-light / medium-dark and futuristic**
   - Rework `apps/ava-softphone-desktop/src/lib/theme.tsx` into a balanced “frosted graphite” theme: not white, not fully dark.
   - Use medium-light surfaces, darker rails/header/footer, cyan/blue/gold accents, clearer borders, and stronger readable contrast.
   - Update the main shell, title bar, left rail, call dock, profile menu, dialer, diagnostics, admin panels, and recording/call-history panels to match.
   - Reduce washed-out white areas and make warning/error panels readable.

6. **Validate after implementation**
   - Open Call History and confirm no crash.
   - Open Admin > Call Recordings and confirm domain-wide recordings appear.
   - Retry SIP registration for extension 300 and confirm the diagnostic panel shows the expected URI/auth/source.
   - Confirm only one BUSY/status pill remains.
   - Review the desktop visuals against the attached screenshots.