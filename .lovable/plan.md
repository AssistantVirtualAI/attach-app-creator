## Fix Plan

1. **Fix the recordings 42703 error**
   - The database has `pbx_call_recordings.summary`, not `pbx_call_recordings.ai_summary`.
   - Update all code paths that expect `ai_summary` from `pbx_call_recordings` to use `summary`, while keeping `pbx_call_records.ai_summary` unchanged.
   - Verify mobile recordings still load from the same PBX playback flow as desktop/portal.

2. **Make People show existing domain extensions**
   - Current data shows `pbx_softphone_users.domain_uuid` is empty, so filtering only by `domain_uuid` returns no contacts.
   - Update mobile People to fall back to `organization_id` when `domain_uuid` is missing/empty.
   - Keep categories separate: **My domain**, **Mobile**, **Manual**.

3. **Make Team Chat show extensions as team members**
   - Update Team Chat member loading to include all `pbx_softphone_users_safe` rows for the user’s organization when domain filtering returns none.
   - Include unlinked extensions too, displaying them as extension contacts/status entries.
   - Keep DMs only for linked portal users; unlinked extensions remain visible as team extensions.

4. **Fix General chat history visibility**
   - Ensure `org-chat` resolves the caller’s organization consistently from softphone/user membership.
   - Ensure `list_channels` creates/returns the General channel and `list_messages` returns existing General messages.
   - Keep realtime reload on `org_chat_messages` for the active channel.

5. **Database/API permissions check**
   - Add/repair grants only if needed for `pbx_softphone_users_safe`, chat tables, and recordings tables.
   - Do not expose credentials or sensitive base-table fields.

6. **Validation**
   - Check schema columns after changes.
   - Verify source queries no longer reference missing `pbx_call_recordings.ai_summary`.
   - Verify mobile People/Team Chat query by org fallback and General message loading path.

## Files expected to change

- `apps/ava-softphone-mobile/src/screens/ContactsScreen.tsx`
- `apps/ava-softphone-mobile/src/screens/TeamChatScreen.tsx`
- `supabase/functions/org-chat/index.ts`
- Any recording files that incorrectly select `pbx_call_recordings.ai_summary`
- A migration only if grants or a compatibility column/view repair is required

## Protected files

I will not modify:
- `vite.config.ts`
- `electron-builder.yml`
- `.github/workflows/`