// Pure helpers for OrgChatView message state. Extracted so the upsert /
// dedupe / realtime-preservation behavior is unit-testable in isolation.

export type ChatMessage = {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  created_at: string;
  reactions?: Record<string, string[]> | null;
  attachments?: unknown[] | null;
  message_type?: string;
  edited_at?: string | null;
  deleted_at?: string | null;
};

const byCreatedAt = (a: ChatMessage, b: ChatMessage) =>
  a.created_at.localeCompare(b.created_at);

/**
 * Append realtime-incoming messages to the existing list without ever
 * clearing prior state. Messages are deduped by id. Only messages that
 * belong to the active channel are appended.
 */
export function mergeIncoming(
  prev: ChatMessage[],
  incoming: ChatMessage[],
  activeChannelId: string,
): ChatMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  const additions = incoming.filter(
    (m) => m.channel_id === activeChannelId && !seen.has(m.id),
  );
  if (additions.length === 0) return prev;
  return [...prev, ...additions].sort(byCreatedAt);
}

/**
 * Merge the result of an initial channel fetch into existing state. Realtime
 * inserts that arrived during the fetch are preserved (they live in `prev`
 * and override fetched rows with the same id only when the fetched row is
 * newer/identical). State is NEVER cleared — if `fetched` is empty, prior
 * messages are returned unchanged.
 */
export function mergeOnFetch(
  prev: ChatMessage[],
  fetched: ChatMessage[],
  activeChannelId: string,
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of prev) {
    if (m.channel_id === activeChannelId) byId.set(m.id, m);
  }
  // Fetched rows fill in anything we missed but don't overwrite realtime rows
  // already present (realtime row is the freshest source-of-truth for inserts).
  for (const m of fetched) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort(byCreatedAt);
}
