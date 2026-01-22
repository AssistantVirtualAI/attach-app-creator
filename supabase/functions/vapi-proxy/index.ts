import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPI_BASE_URL = 'https://api.vapi.ai';

// Static voice lists for providers that don't have APIs
const DEEPGRAM_VOICES = [
  { voice_id: 'aura-asteria-en', name: 'Asteria', gender: 'female', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-luna-en', name: 'Luna', gender: 'female', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-stella-en', name: 'Stella', gender: 'female', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-athena-en', name: 'Athena', gender: 'female', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-hera-en', name: 'Hera', gender: 'female', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-orion-en', name: 'Orion', gender: 'male', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-arcas-en', name: 'Arcas', gender: 'male', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-perseus-en', name: 'Perseus', gender: 'male', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-angus-en', name: 'Angus', gender: 'male', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-orpheus-en', name: 'Orpheus', gender: 'male', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-helios-en', name: 'Helios', gender: 'male', language: 'en', provider: 'deepgram' },
  { voice_id: 'aura-zeus-en', name: 'Zeus', gender: 'male', language: 'en', provider: 'deepgram' },
];

const PLAYHT_VOICES = [
  { voice_id: 's3://voice-cloning-zero-shot/775ae416-49bb-4fb6-bd45-740f205d20a1/jennifersaad/manifest.json', name: 'Jennifer (Conversational)', gender: 'female', language: 'en', provider: 'playht' },
  { voice_id: 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/susanad/manifest.json', name: 'Susana', gender: 'female', language: 'en', provider: 'playht' },
  { voice_id: 's3://voice-cloning-zero-shot/820da3d2-3a3b-42e7-844d-e68db835a206/michaelsaad/manifest.json', name: 'Michael (Conversational)', gender: 'male', language: 'en', provider: 'playht' },
  { voice_id: 's3://voice-cloning-zero-shot/e5df2eb3-5153-40fa-9f6e-6e27bbb7a38e/jacksaad/manifest.json', name: 'Jack (Conversational)', gender: 'male', language: 'en', provider: 'playht' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, apiKey, organizationId, agentId, ...params } = await req.json();

    console.log(`[Vapi] Request received - Action: ${action}, OrganizationId: ${organizationId || 'NOT PROVIDED'}, AgentId: ${agentId || 'N/A'}`);

    if (!action) {
      throw new Error('Missing required parameter: action');
    }

    // Get API key from integration if not provided directly
    let vapiApiKey = apiKey;
    let elevenLabsApiKey: string | null = null;
    
    if (!vapiApiKey && organizationId) {
      console.log(`[Vapi] Fetching API key for organization: ${organizationId}`);
      const { data: integration, error: integrationError } = await supabase
        .from('organization_integrations')
        .select('api_key')
        .eq('organization_id', organizationId)
        .eq('platform', 'vapi')
        .eq('is_active', true)
        .single();

      if (integrationError) {
        console.error(`[Vapi] Integration query error:`, integrationError);
      }

      if (integration) {
        console.log(`[Vapi] Found API key for organization`);
        vapiApiKey = integration.api_key;
      } else {
        console.log(`[Vapi] No integration found for organization ${organizationId}`);
      }

      // Also try to get ElevenLabs API key for voice fetching
      const { data: elevenLabsIntegration } = await supabase
        .from('organization_integrations')
        .select('api_key')
        .eq('organization_id', organizationId)
        .eq('platform', 'elevenlabs')
        .eq('is_active', true)
        .single();
      
      if (elevenLabsIntegration) {
        elevenLabsApiKey = elevenLabsIntegration.api_key;
      }
    } else if (!organizationId) {
      console.log(`[Vapi] No organizationId provided in request`);
    }

    if (!vapiApiKey) {
      throw new Error('API key not found. Please configure Vapi integration.');
    }

    console.log(`[Vapi] Processing action: ${action}`);

    let result;
    
    switch (action) {
      // Assistants
      case 'listAssistants':
        result = await vapiRequest(vapiApiKey, 'GET', '/assistant', params);
        break;
      case 'getAssistant':
        if (!params.assistantId) throw new Error('assistantId is required');
        result = await vapiRequest(vapiApiKey, 'GET', `/assistant/${params.assistantId}`);
        break;
      
      // Enhanced createAssistant with full configuration
      case 'createAssistant': {
        const assistantConfig: any = {
          name: params.name,
        };

        // Model configuration
        if (params.systemPrompt) {
          assistantConfig.model = {
            provider: params.llmProvider || 'openai',
            model: params.llmModel || 'gpt-4o-mini',
            temperature: params.temperature ?? 0.7,
            maxTokens: params.maxTokens || 1000,
            messages: [{ role: 'system', content: params.systemPrompt }],
          };
        } else if (params.config?.model) {
          assistantConfig.model = params.config.model;
        }

        // Voice configuration
        if (params.voiceId) {
          const voiceProvider = params.voiceProvider || 'elevenlabs';
          assistantConfig.voice = {
            provider: voiceProvider,
            voiceId: params.voiceId,
          };
          
          // Provider-specific settings
          if (voiceProvider === 'elevenlabs') {
            assistantConfig.voice.stability = params.stability ?? 0.5;
            assistantConfig.voice.similarityBoost = params.similarityBoost ?? 0.75;
            if (params.style !== undefined) assistantConfig.voice.style = params.style;
          }
        } else if (params.config?.voice) {
          assistantConfig.voice = params.config.voice;
        }

        // First message
        if (params.firstMessage) {
          assistantConfig.firstMessage = params.firstMessage;
        } else if (params.config?.firstMessage) {
          assistantConfig.firstMessage = params.config.firstMessage;
        }

        // Timing settings
        if (params.silenceTimeout !== undefined) {
          assistantConfig.silenceTimeoutSeconds = params.silenceTimeout;
        }
        if (params.maxDuration !== undefined) {
          assistantConfig.maxDurationSeconds = params.maxDuration;
        }

        // Additional features
        if (params.endCallEnabled !== undefined) {
          assistantConfig.endCallFunctionEnabled = params.endCallEnabled;
        }
        if (params.metadata) {
          assistantConfig.metadata = params.metadata;
        }

        // Merge with any additional config
        if (params.config) {
          Object.assign(assistantConfig, params.config);
        }

        console.log('[Vapi] Creating assistant with config:', JSON.stringify(assistantConfig, null, 2));
        result = await vapiRequest(vapiApiKey, 'POST', '/assistant', undefined, assistantConfig);
        break;
      }

      case 'updateAssistant':
        if (!params.assistantId) throw new Error('assistantId is required');
        result = await vapiRequest(vapiApiKey, 'PATCH', `/assistant/${params.assistantId}`, undefined, params.config);
        break;
      case 'deleteAssistant':
        if (!params.assistantId) throw new Error('assistantId is required');
        result = await vapiRequest(vapiApiKey, 'DELETE', `/assistant/${params.assistantId}`);
        break;

      // Voices - Multi-provider support
      case 'listVoices': {
        const voiceProvider = params.provider || 'all';
        const voices: any[] = [];

        if (voiceProvider === 'all' || voiceProvider === 'elevenlabs') {
          // Fetch from ElevenLabs if API key available
          if (elevenLabsApiKey || params.elevenLabsApiKey) {
            try {
              const elResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': elevenLabsApiKey || params.elevenLabsApiKey }
              });
              if (elResponse.ok) {
                const elData = await elResponse.json();
                const elVoices = (elData.voices || []).map((v: any) => ({
                  voice_id: v.voice_id,
                  name: v.name,
                  gender: v.labels?.gender || 'unknown',
                  language: v.labels?.language || 'en',
                  accent: v.labels?.accent,
                  description: v.description,
                  preview_url: v.preview_url,
                  category: v.category,
                  provider: 'elevenlabs',
                }));
                voices.push(...elVoices);
              }
            } catch (e) {
              console.error('[Vapi] Failed to fetch ElevenLabs voices:', e);
            }
          }
        }

        if (voiceProvider === 'all' || voiceProvider === 'deepgram') {
          voices.push(...DEEPGRAM_VOICES);
        }

        if (voiceProvider === 'all' || voiceProvider === 'playht') {
          voices.push(...PLAYHT_VOICES);
        }

        result = voices;
        break;
      }

      // Calls
      case 'listCalls':
        result = await vapiRequest(vapiApiKey, 'GET', '/call', {
          limit: params.limit || 100,
          ...(params.assistantId && { assistantId: params.assistantId }),
          ...(params.createdAtGt && { createdAtGt: params.createdAtGt }),
          ...(params.createdAtLt && { createdAtLt: params.createdAtLt }),
        });
        break;
      case 'getCall':
        if (!params.callId) throw new Error('callId is required');
        result = await vapiRequest(vapiApiKey, 'GET', `/call/${params.callId}`);
        break;
      case 'createCall':
        result = await vapiRequest(vapiApiKey, 'POST', '/call/phone', undefined, {
          assistantId: agentId || params.assistantId,
          phoneNumberId: params.phoneNumberId,
          customer: { number: params.to },
          ...(params.metadata && { metadata: params.metadata }),
        });
        break;

      // Phone Numbers
      case 'listPhoneNumbers':
        result = await vapiRequest(vapiApiKey, 'GET', '/phone-number', params);
        break;
      case 'getPhoneNumber':
        if (!params.phoneNumberId) throw new Error('phoneNumberId is required');
        result = await vapiRequest(vapiApiKey, 'GET', `/phone-number/${params.phoneNumberId}`);
        break;
      case 'buyPhoneNumber':
        result = await vapiRequest(vapiApiKey, 'POST', '/phone-number', undefined, {
          provider: params.provider || 'twilio',
          areaCode: params.areaCode,
          ...(params.assistantId && { assistantId: params.assistantId }),
        });
        break;
      case 'updatePhoneNumber':
        if (!params.phoneNumberId) throw new Error('phoneNumberId is required');
        result = await vapiRequest(vapiApiKey, 'PATCH', `/phone-number/${params.phoneNumberId}`, undefined, params.config);
        break;

      // Squads
      case 'listSquads':
        result = await vapiRequest(vapiApiKey, 'GET', '/squad', params);
        break;
      case 'getSquad':
        if (!params.squadId) throw new Error('squadId is required');
        result = await vapiRequest(vapiApiKey, 'GET', `/squad/${params.squadId}`);
        break;
      case 'createSquad':
        result = await vapiRequest(vapiApiKey, 'POST', '/squad', undefined, params.config);
        break;

      // Files / Knowledge Base
      case 'listFiles':
        result = await vapiRequest(vapiApiKey, 'GET', '/file');
        break;
      case 'getFile':
        if (!params.fileId) throw new Error('fileId is required');
        result = await vapiRequest(vapiApiKey, 'GET', `/file/${params.fileId}`);
        break;
      case 'createFile':
        const filePayload: any = {
          name: params.name || 'document.txt',
          purpose: 'assistants',
        };
        if (params.content) {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(params.content);
          const base64 = btoa(String.fromCharCode(...bytes));
          filePayload.bytes = base64;
          filePayload.mimetype = 'text/plain';
        }
        if (params.url) {
          filePayload.url = params.url;
        }
        result = await vapiRequest(vapiApiKey, 'POST', '/file', undefined, filePayload);
        break;
      case 'deleteFile':
        if (!params.fileId) throw new Error('fileId is required');
        result = await vapiRequest(vapiApiKey, 'DELETE', `/file/${params.fileId}`);
        break;

      case 'getFileContent': {
        if (!params.fileId) throw new Error('fileId is required');
        
        const fileData = await vapiRequest(vapiApiKey, 'GET', `/file/${params.fileId}`);
        const fileUrl = params.fileUrl || fileData?.url;
        
        if (!fileUrl) {
          result = { content: null, contentUnavailableReason: 'no_url' };
          break;
        }
        
        try {
          console.log(`[Vapi] Fetching file content from: ${fileUrl}`);
          const contentResponse = await fetch(fileUrl);
          
          if (!contentResponse.ok) {
            result = { content: null, contentUnavailableReason: 'fetch_failed' };
            break;
          }
          
          const contentType = contentResponse.headers.get('content-type') || '';
          console.log(`[Vapi] File content-type: ${contentType}`);
          
          if (contentType.includes('text/') || 
              contentType.includes('application/json') || 
              contentType.includes('application/xml') ||
              contentType.includes('application/javascript')) {
            const textContent = await contentResponse.text();
            const truncatedContent = textContent.slice(0, 100000);
            result = { 
              content: truncatedContent, 
              contentType,
              truncated: textContent.length > 100000 
            };
          } else {
            result = { content: null, contentUnavailableReason: 'binary_content', contentType };
          }
        } catch (fetchError) {
          console.error('[Vapi] Error fetching file content:', fetchError);
          result = { content: null, contentUnavailableReason: 'fetch_exception' };
        }
        break;
      }
      
      // Knowledge Bases
      case 'listKnowledgeBases':
        result = await vapiRequest(vapiApiKey, 'GET', '/knowledge-base');
        break;
      case 'getKnowledgeBase':
        if (!params.knowledgeBaseId) throw new Error('knowledgeBaseId is required');
        result = await vapiRequest(vapiApiKey, 'GET', `/knowledge-base/${params.knowledgeBaseId}`);
        break;
      case 'createKnowledgeBase':
        result = await vapiRequest(vapiApiKey, 'POST', '/knowledge-base', undefined, {
          name: params.name || 'New Knowledge Base',
          ...(params.fileIds && { fileIds: params.fileIds }),
        });
        break;
      case 'deleteKnowledgeBase':
        if (!params.knowledgeBaseId) throw new Error('knowledgeBaseId is required');
        result = await vapiRequest(vapiApiKey, 'DELETE', `/knowledge-base/${params.knowledgeBaseId}`);
        break;

      // Analytics (computed from calls)
      case 'getAnalytics':
        const timeframe = params.timeframe || '7d';
        const startDate = getStartDate(timeframe);
        
        const callsQuery: any = {
          limit: 1000,
          createdAtGt: startDate.toISOString(),
        };
        
        if (agentId || params.assistantId) {
          callsQuery.assistantId = agentId || params.assistantId;
        }
        
        const calls = await vapiRequest(vapiApiKey, 'GET', '/call', callsQuery);
        
        const callsArray = Array.isArray(calls) ? calls : [];
        console.log(`[Vapi] Retrieved ${callsArray.length} calls for analytics`);
        result = computeAnalytics(callsArray);
        break;

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    console.log(`[Vapi] Action ${action} completed successfully`);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Vapi] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function vapiRequest(
  apiKey: string, 
  method: string, 
  endpoint: string, 
  queryParams?: Record<string, any>,
  body?: any
) {
  let url = `${VAPI_BASE_URL}${endpoint}`;
  
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    url += `?${params.toString()}`;
  }

  console.log(`[Vapi] ${method} ${url}`);

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Vapi] API Error: ${response.status} - ${errorText}`);
    throw new Error(`Vapi API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  if (!text) return { success: true };
  
  try {
    return JSON.parse(text);
  } catch {
    return { success: true, message: text };
  }
}

function getStartDate(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case '24h':
      now.setHours(now.getHours() - 24);
      break;
    case '7d':
    case '7days':
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
    case '30days':
      now.setDate(now.getDate() - 30);
      break;
    case '90d':
      now.setDate(now.getDate() - 90);
      break;
  }
  return now;
}

function computeAnalytics(calls: any[]) {
  const totalCalls = calls.length;
  let totalDuration = 0;
  let completedCalls = 0;
  const callsByStatus: Record<string, number> = {};
  const callsByDay: Record<string, number> = {};

  for (const call of calls) {
    const status = call.status || 'unknown';
    callsByStatus[status] = (callsByStatus[status] || 0) + 1;

    if (call.endedAt && call.startedAt) {
      const duration = (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000;
      totalDuration += duration;
    }

    if (status === 'ended') {
      completedCalls++;
    }

    const day = call.createdAt?.split('T')[0];
    if (day) {
      callsByDay[day] = (callsByDay[day] || 0) + 1;
    }
  }

  return {
    totalCalls,
    completedCalls,
    totalDuration: Math.round(totalDuration),
    avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
    successRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
    callsByStatus,
    callsByDay,
  };
}
