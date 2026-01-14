import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETELL_BASE_URL = 'https://api.retellai.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, apiKey, organizationId, agentId, ...params } = await req.json();

    console.log(`[Retell] Request received - Action: ${action}, OrganizationId: ${organizationId || 'NOT PROVIDED'}, AgentId: ${agentId || 'N/A'}`);

    if (!action) {
      throw new Error('Missing required parameter: action');
    }

    // Get API key from integration if not provided directly
    let retellApiKey = apiKey;
    if (!retellApiKey && organizationId) {
      console.log(`[Retell] Fetching API key for organization: ${organizationId}`);
      const { data: integration, error: integrationError } = await supabase
        .from('organization_integrations')
        .select('api_key')
        .eq('organization_id', organizationId)
        .eq('platform', 'retell')
        .eq('is_active', true)
        .single();

      if (integrationError) {
        console.error(`[Retell] Integration query error:`, integrationError);
      }

      if (integration) {
        console.log(`[Retell] Found API key for organization`);
        retellApiKey = integration.api_key;
      } else {
        console.log(`[Retell] No integration found for organization ${organizationId}`);
      }
    } else if (!organizationId) {
      console.log(`[Retell] No organizationId provided in request`);
    }

    if (!retellApiKey) {
      throw new Error('API key not found. Please configure Retell integration.');
    }

    console.log(`[Retell] Processing action: ${action}`);

    let result;
    
    switch (action) {
      // Agents
      case 'listAgents':
        result = await retellRequest(retellApiKey, 'GET', '/list-agents');
        break;
      case 'getAgent':
        if (!params.retellAgentId && !agentId) throw new Error('retellAgentId is required');
        result = await retellRequest(retellApiKey, 'GET', `/get-agent/${params.retellAgentId || agentId}`);
        break;
      case 'createAgent':
        result = await retellRequest(retellApiKey, 'POST', '/create-agent', undefined, params.config);
        break;
      case 'updateAgent':
        if (!params.retellAgentId && !agentId) throw new Error('retellAgentId is required');
        result = await retellRequest(retellApiKey, 'PATCH', `/update-agent/${params.retellAgentId || agentId}`, undefined, params.config);
        break;
      case 'deleteAgent':
        if (!params.retellAgentId) throw new Error('retellAgentId is required');
        result = await retellRequest(retellApiKey, 'DELETE', `/delete-agent/${params.retellAgentId}`);
        break;

      // Calls
      case 'listCalls': {
        const callFilters: any = {};
        const retellAgentIdForCalls = params.retellAgentId || agentId;
        if (retellAgentIdForCalls) callFilters.agent_id = [retellAgentIdForCalls];
        if (params.limit) callFilters.limit = params.limit;
        if (params.sortOrder) callFilters.sort_order = params.sortOrder;

        console.log(`[Retell] listCalls - Filters:`, callFilters);

        // NOTE: Retell's calls endpoints are versioned under /v2
        const raw = await retellRequest(
          retellApiKey,
          'POST',
          '/v2/list-calls',
          undefined,
          Object.keys(callFilters).length > 0 ? { filter_criteria: callFilters } : {}
        );

        // Retell responses can vary: sometimes array, sometimes an object containing the array.
        const callsArray = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.calls)
            ? raw.calls
            : Array.isArray(raw?.call_details)
              ? raw.call_details
              : [];

        console.log(`[Retell] listCalls - Got ${callsArray.length} calls`);
        result = callsArray;
        break;
      }
      case 'getCall':
        if (!params.callId) throw new Error('callId is required');
        // NOTE: Retell's call detail endpoint is versioned under /v2
        result = await retellRequest(retellApiKey, 'GET', `/v2/get-call/${params.callId}`);
        break;
      case 'createCall':
        result = await retellRequest(retellApiKey, 'POST', '/v2/create-phone-call', undefined, {
          from_number: params.from,
          to_number: params.to,
          agent_id: agentId || params.retellAgentId,
          ...(params.metadata && { metadata: params.metadata }),
        });
        break;

      // Phone Numbers
      case 'listPhoneNumbers':
        result = await retellRequest(retellApiKey, 'GET', '/list-phone-numbers');
        break;
      case 'getPhoneNumber':
        if (!params.phoneNumber) throw new Error('phoneNumber is required');
        result = await retellRequest(retellApiKey, 'GET', `/get-phone-number/${encodeURIComponent(params.phoneNumber)}`);
        break;
      case 'importPhoneNumber':
        result = await retellRequest(retellApiKey, 'POST', '/import-phone-number', undefined, {
          phone_number: params.phoneNumber,
          ...(params.agentId && { agent_id: params.agentId }),
          ...(params.terminationUri && { termination_uri: params.terminationUri }),
        });
        break;
      case 'updatePhoneNumber':
        if (!params.phoneNumber) throw new Error('phoneNumber is required');
        result = await retellRequest(retellApiKey, 'PATCH', `/update-phone-number/${encodeURIComponent(params.phoneNumber)}`, undefined, params.config);
        break;

      // Knowledge Base
      case 'listKnowledgeBases':
        result = await retellRequest(retellApiKey, 'GET', '/list-knowledge-bases');
        break;
      case 'getKnowledgeBase':
        if (!params.knowledgeBaseId) throw new Error('knowledgeBaseId is required');
        result = await retellRequest(retellApiKey, 'GET', `/get-knowledge-base/${params.knowledgeBaseId}`);
        break;
      case 'createKnowledgeBase':
        const kbPayload: any = {
          knowledge_base_name: params.name || 'New Knowledge Base',
        };
        if (params.texts && params.texts.length > 0) {
          kbPayload.knowledge_base_texts = params.texts.map((t: any) => ({
            text: t.content || t.text,
            title: t.title || t.name || 'Document',
          }));
        }
        if (params.urls && params.urls.length > 0) {
          kbPayload.knowledge_base_urls = params.urls;
        }
        result = await retellRequest(retellApiKey, 'POST', '/create-knowledge-base', undefined, kbPayload);
        break;
      case 'addKnowledgeBaseDocument':
        if (!params.knowledgeBaseId) throw new Error('knowledgeBaseId is required');
        const addDocPayload: any = {};
        if (params.text) {
          addDocPayload.knowledge_base_texts = [{
            text: params.text,
            title: params.title || 'Document',
          }];
        }
        if (params.url) {
          addDocPayload.knowledge_base_urls = [params.url];
        }
        result = await retellRequest(retellApiKey, 'PATCH', `/update-knowledge-base/${params.knowledgeBaseId}`, undefined, addDocPayload);
        break;
      case 'deleteKnowledgeBase':
        if (!params.knowledgeBaseId) throw new Error('knowledgeBaseId is required');
        result = await retellRequest(retellApiKey, 'DELETE', `/delete-knowledge-base/${params.knowledgeBaseId}`);
        break;

      case 'updateKnowledgeBase': {
        if (!params.knowledgeBaseId) throw new Error('knowledgeBaseId is required');
        const updateKbPayload: any = {};
        if (params.knowledge_base_name) updateKbPayload.knowledge_base_name = params.knowledge_base_name;
        if (params.knowledge_base_texts) updateKbPayload.knowledge_base_texts = params.knowledge_base_texts;
        if (params.knowledge_base_urls) updateKbPayload.knowledge_base_urls = params.knowledge_base_urls;
        result = await retellRequest(retellApiKey, 'PATCH', `/update-knowledge-base/${params.knowledgeBaseId}`, undefined, updateKbPayload);
        break;
      }

      // LLMs
      case 'listLlms':
        result = await retellRequest(retellApiKey, 'GET', '/list-retell-llms');
        break;
      case 'getLlm':
        if (!params.llmId) throw new Error('llmId is required');
        result = await retellRequest(retellApiKey, 'GET', `/get-retell-llm/${params.llmId}`);
        break;
      case 'createLlm':
        result = await retellRequest(retellApiKey, 'POST', '/create-retell-llm', undefined, params.config);
        break;
      case 'updateLlm':
        if (!params.llmId) throw new Error('llmId is required');
        result = await retellRequest(retellApiKey, 'PATCH', `/update-retell-llm/${params.llmId}`, undefined, params.config);
        break;

      // Voices
      case 'listVoices':
        result = await retellRequest(retellApiKey, 'GET', '/list-voices');
        break;
      case 'getVoice':
        if (!params.voiceId) throw new Error('voiceId is required');
        result = await retellRequest(retellApiKey, 'GET', `/get-voice/${params.voiceId}`);
        break;

      // Analytics (computed from calls)
      case 'getAnalytics': {
        const timeframe = params.timeframe || '7d';
        const startDate = getStartDate(timeframe);

        const callsResult = await retellRequest(retellApiKey, 'POST', '/v2/list-calls', undefined, {
          filter_criteria: {
            ...(agentId && { agent_id: [agentId] }),
          },
          limit: 1000,
        });

        const callsArray = Array.isArray(callsResult)
          ? callsResult
          : Array.isArray((callsResult as any)?.calls)
            ? (callsResult as any).calls
            : Array.isArray((callsResult as any)?.call_details)
              ? (callsResult as any).call_details
              : [];

        // Filter by date client-side
        const filteredCalls = callsArray.filter((call: any) => {
          const callDate = new Date(call.start_timestamp || call.created_at);
          return callDate >= startDate;
        });

        result = computeAnalytics(filteredCalls);
        break;
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Retell] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function retellRequest(
  apiKey: string, 
  method: string, 
  endpoint: string, 
  queryParams?: Record<string, any>,
  body?: any
) {
  let url = `${RETELL_BASE_URL}${endpoint}`;
  
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    url += `?${params.toString()}`;
  }

  console.log(`[Retell] ${method} ${url}`);

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
    console.error(`[Retell] API Error: ${response.status} - ${errorText}`);
    throw new Error(`Retell API error (${response.status}): ${errorText}`);
  }

  // Handle empty responses
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
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      break;
    case '90d':
      now.setDate(now.getDate() - 90);
      break;
    case 'all':
      // Return a very old date to include all calls
      return new Date(0);
    default:
      // Default to all time if unrecognized
      return new Date(0);
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
    // Count by status
    const status = call.call_status || call.status || 'unknown';
    callsByStatus[status] = (callsByStatus[status] || 0) + 1;

    // Sum duration (in milliseconds, convert to seconds)
    if (call.end_timestamp && call.start_timestamp) {
      const duration = (call.end_timestamp - call.start_timestamp) / 1000;
      totalDuration += duration;
    }

    // Count completed
    if (status === 'ended' || status === 'completed') {
      completedCalls++;
    }

    // Group by day
    const timestamp = call.start_timestamp || call.created_at;
    if (timestamp) {
      const day = new Date(timestamp).toISOString().split('T')[0];
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
