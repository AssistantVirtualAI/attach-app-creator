import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ElevenLabsConversation {
  conversation_id: string;
  agent_id: string;
  agent_name: string;
  platform_agent_id: string;
  start_time?: string;
  end_time?: string;
  call_duration_secs?: number;
  duration?: number;
  status?: string;
  metadata?: any;
  analysis?: {
    summary?: string;
    satisfaction_score?: number;
    sentiment?: string;
    keywords?: string[];
  };
  transcript?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  agentId: string;
  conversationCount: number;
}

export interface ConversationFilters {
  agentId?: string;
  sentiment?: string;
  dateFrom?: string;
  dateTo?: string;
  minDuration?: number;
  maxDuration?: number;
  search?: string;
}

export interface AllAgentsConversationsResponse {
  conversations: ElevenLabsConversation[];
  agents: AgentInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  requiresSetup?: boolean;
  message?: string;
}

export const useAllAgentsConversations = (
  page: number = 1,
  limit: number = 20,
  filters: ConversationFilters = {}
) => {
  return useQuery({
    queryKey: ['all-agents-conversations', page, limit, filters],
    queryFn: async (): Promise<AllAgentsConversationsResponse> => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-all-agents-conversations', {
        body: { 
          page, 
          limit, 
          filters,
          action: 'list'
        }
      });

      if (error) {
        console.error('Error fetching all agents conversations:', error);
        throw error;
      }

      return data as AllAgentsConversationsResponse;
    },
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useConversationDetails = (conversationId: string | null) => {
  return useQuery({
    queryKey: ['conversation-details', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase.functions.invoke('elevenlabs-all-agents-conversations', {
        body: { 
          action: 'details',
          conversationId
        }
      });

      if (error) {
        console.error('Error fetching conversation details:', error);
        throw error;
      }

      return data;
    },
    enabled: !!conversationId,
  });
};

export const useConversationAudio = (conversationId: string | null, format: string = 'mp3') => {
  return useQuery({
    queryKey: ['conversation-audio', conversationId, format],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase.functions.invoke('elevenlabs-all-agents-conversations', {
        body: { 
          action: 'audio',
          conversationId,
          format
        }
      });

      if (error) {
        console.error('Error fetching conversation audio:', error);
        throw error;
      }

      return data;
    },
    enabled: !!conversationId,
  });
};
