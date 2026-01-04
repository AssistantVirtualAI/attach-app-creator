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

// Hook for fetching a single knowledge base document content
export const usePortalKnowledgeBaseDocument = (documentId: string | null) => {
  const { session } = usePortal();

  return useQuery({
    queryKey: ['portal-kb-document', documentId],
    queryFn: async () => {
      if (!documentId || !session?.platformAgentId || !session?.platformApiKey) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: {
          action: 'get_document',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          documentId,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!documentId && !!session?.platformAgentId && !!session?.platformApiKey,
  });
};

// Hook for adding knowledge base document
export const usePortalAddKnowledgeDocument = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        throw new Error('Configuration manquante');
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: {
          action: 'create_text',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          title: name,
          content,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-knowledge-base'] });
    },
  });
};

// Hook for updating knowledge base document (recreate strategy)
export const usePortalUpdateKnowledgeDocument = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, name, content, deleteOld = true }: { 
      documentId: string;
      name: string; 
      content: string;
      deleteOld?: boolean;
    }) => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        throw new Error('Configuration manquante');
      }

      // Create new document
      const { data: createData, error: createError } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: {
          action: 'create_text',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          title: name,
          content,
        },
      });

      if (createError) throw createError;
      if (createData?.error) throw new Error(createData.error);

      // Delete old document if requested
      if (deleteOld && documentId) {
        try {
          await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
            body: {
              action: 'delete',
              agentId: session.platformAgentId,
              apiKey: session.platformApiKey,
              documentId,
            },
          });
        } catch (e) {
          console.warn('Could not delete old document:', e);
        }
      }

      return createData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['portal-kb-document'] });
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

// Hook for portal phone numbers
export const usePortalPhoneNumbers = () => {
  const { session } = usePortal();

  return useQuery({
    queryKey: ['portal-phone-numbers', session?.platformAgentId],
    queryFn: async () => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        return { phone_numbers: [] };
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-phone-numbers', {
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

// Hook for syncing conversations
export const usePortalSyncConversations = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!session?.platformAgentId || !session?.platformApiKey) {
        throw new Error('Configuration manquante');
      }

      const { data, error } = await supabase.functions.invoke('sync-elevenlabs-conversations', {
        body: {
          action: 'sync',
          agentId: session.platformAgentId,
          apiKey: session.platformApiKey,
          limit: 100,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-conversations'] });
    },
  });
};

// Hook for conversation audio
export const usePortalConversationAudio = () => {
  const { session } = usePortal();

  return useMutation({
    mutationFn: async ({ conversationId, format = 'mp3' }: { conversationId: string; format?: string }) => {
      if (!session?.platformApiKey) {
        throw new Error('Configuration manquante');
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-conversations', {
        body: {
          action: 'audio',
          conversationId,
          apiKey: session.platformApiKey,
          format,
        },
      });

      if (error) throw error;
      return data;
    },
  });
};
