import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RetellAgentConfig {
  agent_id: string;
  agent_name: string;
  voice_id: string;
  voice_temperature?: number;
  voice_speed?: number;
  language?: string;
  responsiveness?: number;
  interruption_sensitivity?: number;
  enable_backchannel?: boolean;
  ambient_sound?: string;
  ambient_sound_volume?: number;
  response_engine?: {
    type: string;
    llm_id?: string;
  };
  webhook_url?: string;
  boosted_keywords?: string[];
  enable_voicemail_detection?: boolean;
  fallback_voice_ids?: string[];
  pronunciation_dictionary?: any[];
}

export interface RetellLLMConfig {
  llm_id: string;
  model?: string;
  general_prompt?: string;
  begin_message?: string;
  general_tools?: any[];
  states?: any[];
  starting_state?: string;
  model_temperature?: number;
  knowledge_base_ids?: string[];
}

export interface RetellVoice {
  voice_id: string;
  voice_name: string;
  provider: string;
  accent?: string;
  gender?: string;
  age?: string;
  preview_audio_url?: string;
}

interface UseRetellConfigParams {
  agentId: string | null;
  organizationId: string | null;
  apiKey?: string | null;
  enabled?: boolean;
}

// Fetch full agent + LLM config
export function useRetellFullAgentConfig({ agentId, organizationId, apiKey, enabled = true }: UseRetellConfigParams) {
  return useQuery({
    queryKey: ['retell-full-config', agentId, organizationId],
    queryFn: async () => {
      if (!agentId) return null;

      const { data, error } = await supabase.functions.invoke('retell-proxy', {
        body: {
          action: 'getAgent',
          agentId,
          organizationId,
          apiKey,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch agent config');

      const agentConfig: RetellAgentConfig = data.data;
      let llmConfig: RetellLLMConfig | null = null;

      // If agent uses Retell LLM, fetch LLM config too
      if (agentConfig.response_engine?.llm_id) {
        const { data: llmData, error: llmError } = await supabase.functions.invoke('retell-proxy', {
          body: {
            action: 'getLlm',
            llmId: agentConfig.response_engine.llm_id,
            organizationId,
            apiKey,
          },
        });

        if (!llmError && llmData?.success) {
          llmConfig = llmData.data;
        }
      }

      return { agent: agentConfig, llm: llmConfig };
    },
    enabled: enabled && !!agentId,
  });
}

// Fetch available voices
export function useRetellVoices({ organizationId, apiKey }: { organizationId: string | null; apiKey?: string | null }) {
  return useQuery({
    queryKey: ['retell-voices', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('retell-proxy', {
        body: {
          action: 'listVoices',
          organizationId,
          apiKey,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch voices');

      return data.data as RetellVoice[];
    },
    enabled: !!organizationId,
  });
}

// Update agent settings
export function useUpdateRetellAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentId,
      organizationId,
      apiKey,
      config,
    }: {
      agentId: string;
      organizationId: string;
      apiKey?: string;
      config: Partial<RetellAgentConfig>;
    }) => {
      const { data, error } = await supabase.functions.invoke('retell-proxy', {
        body: {
          action: 'updateAgent',
          agentId,
          organizationId,
          apiKey,
          config,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update agent');

      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retell-full-config', variables.agentId] });
      toast.success('Configuration agent mise à jour');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Update LLM settings (prompt, temperature, etc.)
export function useUpdateRetellLLM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      llmId,
      agentId,
      organizationId,
      apiKey,
      config,
    }: {
      llmId: string;
      agentId: string;
      organizationId: string;
      apiKey?: string;
      config: Partial<RetellLLMConfig>;
    }) => {
      const { data, error } = await supabase.functions.invoke('retell-proxy', {
        body: {
          action: 'updateLlm',
          llmId,
          organizationId,
          apiKey,
          config,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update LLM');

      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retell-full-config', variables.agentId] });
      toast.success('Configuration LLM mise à jour');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}
