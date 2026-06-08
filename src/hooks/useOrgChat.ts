import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Channel = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  channel_type: "public" | "private";
  members: string[];
  created_at: string;
};

export type ChatMessage = {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  attachments: Array<{ path: string; name: string; mime: string; size: number }> | null;
  reactions: Record<string, string[]> | null;
  message_type: string;
  edited_at: string | null;
  created_at: string;
  parent_message_id?: string | null;
  reply_count?: number;
  last_reply_at?: string | null;
};

async function invoke(action: string, payload?: any) {
  const { data, error } = await supabase.functions.invoke("org-chat", { body: { action, payload } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useChannels() {
  const qc = useQueryClient();
  const query = useQuery<{ channels: Channel[] }>({
    queryKey: ["org-chat-channels"],
    queryFn: () => invoke("list_channels"),
  });
  const create = useMutation({
    mutationFn: (p: { name: string; channel_type: "public" | "private"; description?: string; members?: string[] }) =>
      invoke("create_channel", p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-chat-channels"] }),
  });
  return { query, create };
}

export function useChatMessages(channelId: string | null) {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const query = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ["org-chat-messages", channelId],
    queryFn: () => invoke("list_messages", { channel_id: channelId }),
    enabled: !!channelId,
  });

  useEffect(() => {
    if (query.data?.messages) setMessages(query.data.messages);
  }, [query.data]);

  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`org-chat-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "org_chat_messages", filter: `channel_id=eq.${channelId}` }, (p: any) => {
        setMessages((prev) => (prev.some((m) => m.id === p.new.id) ? prev : [...prev, p.new]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "org_chat_messages", filter: `channel_id=eq.${channelId}` }, (p: any) => {
        setMessages((prev) => prev.map((m) => (m.id === p.new.id ? p.new : m)));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channelId]);

  const send = useMutation({
    mutationFn: (p: { content: string; attachments?: any[] }) =>
      invoke("send_message", { channel_id: channelId, ...p }),
  });
  const edit = useMutation({
    mutationFn: (p: { id: string; content: string }) => invoke("edit_message", p),
  });
  const remove = useMutation({
    mutationFn: (id: string) => invoke("delete_message", { id }),
  });
  const react = useMutation({
    mutationFn: (p: { id: string; emoji: string }) => invoke("toggle_reaction", p),
  });

  const uploadAttachment = useCallback(async (file: File) => {
    const up: any = await invoke("upload_url", { filename: file.name });
    const r = await fetch(up.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!r.ok) throw new Error("upload_failed");
    return { path: up.path, name: file.name, mime: file.type, size: file.size };
  }, []);

  const getSignedUrl = useCallback(async (path: string) => {
    const r: any = await invoke("signed_url", { path });
    return r.url as string;
  }, []);

  return { query, messages, send, edit, remove, react, uploadAttachment, getSignedUrl };
}

// --- Legacy compat for TelephonyTeam (Phase < 4) ---
export function useOrgChat(_orgId?: string) {
  const { query: channelsQuery, create } = useChannels();
  const channels = channelsQuery.data?.channels ?? [];
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const { messages, send } = useChatMessages(activeChannelId);

  return {
    channels,
    activeChannelId,
    setActiveChannelId,
    messages,
    loading: channelsQuery.isLoading,
    sendMessage: async (content: string) => {
      if (!activeChannelId) return;
      await send.mutateAsync({ content });
    },
    createChannel: async (name: string, channel_type: "public" | "private" = "public") => {
      return await create.mutateAsync({ name, channel_type });
    },
  };
}
