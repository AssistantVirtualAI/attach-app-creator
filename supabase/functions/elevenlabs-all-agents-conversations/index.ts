import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationFilters {
  agentId?: string;
  sentiment?: string;
  dateFrom?: string;
  dateTo?: string;
  minDuration?: number;
  maxDuration?: number;
  search?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      page = 1, 
      limit = 50, 
      filters = {} as ConversationFilters,
      action = 'list',
      conversationId,
      agentId: specificAgentId,
      format = 'mp3'
    } = await req.json();

    const authHeaderRaw = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeaderRaw) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const match = authHeaderRaw.match(/Bearer\s+(.+)/i);
    const token = match?.[1]?.trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing backend env vars', {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
      });
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Prefer header-based auth, fallback to explicit token for older clients
    let user: any = null;
    let userError: any = null;

    const res1 = await supabase.auth.getUser();
    user = res1.data?.user;
    userError = res1.error;

    if (userError || !user) {
      const res2 = await supabase.auth.getUser(token);
      user = res2.data?.user;
      userError = userError ?? res2.error;
    }

    if (userError || !user) {
      console.error('Unauthorized: failed to resolve user from JWT', {
        error: userError?.message ?? String(userError),
      });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: 'No organization found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all ElevenLabs agents for the organization
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, platform_agent_id, platform_api_key, platform, config')
      .eq('organization_id', orgMember.organization_id)
      .eq('platform', 'elevenlabs');

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      throw new Error('Error fetching agents');
    }

    // Get all ElevenLabs integrations (by org_id OR user_id)
    const { data: integrations } = await supabase
      .from('organization_integrations')
      .select('id, agent_id, api_key, additional_config')
      .eq('platform', 'elevenlabs')
      .eq('is_active', true)
      .or(`organization_id.eq.${orgMember.organization_id},user_id.eq.${user.id}`);

    // Build a map of integration_id -> api_key
    const integrationApiKeys: Record<string, string> = {};
    if (integrations) {
      for (const integration of integrations) {
        if (integration.api_key) {
          integrationApiKeys[integration.id] = integration.api_key;
        }
      }
    }

    // If no agents found, try organization_integrations as fallback
    let agentConfigs: Array<{ id: string; name: string; agentId: string; apiKey: string }> = [];

    if (agents && agents.length > 0) {
      // Use agents from the agents table
      for (const agent of agents) {
        // Get agent ID from platform_agent_id OR config.agent_id
        const agentId = agent.platform_agent_id || (agent.config as any)?.agent_id;
        
        if (!agentId) {
          console.log(`Agent ${agent.name} has no agent_id configured`);
          continue;
        }

        // Get API key from platform_api_key OR via integration_id in config
        let apiKey = agent.platform_api_key;
        
        if (!apiKey && (agent.config as any)?.integration_id) {
          apiKey = integrationApiKeys[(agent.config as any).integration_id];
          console.log(`Using API key from integration ${(agent.config as any).integration_id} for agent ${agent.name}`);
        }

        if (apiKey) {
          agentConfigs.push({
            id: agent.id,
            name: agent.name,
            agentId: agentId,
            apiKey: apiKey
          });
          console.log(`Added agent config for ${agent.name} with agentId ${agentId}`);
        } else {
          console.log(`Agent ${agent.name} has no API key available`);
        }
      }
    }

    // Also add agents from integrations that have agent_id directly

    if (integrations) {
      for (const integration of integrations) {
        if (integration.agent_id && integration.api_key) {
          // Check if this agent is already in our list
          const exists = agentConfigs.some(a => a.agentId === integration.agent_id);
          if (!exists) {
            agentConfigs.push({
              id: integration.id,
              name: `Integration Agent`,
              agentId: integration.agent_id,
              apiKey: integration.api_key
            });
          }
        }
      }
    }

    if (agentConfigs.length === 0) {
      return new Response(
        JSON.stringify({ 
          requiresSetup: true, 
          message: 'Aucun agent ElevenLabs configuré. Veuillez créer un agent avec vos credentials ElevenLabs.',
          conversations: [],
          agents: [],
          total: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'details' && conversationId) {
      // Find the right agent for this conversation
      for (const config of agentConfigs) {
        try {
          const detailsResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
            {
              headers: {
                'xi-api-key': config.apiKey,
                'accept': 'application/json',
              },
            }
          );

          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json();
            return new Response(
              JSON.stringify({ ...detailsData, agent_name: config.name }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          console.log(`Conversation ${conversationId} not found for agent ${config.name}`);
        }
      }
      
       return new Response(
         JSON.stringify({ notFound: true, error: 'Conversation not found' }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    if (action === 'audio' && conversationId) {
      // Find the right agent for this conversation
      for (const config of agentConfigs) {
        // Try multiple endpoints for audio retrieval
        const audioEndpoints = [
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio?format=${format}`,
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
        ];

        for (const audioUrl of audioEndpoints) {
          try {
            console.log(`Trying audio endpoint: ${audioUrl} for agent ${config.name}`);
            
            const audioResponse = await fetch(audioUrl, {
              headers: {
                'xi-api-key': config.apiKey,
                'accept': 'audio/mpeg',
              },
            });

            console.log(`Audio response status: ${audioResponse.status}`);

            if (audioResponse.ok) {
              const audioBuffer = await audioResponse.arrayBuffer();
              const base64Audio = base64Encode(audioBuffer);

              console.log(`Audio fetched successfully for ${conversationId}, size: ${audioBuffer.byteLength} bytes`);

              return new Response(
                JSON.stringify({
                  audio_base64: base64Audio,
                  audio_url: `data:audio/mpeg;base64,${base64Audio}`,
                  format,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              const errorText = await audioResponse.text().catch(() => '');
              console.log(`Audio fetch failed for ${conversationId} (${audioUrl}): ${audioResponse.status} - ${errorText.substring(0, 200)}`);
              
              // If 401/403 auth error, return specific error
              if (audioResponse.status === 401 || audioResponse.status === 403) {
                return new Response(
                  JSON.stringify({ 
                    audio_base64: null,
                    audio_url: null,
                    format,
                    notFound: false,
                    error_code: 'AUDIO_AUTH_ERROR',
                    error: 'Authentication error when fetching audio'
                  }),
                  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          } catch (e) {
            console.log(`Audio fetch error for ${conversationId} (${audioUrl}):`, e);
          }
        }
      }
      
      return new Response(
        JSON.stringify({ 
          audio_base64: null,
          audio_url: null,
          format,
          notFound: true,
          error_code: 'AUDIO_NOT_FOUND',
          error: 'Audio not found'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List conversations from all agents
    console.log(`Fetching conversations from ${agentConfigs.length} agents`);
    
    const allConversations: any[] = [];
    const agentsList: Array<{ id: string; name: string; agentId: string; conversationCount: number }> = [];

    // Filter by specific agent if requested
    const configsToProcess = filters.agentId 
      ? agentConfigs.filter(c => c.id === filters.agentId || c.agentId === filters.agentId)
      : agentConfigs;

    for (const config of configsToProcess) {
      try {
        console.log(`Fetching conversations for agent ${config.name} (${config.agentId})`);
        
        const conversationsResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${config.agentId}&cursor=&limit=100`,
          {
            headers: {
              'xi-api-key': config.apiKey,
              'accept': 'application/json',
            },
          }
        );

        if (conversationsResponse.ok) {
          const conversationsData = await conversationsResponse.json();
          const conversations = conversationsData.conversations || [];
          
          // Add agent info to each conversation
          const enrichedConversations = conversations.map((conv: any) => ({
            ...conv,
            agent_id: config.id,
            agent_name: config.name,
            platform_agent_id: config.agentId,
          }));

          allConversations.push(...enrichedConversations);
          agentsList.push({
            id: config.id,
            name: config.name,
            agentId: config.agentId,
            conversationCount: conversations.length
          });
        } else {
          const errorText = await conversationsResponse.text().catch(() => '');
          console.error(`Error fetching for agent ${config.name}:`, conversationsResponse.status, errorText);
          // Still show the agent in the UI
          agentsList.push({
            id: config.id,
            name: config.name,
            agentId: config.agentId,
            conversationCount: 0
          });
        }
      } catch (error) {
        console.error(`Error fetching conversations for agent ${config.name}:`, error);
      }
    }

    // Apply filters
    let filteredConversations = allConversations;

    // Date filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom).getTime();
      filteredConversations = filteredConversations.filter(c => {
        const convDate = new Date(c.start_time || c.created_at || c.timestamp).getTime();
        return convDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo).getTime();
      filteredConversations = filteredConversations.filter(c => {
        const convDate = new Date(c.start_time || c.created_at || c.timestamp).getTime();
        return convDate <= toDate;
      });
    }

    // Duration filter
    if (filters.minDuration) {
      filteredConversations = filteredConversations.filter(c => 
        (c.duration || c.call_duration_secs || 0) >= filters.minDuration!
      );
    }

    if (filters.maxDuration) {
      filteredConversations = filteredConversations.filter(c => 
        (c.duration || c.call_duration_secs || 0) <= filters.maxDuration!
      );
    }

    // Search filter (in transcript or summary)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredConversations = filteredConversations.filter(c => {
        const transcript = (c.transcript || '').toLowerCase();
        const summary = (c.analysis?.summary || '').toLowerCase();
        const title = (c.title || '').toLowerCase();
        return transcript.includes(searchLower) || summary.includes(searchLower) || title.includes(searchLower);
      });
    }

    // Sort by date descending
    filteredConversations.sort((a, b) => {
      const dateA = new Date(a.start_time || a.created_at || a.timestamp).getTime();
      const dateB = new Date(b.start_time || b.created_at || b.timestamp).getTime();
      return dateB - dateA;
    });

    // Pagination
    const total = filteredConversations.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedConversations = filteredConversations.slice(startIndex, startIndex + limit);

    return new Response(
      JSON.stringify({
        conversations: paginatedConversations,
        agents: agentsList,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('All agents conversations error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        conversations: [],
        agents: [],
        total: 0
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
