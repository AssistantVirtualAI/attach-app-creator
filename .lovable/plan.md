
# Fix: Client Portal Knowledge Base Upload + Caller Phone Number Display

## Problem 1: Knowledge Base Document Upload Fails in Client Portal

**Root cause**: The `elevenlabs-convai-knowledge-base` Edge Function performs RBAC checks for write actions (`add`, `create_text`, etc.) by validating a Supabase JWT from the `Authorization` header. However, the client portal uses **sessionStorage-based authentication** (not Supabase Auth), so there is no valid JWT token. The function returns "Acces refuse" (403).

**Fix**: Add an alternative authentication path in the Edge Function that accepts `organizationId` from the request body (which the client portal already sends) and validates it against the agents table. When a valid `organizationId` is provided and maps to a real agent, allow the write operation without requiring a Supabase JWT.

| File | Action |
|------|--------|
| `supabase/functions/elevenlabs-convai-knowledge-base/index.ts` | **Modify** -- In the RBAC write check (lines 117-206), add a fallback: if no auth header is present but `organizationId` is provided in the body, verify that the `organizationId` exists in the `organizations` table and that the `agentId` belongs to that organization. If valid, allow the operation. |

---

## Problem 2: Caller Phone Number Not Displayed

There are two sub-issues:

### 2a. Admin Portal (Conversations.tsx)
**Root cause**: The `elevenlabs-all-agents-conversations` Edge Function correctly adds `caller_number` to the normalized conversation object. However, the ElevenLabs API list endpoint (`/v1/convai/conversations`) does **not** return `caller_id` in its response -- caller info is only available in the **detailed** conversation endpoint (`/v1/convai/conversations/{id}`). So `conv.caller_id` is always `undefined`, meaning `caller_number` is always empty.

**Fix**: After fetching conversations from ElevenLabs, batch-fetch details for each conversation (or at least the first page) to extract caller information. Alternatively, use a more efficient approach: fetch the conversation detail only when displaying, or parse the metadata fields that ElevenLabs does include in the list response.

| File | Action |
|------|--------|
| `supabase/functions/elevenlabs-all-agents-conversations/index.ts` | **Modify** -- For ElevenLabs conversations, check additional fields from the list API response (e.g., `conv.call_id`, `conv.metadata.phone_number`, `conv.metadata.caller_id`). Also, for the most recent conversations (first page), optionally fetch details in parallel to extract `caller_id` from the detail endpoint. |

### 2b. Client Portal (PortalConversations.tsx)
**Root cause**: The client portal uses `elevenlabs-convai-conversations` Edge Function which returns raw ElevenLabs list data **without any caller_number normalization**. The `PortalConversation` TypeScript interface doesn't even have a `caller_number` field. The UI at line 379-380 just shows `conversation_id.slice(0, 8)...`.

**Fix**:
1. Update the `elevenlabs-convai-conversations` Edge Function to extract caller info from conversation details
2. Add `caller_number` to the `PortalConversation` interface
3. Update `PortalConversations.tsx` to display the caller number instead of the conversation ID

| File | Action |
|------|--------|
| `supabase/functions/elevenlabs-convai-conversations/index.ts` | **Modify** -- For each conversation in the list response, fetch details in parallel (batched) to extract caller_id. Add `caller_number` to the returned data. |
| `src/hooks/usePortalElevenLabs.ts` | **Modify** -- Add `caller_number` to `PortalConversation` interface |
| `src/pages/PortalConversations.tsx` | **Modify** -- Display `caller_number` (or metadata caller info) instead of truncated conversation ID at line 379-380. Also pass it to the AdvancedAudioPlayer at line 570. |

---

## Technical Details

### Knowledge Base RBAC Fix
```
Current flow (fails):
  Client portal -> Edge Function -> checks Authorization header -> no JWT -> 403

New flow:
  Client portal -> Edge Function -> no auth header? 
    -> check if organizationId is provided
    -> verify organizationId exists in organizations table
    -> verify agentId belongs to this organization
    -> if valid -> allow write
```

### Caller Number Extraction Strategy
For ElevenLabs, the list endpoint returns minimal data. To get caller info, we need to:
1. Fetch conversation details for each conversation in parallel (with concurrency limit)
2. Extract `caller_id` from the detail response metadata
3. Cache/include it in the normalized response

To keep performance reasonable, we will limit detail fetching to the first 20-30 conversations per page and use `Promise.allSettled` for parallel fetching.

### Files Summary

| File | Action |
|------|--------|
| `supabase/functions/elevenlabs-convai-knowledge-base/index.ts` | **Modify** -- Add organizationId-based auth for client portal write operations |
| `supabase/functions/elevenlabs-all-agents-conversations/index.ts` | **Modify** -- Fetch ElevenLabs conversation details to extract caller_number |
| `supabase/functions/elevenlabs-convai-conversations/index.ts` | **Modify** -- Add caller_number extraction from conversation details |
| `src/hooks/usePortalElevenLabs.ts` | **Modify** -- Add caller_number to PortalConversation interface |
| `src/pages/PortalConversations.tsx` | **Modify** -- Display caller phone number instead of conversation ID |
