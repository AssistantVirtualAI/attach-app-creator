import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  TTSSettings,
  ASRSettings,
  TurnSettings,
  ConversationSettings,
  AgentAdvancedSettings,
  PlatformSettings,
  AgentTool,
  WebhookConfig,
  LLMSettings,
  ElevenLabsVoice,
  ElevenLabsModel,
  ElevenLabsFullAgentConfig,
} from '@/types/elevenlabs-full';

interface UseElevenLabsParams {
  agentId: string | null;
  apiKey?: string | null;
  enabled?: boolean;
}

// ============= Fetch Hooks =============

// Fetch complete agent configuration
export const useElevenLabsFullAgentConfig = ({ agentId, apiKey, enabled = true }: UseElevenLabsParams) => {
  return useQuery({
    queryKey: ['elevenlabs-full-config', agentId],
    queryFn: async (): Promise<ElevenLabsFullAgentConfig | null> => {
      if (!agentId) throw new Error('Agent ID required');

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'get',
          agentId,
          apiKey: apiKey || undefined
        }
      });

      if (error) throw error;
      if (data.requiresSetup) {
        throw new Error(data.message || 'Configuration ElevenLabs requise');
      }
      
      return data.agent as ElevenLabsFullAgentConfig;
    },
    enabled: enabled && !!agentId,
    staleTime: 30000,
  });
};

// Fetch available voices
export const useElevenLabsVoices = (apiKey?: string | null) => {
  return useQuery({
    queryKey: ['elevenlabs-voices'],
    queryFn: async (): Promise<ElevenLabsVoice[]> => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'get_voices',
          apiKey: apiKey || undefined
        }
      });

      if (error) throw error;
      return data.voices || [];
    },
    staleTime: 300000, // Cache for 5 minutes
  });
};

// Fetch available models
export const useElevenLabsModels = (apiKey?: string | null) => {
  return useQuery({
    queryKey: ['elevenlabs-models'],
    queryFn: async (): Promise<ElevenLabsModel[]> => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'get_models',
          apiKey: apiKey || undefined
        }
      });

      if (error) throw error;
      return data.models || [];
    },
    staleTime: 300000,
  });
};

// ============= Mutation Hooks =============

// Update TTS settings (full)
export const useUpdateTTSSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      ttsSettings 
    }: { 
      agentId: string; 
      apiKey?: string; 
      ttsSettings: TTSSettings;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_tts_full',
          agentId,
          apiKey: apiKey || undefined,
          ttsSettings
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Paramètres TTS mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour TTS');
    },
  });
};

// Update ASR settings
export const useUpdateASRSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      asrSettings 
    }: { 
      agentId: string; 
      apiKey?: string; 
      asrSettings: ASRSettings;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_asr',
          agentId,
          apiKey: apiKey || undefined,
          asrSettings
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Paramètres ASR mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour ASR');
    },
  });
};

// Update Turn settings
export const useUpdateTurnSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      turnSettings 
    }: { 
      agentId: string; 
      apiKey?: string; 
      turnSettings: TurnSettings;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_turn',
          agentId,
          apiKey: apiKey || undefined,
          turnSettings
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Paramètres de tour mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour des tours');
    },
  });
};

// Update Conversation settings
export const useUpdateConversationSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      conversationSettings 
    }: { 
      agentId: string; 
      apiKey?: string; 
      conversationSettings: ConversationSettings;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_conversation',
          agentId,
          apiKey: apiKey || undefined,
          conversationSettings
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Paramètres de conversation mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
};

// Update Agent Advanced settings
export const useUpdateAgentAdvancedSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      agentAdvancedSettings 
    }: { 
      agentId: string; 
      apiKey?: string; 
      agentAdvancedSettings: AgentAdvancedSettings;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_agent_advanced',
          agentId,
          apiKey: apiKey || undefined,
          agentAdvancedSettings
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Paramètres agent avancés mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
};

// Update Platform settings
export const useUpdatePlatformSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      platformSettings 
    }: { 
      agentId: string; 
      apiKey?: string; 
      platformSettings: PlatformSettings;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_platform_settings',
          agentId,
          apiKey: apiKey || undefined,
          platformSettings
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Paramètres plateforme mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
};

// Update Tools
export const useUpdateAgentTools = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      tools 
    }: { 
      agentId: string; 
      apiKey?: string; 
      tools: AgentTool[];
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_tools',
          agentId,
          apiKey: apiKey || undefined,
          tools
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Outils mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour des outils');
    },
  });
};

// Update Webhooks
export const useUpdateWebhooks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      webhookConfig 
    }: { 
      agentId: string; 
      apiKey?: string; 
      webhookConfig: WebhookConfig;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_webhooks',
          agentId,
          apiKey: apiKey || undefined,
          webhookConfig
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Webhooks mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour des webhooks');
    },
  });
};

// Update LLM settings
export const useUpdateLLMSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      llmSettings 
    }: { 
      agentId: string; 
      apiKey?: string; 
      llmSettings: LLMSettings;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_llm',
          agentId,
          apiKey: apiKey || undefined,
          llmSettings
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Paramètres LLM mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour LLM');
    },
  });
};

// Update Prompt
export const useUpdatePrompt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      prompt,
      firstMessage 
    }: { 
      agentId: string; 
      apiKey?: string; 
      prompt: string;
      firstMessage?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_prompt',
          agentId,
          apiKey: apiKey || undefined,
          prompt,
          firstMessage
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Prompt mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour du prompt');
    },
  });
};

// Full config update
export const useUpdateFullConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      fullConfig 
    }: { 
      agentId: string; 
      apiKey?: string; 
      fullConfig: Partial<ElevenLabsFullAgentConfig>;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_full',
          agentId,
          apiKey: apiKey || undefined,
          fullConfig
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la mise à jour');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-full-config', variables.agentId] });
      toast.success('Configuration complète mise à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
};
