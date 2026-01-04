import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from './usePortalAuth';

export interface PortalConversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  transcript?: {
    role: string;
    message: string;
    time_in_call_secs: number;
  }[];
  metadata?: Record<string, any>;
  analysis?: {
    evaluation_criteria_results?: Record<string, any>;
    data_collection_results?: Record<string, any>;
    call_successful?: string;
  };
}

export interface PortalConversationsResponse {
  conversations: PortalConversation[];
  total: number;
  has_more: boolean;
}

export interface PortalAnalytics {
  metrics: {
    total_conversations: number;
    successful_conversations: number;
    failed_conversations: number;
    avg_duration: number;
    total_duration: number;
    avg_satisfaction: number;
    today_conversations: number;
    success_rate: number;
  };
  trends: any;
  charts?: {
    conversations_over_time: { date: string; count: number }[];
    peak_hours: { hour: number; count: number }[];
    satisfaction_trend: any[];
  };
}

// Hook for portal conversations
export const usePortalConversations = (page: number = 1, limit: number = 50) => {
  const { session } = usePortal();

  return useQuery({
    queryKey: ['portal-conversations', session?.platformAgentId, page, limit],
    queryFn: async () => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        return { conversations: [], total: 0, has_more: false };
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-conversations', {
        body: {
          action: 'list',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          page,
          limit,
        },
      });

      if (error) throw error;
      return data as PortalConversationsResponse;
    },
    enabled: !!session?.platformAgentId && !!session?.platformApiKey,
    staleTime: 30000,
  });
};

// Hook for single conversation details
export const usePortalConversationDetails = (conversationId: string | null) => {
  const { session } = usePortal();

  return useQuery({
    queryKey: ['portal-conversation-details', conversationId],
    queryFn: async () => {
      if (!conversationId || !session?.platformApiKey) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-conversations', {
        body: {
          action: 'details',
          conversationId,
          apiKey: session.platformApiKey,
        },
      });

      if (error) throw error;
      return data as PortalConversation;
    },
    enabled: !!conversationId && !!session?.platformApiKey,
  });
};

// Hook for portal analytics
export const usePortalAnalytics = (timeframe: string = '7days') => {
  const { session } = usePortal();

  return useQuery({
    queryKey: ['portal-analytics', session?.platformAgentId, timeframe],
    queryFn: async () => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-analytics', {
        body: {
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          timeframe,
          includeCharts: true,
        },
      });

      if (error) throw error;
      return data as PortalAnalytics;
    },
    enabled: !!session?.platformAgentId && !!session?.platformApiKey,
    staleTime: 60000,
  });
};

// Hook for portal knowledge base
export const usePortalKnowledgeBase = () => {
  const { session } = usePortal();

  return useQuery({
    queryKey: ['portal-knowledge-base', session?.platformAgentId],
    queryFn: async () => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        return { documents: [], total: 0 };
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: {
          action: 'list',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!session?.platformAgentId && !!session?.platformApiKey,
  });
};

// Hook for adding knowledge base document
export const usePortalAddKnowledgeDocument = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, content, type = 'text' }: { name: string; content: string; type?: string }) => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        throw new Error('Configuration manquante');
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: {
          action: 'add_text',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          name,
          content,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-knowledge-base'] });
    },
  });
};

// Hook for deleting knowledge base document
export const usePortalDeleteKnowledgeDocument = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        throw new Error('Configuration manquante');
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: {
          action: 'delete',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          documentId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-knowledge-base'] });
    },
  });
};

// Hook for agent config (prompt, first message, etc.)
export const usePortalAgentConfig = () => {
  const { session } = usePortal();

  return useQuery({
    queryKey: ['portal-agent-config', session?.platformAgentId],
    queryFn: async () => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: {
          action: 'get',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!session?.platformAgentId && !!session?.platformApiKey,
  });
};

// Hook for updating agent prompt
export const usePortalUpdatePrompt = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ systemPrompt, firstMessage }: { systemPrompt?: string; firstMessage?: string }) => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        throw new Error('Configuration manquante');
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: {
          action: 'update_prompt',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          systemPrompt,
          firstMessage,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-agent-config'] });
    },
  });
};
