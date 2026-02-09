
# Plan: Fix Knowledge Base - Add Documents (File, Text, URL) with Immediate Visibility

## Root Cause Analysis

Two main problems identified:

1. **New documents don't appear in the list after creation**: The edge function creates the document and links it to the agent via a PATCH call, but when the list is immediately refetched, ElevenLabs hasn't yet propagated the `dependent_agents` metadata. The strict filtering (`dependent_agents` must include the agent) then excludes the newly created document.

2. **The Add Document modal (`AddKnowledgeDocumentModal`) is missing file upload support and doesn't pass `organizationId`**: It only has "Texte" and "URL" tabs. The client portal relies on `organizationId` for RBAC, so the modal needs to forward it.

## Changes

### 1. Replace `AddKnowledgeDocumentModal` with a unified modal supporting all 3 types (Text, URL, File)

**File**: `src/components/knowledge/AddKnowledgeDocumentModal.tsx`

- Add a third tab "Fichier" with a file input accepting: `.pdf, .xlsx, .xls, .csv, .doc, .docx, .pptx, .html, .txt, .md`
- Accept `organizationId` as a prop and pass it in all requests
- For file upload, use `FormData` with `action: 'create_file'`
- For text, use JSON with `action: 'create_text'`
- For URL, use JSON with `action: 'create_url'`
- On success, perform an **optimistic cache update**: inject the new item into the `['elevenlabs-knowledge-base', agentId]` query cache immediately, then do a delayed refetch after 3 seconds

### 2. Update `KnowledgeBase.tsx` to pass `organizationId` to the modal

**File**: `src/pages/KnowledgeBase.tsx`

- Pass `organizationId={organizationId}` to `AddKnowledgeDocumentModal`
- Also add optimistic update logic on the page-level after the modal's success callback (invalidate + delayed refetch)

### 3. Fix the Retell add dialog to also support file upload

**File**: `src/pages/KnowledgeBase.tsx`

- Add a file input option to the Retell "add" dialog
- When a file is selected, upload it via the `retell-proxy` edge function's `createKnowledgeBase` action with the file

### 4. Edge function: make newly created documents appear in list immediately

**File**: `supabase/functions/elevenlabs-convai-knowledge-base/index.ts`

- After creating a document and linking it to the agent, include the new document's ID in a "recently_created" context
- In the `list` action: after filtering by `dependent_agents`, also include any documents whose IDs were just created (passed as optional `recentDocIds` param from the frontend)
- **Alternative (simpler)**: Don't change the edge function. Instead, rely entirely on client-side optimistic updates that inject the new item into the cache immediately, and the delayed refetch (3-5 seconds) picks up the real data once ElevenLabs has propagated

The simpler approach (option B) is preferred: keep the edge function as-is and handle visibility through optimistic UI only.

## Technical Details

### AddKnowledgeDocumentModal changes:
```
- New props: organizationId (string)
- New tab: "Fichier" with file input
- File upload: uses FormData with supabase.functions.invoke
- On success: queryClient.setQueryData to optimistically add the item
- Delayed refetch: setTimeout 3s then invalidateQueries
```

### Retell dialog changes:
```
- Add file state and file input
- Upload via retell-proxy with action: 'createKnowledgeBase' + file data
```

### Cache invalidation fix:
```
- Both the modal and the page will use the same query key pattern
- Optimistic update ensures immediate visibility
- Delayed invalidation syncs with backend after 3-5 seconds
```
