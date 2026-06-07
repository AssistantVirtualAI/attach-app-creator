import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ChatChannel = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  channel_type: "public" | "private" | "dm" | "announcement";
  members: string[];
  created_at: string;
};

export type ChatMessage = {
  id: string;
  organization_id: string;
  channel_id: string | null;
  sender_id: string | null;
  sender_name: string | null;
  sender_extension: string | null;
  recipient_id: string | null;
  message_type: string;
  content: string;
  attachments: any[];
  reactions: Record<string, string[]>;
  reply_to: string | null;
  read_by: string[];
  edited_at: string | null;
  created_at: string;
};

export function useOrgChat(organizationId?: string | null) {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChannels = useCallback(async () => {
    if (!organizationId) return;
    const { data } = await supabase
      .from("org_chat_channels")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });
    setChannels((data as any) || []);
  }, [organizationId]);

  const loadMessages = useCallback(async (channelId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("org_chat_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(500);
    setMessages((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);
  useEffect(() => { if (activeChannelId) loadMessages(activeChannelId); }, [activeChannelId, loadMessages]);

  useEffect(() => {
    if (!organizationId) return;
    const ch = supabase
      .channel(`chat-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "org_chat_messages", filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          if (m.channel_id === activeChannelId) setMessages((prev) => [...prev, m]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [organizationId, activeChannelId]);

  const sendMessage = useCallback(
    async (content: string, channelId?: string, messageType = "text", attachments: any[] = []) => {
      if (!user || !organizationId) return;
      const cid = channelId ?? activeChannelId;
      if (!cid) return;
      await supabase.from("org_chat_messages").insert({
        organization_id: organizationId,
        channel_id: cid,
        sender_id: user.id,
        sender_name: user.user_metadata?.full_name || user.email,
        message_type: messageType,
        content,
        attachments,
      });
    },
    [user, organizationId, activeChannelId]
  );

  const createChannel = useCallback(
    async (name: string, channel_type: "public" | "private" = "public", description?: string) => {
      if (!user || !organizationId) return null;
      const { data } = await supabase
        .from("org_chat_channels")
        .insert({ organization_id: organizationId, name, channel_type, description, created_by: user.id })
        .select()
        .single();
      await loadChannels();
      return data as any;
    },
    [user, organizationId, loadChannels]
  );

  return { channels, activeChannelId, setActiveChannelId, messages, loading, sendMessage, createChannel, reloadChannels: loadChannels };
}
