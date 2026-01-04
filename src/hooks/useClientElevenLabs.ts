import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseClientElevenLabsParams {
  apiKey: string | null;
  agentId: string | null;
  enabled?: boolean;
}

// Hook for fetching conversations via ElevenLabs API
export const useClientElevenLabsConversations = ({ apiKey, agentId, enabled = true }: UseClientElevenLabsParams, page = 1, limit = 50) => {
  return useQuery({
    queryKey: ['client-elevenlabs-conversations', agentId, page, limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-conversations', {
        body: { 
          action: 'list',
          apiKey,
          agentId,
          page,
          limit
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!apiKey && !!agentId,
  });
};

// Hook for fetching conversation details
export const useClientElevenLabsConversationDetails = ({ apiKey, agentId, enabled = true }: UseClientElevenLabsParams, conversationId: string | undefined) => {
  return useQuery({
    queryKey: ['client-elevenlabs-conversation-details', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-conversations', {
        body: { 
          action: 'details',
          apiKey,
          agentId,
          conversationId
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!apiKey && !!agentId && !!conversationId,
  });
};

// Hook for fetching analytics
export const useClientElevenLabsAnalytics = ({ apiKey, agentId, enabled = true }: UseClientElevenLabsParams, timeframe = '7d') => {
  return useQuery({
    queryKey: ['client-elevenlabs-analytics', agentId, timeframe],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-analytics', {
        body: { 
          apiKey,
          agentId,
          timeframe,
          includeRealtime: true,
          includeCharts: true
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!apiKey && !!agentId,
  });
};

// Hook for fetching knowledge base
export const useClientElevenLabsKnowledgeBase = ({ apiKey, agentId, enabled = true }: UseClientElevenLabsParams) => {
  return useQuery({
    queryKey: ['client-elevenlabs-knowledge-base', agentId],
    queryFn: async () => {
      console.log('[Client KB] Fetching knowledge base for agent:', agentId);
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'list',
          apiKey,
          agentId,
          pageSize: 100
        }
      });

      if (error) {
        console.error('[Client KB] Error:', error);
        throw error;
      }
      console.log('[Client KB] Response:', data);
      return data;
    },
    enabled: enabled && !!apiKey && !!agentId,
  });
};

// Hook for updating knowledge base
export const useClientUpdateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ apiKey, agentId, title, content, category }: { 
      apiKey: string; 
      agentId: string; 
      title: string; 
      content: string; 
      category: string; 
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'update',
          apiKey,
          agentId,
          title,
          content,
          category
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-elevenlabs-knowledge-base', variables.agentId] });
      toast.success('Base de connaissances mise à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
};

// Hook for fetching agent config (prompt, voice settings)
export const useClientElevenLabsAgentConfig = ({ apiKey, agentId, enabled = true }: UseClientElevenLabsParams) => {
  return useQuery({
    queryKey: ['client-elevenlabs-agent-config', agentId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'get',
          apiKey,
          agentId
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!apiKey && !!agentId,
  });
};

// Hook for updating agent prompt
export const useClientUpdateAgentPrompt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ apiKey, agentId, prompt }: { apiKey: string; agentId: string; prompt: string }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_prompt',
          apiKey,
          agentId,
          prompt
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-elevenlabs-agent-config', variables.agentId] });
      toast.success('Prompt mis à jour avec succès');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour du prompt');
    },
  });
};

// Hook for generating conversation audio
export const useClientElevenLabsAudio = () => {
  return useMutation({
    mutationFn: async ({ apiKey, agentId, conversationId, format = 'mp3' }: { 
      apiKey: string; 
      agentId: string; 
      conversationId: string; 
      format?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-conversations', {
        body: { 
          action: 'audio',
          apiKey,
          agentId,
          conversationId,
          format
        }
      });

      if (error) throw error;
      return data;
    },
  });
};
