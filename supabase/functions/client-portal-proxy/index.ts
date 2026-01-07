import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ProxyRequest {
  clientId: string;
  agentId: string;
  platform: string;
  action: string;
  params?: Record<string, unknown>;
}

// Helper function to make requests to external platform APIs
async function proxyToPlatform(
  platform: string,
  apiKey: string,
  action: string,
  params: Record<string, unknown>
): Promise<Response> {
  switch (platform) {
    case "elevenlabs":
      return proxyToElevenLabs(apiKey, action, params);
    case "retell":
      return proxyToRetell(apiKey, action, params);
    case "vapi":
      return proxyToVapi(apiKey, action, params);
    default:
      return new Response(
        JSON.stringify({ error: `Unsupported platform: ${platform}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}

async function proxyToElevenLabs(
  apiKey: string,
  action: string,
  params: Record<string, unknown>
): Promise<Response> {
  const baseUrl = "https://api.elevenlabs.io";
  const headers = {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
  };

  let url: string;
  let method: string;
  let body: string | undefined;

  switch (action) {
    case "getConversations":
      url = `${baseUrl}/v1/convai/conversations?agent_id=${params.agentId}`;
      method = "GET";
      break;
    case "getConversation":
      url = `${baseUrl}/v1/convai/conversations/${params.conversationId}`;
      method = "GET";
      break;
    case "getAnalytics":
      url = `${baseUrl}/v1/convai/conversations/analytics`;
      method = "POST";
      body = JSON.stringify({ agent_ids: [params.agentId] });
      break;
    case "getAgent":
      url = `${baseUrl}/v1/convai/agents/${params.agentId}`;
      method = "GET";
      break;
    case "getKnowledgeBase":
      url = `${baseUrl}/v1/convai/agents/${params.agentId}/knowledge-base`;
      method = "GET";
      break;
    default:
      return new Response(
        JSON.stringify({ error: `Unsupported ElevenLabs action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const data = await response.json();
  return new Response(
    JSON.stringify({ success: true, data }),
    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function proxyToRetell(
  apiKey: string,
  action: string,
  params: Record<string, unknown>
): Promise<Response> {
  const baseUrl = "https://api.retellai.com";
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  let url: string;
  let method: string;
  let body: string | undefined;

  switch (action) {
    case "listCalls":
      // Build filter criteria
      const filterCriteria: Record<string, unknown>[] = [];
      if (params.agentId) {
        filterCriteria.push({ agent_id: [params.agentId] });
      }
      
      url = `${baseUrl}/v2/list-calls`;
      method = "POST";
      body = JSON.stringify({
        filter_criteria: filterCriteria,
        limit: params.limit || 50,
        sort_order: "descending",
      });
      break;
    case "getCall":
      url = `${baseUrl}/v2/get-call/${params.callId}`;
      method = "GET";
      break;
    case "getAgent":
      url = `${baseUrl}/v2/get-agent/${params.agentId}`;
      method = "GET";
      break;
    default:
      return new Response(
        JSON.stringify({ error: `Unsupported Retell action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const data = await response.json();
  return new Response(
    JSON.stringify({ success: true, data }),
    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function proxyToVapi(
  apiKey: string,
  action: string,
  params: Record<string, unknown>
): Promise<Response> {
  const baseUrl = "https://api.vapi.ai";
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  let url: string;
  let method: string;

  switch (action) {
    case "listCalls":
      url = `${baseUrl}/call?assistantId=${params.agentId}&limit=${params.limit || 50}`;
      method = "GET";
      break;
    case "getCall":
      url = `${baseUrl}/call/${params.callId}`;
      method = "GET";
      break;
    case "getAssistant":
      url = `${baseUrl}/assistant/${params.agentId}`;
      method = "GET";
      break;
    default:
      return new Response(
        JSON.stringify({ error: `Unsupported Vapi action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }

  const response = await fetch(url, {
    method,
    headers,
  });

  const data = await response.json();
  return new Response(
    JSON.stringify({ success: true, data }),
    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { clientId, agentId, platform, action, params = {} }: ProxyRequest = await req.json();

    console.log(`[client-portal-proxy] clientId=${clientId}, agentId=${agentId}, platform=${platform}, action=${action}`);

    // Validate required fields
    if (!clientId || !agentId || !platform || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: clientId, agentId, platform, action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify client has access to this agent
    // Allow special clientIds for super admins and org admins
    if (clientId !== "super-admin" && clientId !== "admin") {
      const { data: assignment, error: assignmentError } = await supabase
        .from("client_agent_assignments")
        .select("id")
        .eq("client_id", clientId)
        .eq("agent_id", agentId)
        .maybeSingle();

      if (assignmentError) {
        console.error("[client-portal-proxy] Assignment lookup error:", assignmentError);
        return new Response(
          JSON.stringify({ error: "Error verifying access" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!assignment) {
        console.warn(`[client-portal-proxy] Client ${clientId} does not have access to agent ${agentId}`);
        return new Response(
          JSON.stringify({ error: "Access denied to this agent" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch agent to get organization_id
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("organization_id, platform, platform_agent_id")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      console.error("[client-portal-proxy] Agent lookup error:", agentError);
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch API key server-side
    const { data: integration, error: integrationError } = await supabase
      .from("organization_integrations")
      .select("api_key")
      .eq("organization_id", agent.organization_id)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    if (integrationError) {
      console.error("[client-portal-proxy] Integration lookup error:", integrationError);
      return new Response(
        JSON.stringify({ error: "Error fetching API credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!integration?.api_key) {
      console.warn(`[client-portal-proxy] No active ${platform} integration found for org ${agent.organization_id}`);
      return new Response(
        JSON.stringify({ error: `No active ${platform} integration found` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add platformAgentId to params if not already set
    const enrichedParams = {
      ...params,
      agentId: agent.platform_agent_id || params.agentId,
    };

    // Proxy the request
    return proxyToPlatform(platform, integration.api_key, action, enrichedParams);
  } catch (error) {
    console.error("[client-portal-proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
