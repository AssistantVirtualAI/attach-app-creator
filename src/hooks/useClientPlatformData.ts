import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Platform } from './useClientAgentAccess';

interface UseClientPlatformParams {
  apiKey: string | null;
  agentId: string | null;
  platform: Platform | null;
  enabled?: boolean;
}

// Unified analytics hook for all platforms
export const useClientPlatformAnalytics = (
  { apiKey, agentId, platform, enabled = true }: UseClientPlatformParams,
  timeframe = '30d'
) => {
  return useQuery({
    queryKey: ['client-platform-analytics', platform, agentId, timeframe],
    queryFn: async () => {
      if (!platform || !apiKey || !agentId) return null;

      let data: any;
      let error: any;

      switch (platform) {
        case 'elevenlabs':
          ({ data, error } = await supabase.functions.invoke('elevenlabs-convai-analytics', {
            body: { apiKey, agentId, timeframe, includeRealtime: true, includeCharts: true }
          }));
          break;

        case 'vapi':
          ({ data, error } = await supabase.functions.invoke('vapi-proxy', {
            body: { action: 'getAnalytics', apiKey, assistantId: agentId, timeframe }
          }));
          // Normalize Vapi response
          if (data) {
            data = normalizeVapiAnalytics(data, timeframe);
          }
          break;

        case 'retell':
          ({ data, error } = await supabase.functions.invoke('retell-proxy', {
            body: { action: 'getAnalytics', apiKey, agentId, timeframe }
          }));
          // Normalize Retell response
          if (data) {
            data = normalizeRetellAnalytics(data, timeframe);
          }
          break;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!apiKey && !!agentId && !!platform,
  });
};

// Unified conversations hook for all platforms
export const useClientPlatformConversations = (
  { apiKey, agentId, platform, enabled = true }: UseClientPlatformParams,
  page = 1,
  limit = 50
) => {
  return useQuery({
    queryKey: ['client-platform-conversations', platform, agentId, page, limit],
    queryFn: async () => {
      if (!platform || !apiKey || !agentId) return null;

      let data: any;
      let error: any;

      switch (platform) {
        case 'elevenlabs':
          ({ data, error } = await supabase.functions.invoke('elevenlabs-convai-conversations', {
            body: { action: 'list', apiKey, agentId, page, limit }
          }));
          break;

        case 'vapi':
          ({ data, error } = await supabase.functions.invoke('vapi-proxy', {
            body: { action: 'listCalls', apiKey, assistantId: agentId, limit, offset: (page - 1) * limit }
          }));
          // Normalize Vapi response
          if (data?.calls) {
            data = normalizeVapiConversations(data.calls);
          }
          break;

        case 'retell':
          ({ data, error } = await supabase.functions.invoke('retell-proxy', {
            body: { action: 'listCalls', apiKey, agentId, limit, offset: (page - 1) * limit }
          }));
          // Normalize Retell response
          if (data?.calls) {
            data = normalizeRetellConversations(data.calls);
          }
          break;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!apiKey && !!agentId && !!platform,
  });
};

// Unified agent config hook for all platforms
export const useClientPlatformAgentConfig = (
  { apiKey, agentId, platform, enabled = true }: UseClientPlatformParams
) => {
  return useQuery({
    queryKey: ['client-platform-agent-config', platform, agentId],
    queryFn: async () => {
      if (!platform || !apiKey || !agentId) return null;

      let data: any;
      let error: any;

      switch (platform) {
        case 'elevenlabs':
          ({ data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
            body: { action: 'get', apiKey, agentId }
          }));
          break;

        case 'vapi':
          ({ data, error } = await supabase.functions.invoke('vapi-proxy', {
            body: { action: 'getAssistant', apiKey, assistantId: agentId }
          }));
          // Normalize to common format
          if (data) {
            data = normalizeVapiConfig(data);
          }
          break;

        case 'retell':
          ({ data, error } = await supabase.functions.invoke('retell-proxy', {
            body: { action: 'getAgent', apiKey, agentId }
          }));
          // Normalize to common format
          if (data) {
            data = normalizeRetellConfig(data);
          }
          break;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!apiKey && !!agentId && !!platform,
  });
};

// Normalization helpers
function normalizeVapiAnalytics(data: any, timeframe: string) {
  const analytics = data.analytics || data;
  return {
    metrics: {
      total_conversations: analytics.totalCalls || 0,
      avg_duration: analytics.avgDuration || 0,
      today_conversations: analytics.callsByDay?.[new Date().toISOString().split('T')[0]] || 0,
      avg_satisfaction: analytics.successRate ? analytics.successRate / 100 : null,
      success_rate: analytics.successRate || 0,
      total_duration: analytics.totalDuration || 0,
    },
    trends: {},
    charts: {
      conversations_over_time: Object.entries(analytics.callsByDay || {}).map(([date, count]) => ({
        date,
        count,
      })),
    },
  };
}

function normalizeRetellAnalytics(data: any, timeframe: string) {
  const analytics = data.analytics || data;
  return {
    metrics: {
      total_conversations: analytics.totalCalls || 0,
      avg_duration: analytics.avgDuration || 0,
      today_conversations: analytics.callsByDay?.[new Date().toISOString().split('T')[0]] || 0,
      avg_satisfaction: analytics.successRate ? analytics.successRate / 100 : null,
      success_rate: analytics.successRate || 0,
      total_duration: analytics.totalDuration || 0,
    },
    trends: {},
    charts: {
      conversations_over_time: Object.entries(analytics.callsByDay || {}).map(([date, count]) => ({
        date,
        count,
      })),
    },
  };
}

function normalizeVapiConversations(calls: any[]) {
  return {
    conversations: calls.map(call => ({
      conversation_id: call.id,
      start_time_unix_secs: call.startedAt ? new Date(call.startedAt).getTime() / 1000 : Date.now() / 1000,
      call_duration_secs: call.duration || 0,
      status: call.status || 'unknown',
      metadata: {
        caller_id: call.customer?.number || call.phoneNumber || 'Unknown',
      },
    })),
    total: calls.length,
  };
}

function normalizeRetellConversations(calls: any[]) {
  return {
    conversations: calls.map(call => ({
      conversation_id: call.call_id || call.id,
      start_time_unix_secs: call.start_timestamp ? call.start_timestamp / 1000 : Date.now() / 1000,
      call_duration_secs: call.call_length || call.duration || 0,
      status: call.call_status || call.status || 'unknown',
      metadata: {
        caller_id: call.from_number || call.caller_id || 'Unknown',
      },
    })),
    total: calls.length,
  };
}

function normalizeVapiConfig(data: any) {
  return {
    agent: {
      name: data.name,
      prompt: {
        prompt: data.model?.messages?.[0]?.content || data.instructions || '',
      },
      first_message: data.firstMessage || '',
      tts: {
        voice_id: data.voice?.voiceId || data.voice?.id || '',
        provider: data.voice?.provider || 'vapi',
      },
    },
    platform: 'vapi',
    raw: data,
  };
}

function normalizeRetellConfig(data: any) {
  return {
    agent: {
      name: data.agent_name || data.name,
      prompt: {
        prompt: data.llm?.prompt || data.prompt || '',
      },
      first_message: data.initial_message || '',
      tts: {
        voice_id: data.voice_id || '',
        provider: 'retell',
      },
    },
    platform: 'retell',
    raw: data,
  };
}
