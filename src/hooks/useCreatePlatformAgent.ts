import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { toast } from 'sonner';

export interface VoiceSettings {
  voice_id: string;
  model_id?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
}

export interface TurnSettings {
  turn_timeout?: number;
  silence_end_call_timeout?: number;
  turn_eagerness?: 'eager' | 'normal' | 'relaxed';
}

export interface ConversationSettings {
  max_duration_seconds?: number;
}

export interface LLMSettings {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ASRSettings {
  provider?: 'elevenlabs' | 'deepgram' | 'google';
  quality?: 'high' | 'standard';
  keywords?: string[];
}

export interface CreateAgentParams {
  platform: 'elevenlabs' | 'vapi' | 'retell';
  name: string;
  systemPrompt: string;
  firstMessage: string;
  voiceSettings: VoiceSettings;
  language?: string;
  turnSettings?: TurnSettings;
  conversationSettings?: ConversationSettings;
  llmSettings?: LLMSettings;
  asrSettings?: ASRSettings;
  clientId?: string;
}

export interface CreateAgentResult {
  agentId: string;
  platformAgentId: string;
  success: boolean;
}

async function createElevenLabsAgent(
  organizationId: string,
  params: CreateAgentParams
): Promise<{ agent_id: string; agent: any }> {
  const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
    body: {
      action: 'create_agent',
      organizationId,
      name: params.name,
      systemPrompt: params.systemPrompt,
      firstMessage: params.firstMessage,
      voiceId: params.voiceSettings.voice_id,
      language: params.language || 'en',
      ttsSettings: {
        model_id: params.voiceSettings.model_id || 'eleven_turbo_v2_5',
        stability: params.voiceSettings.stability ?? 0.5,
        similarity_boost: params.voiceSettings.similarity_boost ?? 0.75,
        style: params.voiceSettings.style,
        speed: params.voiceSettings.speed,
      },
      asrSettings: params.asrSettings,
      turnSettings: params.turnSettings,
      conversationSettings: params.conversationSettings,
      llmSettings: params.llmSettings,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Failed to create agent on ElevenLabs');

  return { agent_id: data.agent_id, agent: data.agent };
}

async function createVapiAgent(
  organizationId: string,
  params: CreateAgentParams
): Promise<{ agent_id: string; agent: any }> {
  const { data, error } = await supabase.functions.invoke('vapi-proxy', {
    body: {
      action: 'createAssistant',
      organizationId,
      name: params.name,
      model: {
        provider: 'openai',
        model: params.llmSettings?.model || 'gpt-4o-mini',
        temperature: params.llmSettings?.temperature ?? 0.7,
        maxTokens: params.llmSettings?.max_tokens || 1000,
        systemPrompt: params.systemPrompt,
      },
      voice: {
        provider: 'elevenlabs',
        voiceId: params.voiceSettings.voice_id,
        stability: params.voiceSettings.stability ?? 0.5,
        similarityBoost: params.voiceSettings.similarity_boost ?? 0.75,
      },
      firstMessage: params.firstMessage,
      silenceTimeoutSeconds: params.turnSettings?.silence_end_call_timeout || 30,
      maxDurationSeconds: params.conversationSettings?.max_duration_seconds || 600,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('Failed to create assistant on Vapi');

  return { agent_id: data.id, agent: data };
}

async function createRetellAgent(
  organizationId: string,
  params: CreateAgentParams
): Promise<{ agent_id: string; agent: any }> {
  const { data, error } = await supabase.functions.invoke('retell-proxy', {
    body: {
      action: 'createAgent',
      organizationId,
      agent_name: params.name,
      voice_id: params.voiceSettings.voice_id,
      response_engine: {
        type: 'retell-llm',
        llm_id: null, // Will be created automatically
      },
      // We need to create LLM first or use inline config
      llm_websocket_url: null,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.agent_id) throw new Error('Failed to create agent on Retell AI');

  return { agent_id: data.agent_id, agent: data };
}

export function useCreatePlatformAgent() {
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<string>('');

  const mutation = useMutation({
    mutationFn: async (params: CreateAgentParams): Promise<CreateAgentResult> => {
      if (!selectedOrgId) throw new Error('No organization selected');

      setProgress('Creating agent on platform...');

      let platformResult: { agent_id: string; agent: any };

      // Create agent on the selected platform
      switch (params.platform) {
        case 'elevenlabs':
          platformResult = await createElevenLabsAgent(selectedOrgId, params);
          break;
        case 'vapi':
          platformResult = await createVapiAgent(selectedOrgId, params);
          break;
        case 'retell':
          platformResult = await createRetellAgent(selectedOrgId, params);
          break;
        default:
          throw new Error(`Unsupported platform: ${params.platform}`);
      }

      setProgress('Saving agent to database...');

      // Save agent to Supabase
      const agentData = {
        name: params.name,
        organization_id: selectedOrgId,
        platform: params.platform,
        platform_agent_id: platformResult.agent_id,
        client_id: params.clientId || null,
        config: JSON.parse(JSON.stringify({
          systemPrompt: params.systemPrompt,
          firstMessage: params.firstMessage,
          voiceSettings: params.voiceSettings,
          language: params.language,
          turnSettings: params.turnSettings,
          conversationSettings: params.conversationSettings,
          llmSettings: params.llmSettings,
          asrSettings: params.asrSettings,
          platformAgent: platformResult.agent,
        })),
      };

      const { data: savedAgent, error: saveError } = await supabase
        .from('agents')
        .insert([agentData])
        .select('id')
        .single();

      if (saveError) throw new Error(`Failed to save agent: ${saveError.message}`);

      setProgress('');

      return {
        agentId: savedAgent.id,
        platformAgentId: platformResult.agent_id,
        success: true,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent created successfully on platform!');
    },
    onError: (error: Error) => {
      setProgress('');
      toast.error(`Failed to create agent: ${error.message}`);
    },
  });

  return {
    createAgent: mutation.mutateAsync,
    isCreating: mutation.isPending,
    progress,
    error: mutation.error,
  };
}
