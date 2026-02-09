
# Fix: Knowledge Base Documents Not Persisting in ElevenLabs

## Root Cause

The PATCH request to link documents to the agent uses the **wrong format**. The current code sends:

```text
PATCH /convai/agents/{agent_id}
Body: { "knowledge_base": ["doc_id_1", "doc_id_2"] }
```

But ElevenLabs expects the knowledge base to be nested inside `conversation_config.agent.prompt.knowledge_base` as an array of objects:

```text
PATCH /convai/agents/{agent_id}
Body: {
  "conversation_config": {
    "agent": {
      "prompt": {
        "knowledge_base": [
          { "type": "file", "name": "doc name", "id": "doc_id" },
          ...existing docs...
        ]
      }
    }
  }
}
```

This explains why:
- The document IS created in ElevenLabs (the POST to `/convai/knowledge-base/text` works)
- The PATCH reports no error (ElevenLabs silently ignores the unknown top-level `knowledge_base` field)
- The list shows `Agent KB IDs from config: 0 items` (because `agentConfig.knowledge_base` is empty -- the real data is at `agentConfig.conversation_config.agent.prompt.knowledge_base`)
- The document disappears from the UI (filtering finds 0 matching KB IDs)

## Changes

### 1. Fix the Edge Function linking logic

**File**: `supabase/functions/elevenlabs-convai-knowledge-base/index.ts`

In all three creation cases (`create_text`, `create_url`, `create_file`), fix the PATCH call:

**Before (wrong):**
```
const agentConfig = await callElevenLabs(`/convai/agents/${platformAgentId}`);
const currentKbIds = (agentConfig.knowledge_base || []).map(kb => kb.id || kb);
currentKbIds.push(data.id);
await callElevenLabs(`/convai/agents/${platformAgentId}`, {
  method: "PATCH",
  body: JSON.stringify({ knowledge_base: currentKbIds })
});
```

**After (correct):**
```
const agentConfig = await callElevenLabs(`/convai/agents/${platformAgentId}`);
const currentKb = agentConfig?.conversation_config?.agent?.prompt?.knowledge_base || [];
const alreadyLinked = currentKb.some(kb => kb.id === data.id);
if (!alreadyLinked) {
  currentKb.push({ type: "file", name: docName, id: data.id });
  await callElevenLabs(`/convai/agents/${platformAgentId}`, {
    method: "PATCH",
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: {
            knowledge_base: currentKb
          }
        }
      }
    })
  });
}
```

### 2. Fix the list filtering to read from the correct path

In the `list` action, the agent KB IDs extraction also needs to use the correct path:

**Before:**
```
agentKbIds = (agentConfig.knowledge_base || []).map(kb => kb.id || kb);
```

**After:**
```
const kbArray = agentConfig?.conversation_config?.agent?.prompt?.knowledge_base || [];
agentKbIds = kbArray.map(kb => kb.id || kb).filter(Boolean);
```

### 3. Redeploy the edge function

After making the changes, redeploy `elevenlabs-convai-knowledge-base` so all create + list operations use the correct API format.

## Summary of Impact

- Documents will now actually be linked to the agent in ElevenLabs (visible in ElevenLabs dashboard too)
- The list query will correctly find linked documents via the agent config
- Documents will persist in both the Admin Portal and Client Portal knowledge base pages
- No frontend changes needed -- the issue is entirely in the Edge Function
