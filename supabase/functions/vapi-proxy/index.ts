import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPI_BASE_URL = 'https://api.vapi.ai';

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
      case 'createAssistant':
        result = await vapiRequest(vapiApiKey, 'POST', '/assistant', undefined, params.config);
        break;
      case 'updateAssistant':
        if (!params.assistantId) throw new Error('assistantId is required');
        result = await vapiRequest(vapiApiKey, 'PATCH', `/assistant/${params.assistantId}`, undefined, params.config);
        break;
      case 'deleteAssistant':
        if (!params.assistantId) throw new Error('assistantId is required');
        result = await vapiRequest(vapiApiKey, 'DELETE', `/assistant/${params.assistantId}`);
        break;

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

      // Analytics (computed from calls)
      case 'getAnalytics':
        const timeframe = params.timeframe || '7d';
        const startDate = getStartDate(timeframe);
        
        const callsQuery: any = {
          limit: 1000,
          createdAtGt: startDate.toISOString(),
        };
        
        // Filter by assistant ID if provided
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
    // Count by status
    const status = call.status || 'unknown';
    callsByStatus[status] = (callsByStatus[status] || 0) + 1;

    // Sum duration
    if (call.endedAt && call.startedAt) {
      const duration = (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000;
      totalDuration += duration;
    }

    // Count completed
    if (status === 'ended') {
      completedCalls++;
    }

    // Group by day
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
