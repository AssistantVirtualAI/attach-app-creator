## Plan

1. **Fix the extension being loaded**
   - Update the desktop softphone credential flow so it does not blindly use ext `300` for your current login when the intended linked extension is `222/288`.
   - Make the credential response validate that the selected softphone row is active and desktop-enabled.
   - If multiple/incorrect mappings exist, choose the correct active linked extension and show a clear “extension mismatch” state instead of attempting SIP registration with the wrong number.

2. **Repair current data mapping**
   - Check the softphone user rows for `222`, `288`, and `300`.
   - Activate Kenny’s desktop row if needed and ensure Phil/Kenny remain linked to their accounts.
   - If your desktop login should be ext `222` or `288`, update the portal-user mapping so the app loads that extension instead of `300`.

3. **Improve the UI error state**
   - Replace the confusing `Ext N/A / SIP error 403` display with: extension number, account name, desktop access status, SIP registration status, and the exact mismatch reason.
   - Keep only the top availability control.
   - Add a one-click “Sync extension” action that refreshes credentials and restarts SIP after the mapping/password is repaired.

4. **Fix the SIP 403 handling**
   - Keep the existing auto password sync, but prevent repeated retry loops when the extension itself is wrong.
   - Show a helpful message: “Wrong extension credentials loaded” vs “SIP password rejected”.

5. **Validate**
   - Test the `softphone-credentials` function after changes.
   - Confirm the credential response returns `222` or `288` as expected.
   - Confirm the widget no longer initializes `sip:300@lemtel.lemtel.tel` for that desktop session.

## Technical details

- Main files likely affected:
  - `supabase/functions/softphone-credentials/index.ts`
  - `src/hooks/useSoftphone.ts`
  - `src/components/softphone/SoftphoneWidget.tsx`
- Current backend logs confirm the app is returning `extension: "300"` for the logged-in user, which explains the displayed 403 registration failures.