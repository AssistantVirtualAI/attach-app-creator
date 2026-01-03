import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade',
};

interface ActiveConversation {
  conversation_id: string;
  agent_id: string;
  agent_name: string;
  platform_agent_id: string;
  start_time: string;
  status: 'active' | 'ended';
  caller_id?: string;
  duration_secs?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  const upgradeHeader = req.headers.get('upgrade') || '';
  
  if (upgradeHeader.toLowerCase() === 'websocket') {
    // WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let organizationId: string | null = null;
    let pollingInterval: number | null = null;
    let agentConfigs: Array<{ id: string; name: string; agentId: string; apiKey: string }> = [];
    
    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };
    
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'auth') {
          // Authenticate user
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: `Bearer ${message.token}` } } }
          );
          
          const { data: { user }, error: userError } = await supabase.auth.getUser(message.token);
          
          if (userError || !user) {
            socket.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
            socket.close();
            return;
          }
          
          // Get user's organization
          const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single();
          
          if (!orgMember) {
            socket.send(JSON.stringify({ type: 'error', message: 'No organization found' }));
            socket.close();
            return;
          }
          
          organizationId = orgMember.organization_id;
          
          // Get all ElevenLabs agents
          const { data: agents } = await supabase
            .from('agents')
            .select('id, name, platform_agent_id, platform_api_key')
            .eq('organization_id', organizationId)
            .eq('platform', 'elevenlabs');
          
          if (agents) {
            for (const agent of agents) {
              if (agent.platform_agent_id && agent.platform_api_key) {
                agentConfigs.push({
                  id: agent.id,
                  name: agent.name,
                  agentId: agent.platform_agent_id,
                  apiKey: agent.platform_api_key
                });
              }
            }
          }
          
          socket.send(JSON.stringify({ 
            type: 'authenticated', 
            organizationId,
            agentCount: agentConfigs.length 
          }));
          
          // Start polling for active conversations
          const pollActiveConversations = async () => {
            if (agentConfigs.length === 0) return;
            
            const activeConversations: ActiveConversation[] = [];
            const recentConversations: any[] = [];
            
            for (const config of agentConfigs) {
              try {
                // Fetch recent conversations (last 5 minutes)
                const response = await fetch(
                  `https://api.elevenlabs.io/v1/convai/agents/${config.agentId}/conversations?limit=20`,
                  {
                    headers: {
                      'xi-api-key': config.apiKey,
                    },
                  }
                );
                
                if (response.ok) {
                  const data = await response.json();
                  const conversations = data.conversations || [];
                  
                  for (const conv of conversations) {
                    const startTime = new Date(conv.start_time || conv.created_at).getTime();
                    const now = Date.now();
                    const duration = conv.call_duration_secs || conv.duration || 0;
                    
                    // Consider active if started within last 5 minutes and no end_time or very recent
                    const isActive = conv.status === 'in_progress' || 
                      (now - startTime < 5 * 60 * 1000 && !conv.end_time);
                    
                    if (isActive) {
                      activeConversations.push({
                        conversation_id: conv.conversation_id,
                        agent_id: config.id,
                        agent_name: config.name,
                        platform_agent_id: config.agentId,
                        start_time: conv.start_time || conv.created_at,
                        status: 'active',
                        caller_id: conv.caller_id || conv.metadata?.caller_id,
                        duration_secs: Math.floor((now - startTime) / 1000)
                      });
                    }
                    
                    // Recent conversations (last 30 minutes)
                    if (now - startTime < 30 * 60 * 1000) {
                      recentConversations.push({
                        ...conv,
                        agent_id: config.id,
                        agent_name: config.name,
                        platform_agent_id: config.agentId,
                      });
                    }
                  }
                }
              } catch (error) {
                console.error(`Error polling agent ${config.name}:`, error);
              }
            }
            
            // Sort recent by start time
            recentConversations.sort((a, b) => {
              const dateA = new Date(a.start_time || a.created_at).getTime();
              const dateB = new Date(b.start_time || b.created_at).getTime();
              return dateB - dateA;
            });
            
            // Send update
            socket.send(JSON.stringify({
              type: 'update',
              activeConversations,
              recentConversations: recentConversations.slice(0, 20),
              timestamp: new Date().toISOString()
            }));
          };
          
          // Initial poll
          await pollActiveConversations();
          
          // Poll every 5 seconds
          pollingInterval = setInterval(pollActiveConversations, 5000);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return response;
  }
  
  // Regular HTTP request - return active conversations
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
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

    // Get all ElevenLabs agents
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, platform_agent_id, platform_api_key')
      .eq('organization_id', orgMember.organization_id)
      .eq('platform', 'elevenlabs');

    const agentConfigs: Array<{ id: string; name: string; agentId: string; apiKey: string }> = [];
    
    if (agents) {
      for (const agent of agents) {
        if (agent.platform_agent_id && agent.platform_api_key) {
          agentConfigs.push({
            id: agent.id,
            name: agent.name,
            agentId: agent.platform_agent_id,
            apiKey: agent.platform_api_key
          });
        }
      }
    }

    const activeConversations: ActiveConversation[] = [];
    const recentConversations: any[] = [];

    for (const config of agentConfigs) {
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${config.agentId}/conversations?limit=20`,
          {
            headers: {
              'xi-api-key': config.apiKey,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const conversations = data.conversations || [];

          for (const conv of conversations) {
            const startTime = new Date(conv.start_time || conv.created_at).getTime();
            const now = Date.now();

            const isActive = conv.status === 'in_progress' || 
              (now - startTime < 5 * 60 * 1000 && !conv.end_time);

            if (isActive) {
              activeConversations.push({
                conversation_id: conv.conversation_id,
                agent_id: config.id,
                agent_name: config.name,
                platform_agent_id: config.agentId,
                start_time: conv.start_time || conv.created_at,
                status: 'active',
                caller_id: conv.caller_id || conv.metadata?.caller_id,
                duration_secs: Math.floor((now - startTime) / 1000)
              });
            }

            if (now - startTime < 30 * 60 * 1000) {
              recentConversations.push({
                ...conv,
                agent_id: config.id,
                agent_name: config.name,
                platform_agent_id: config.agentId,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching for agent ${config.name}:`, error);
      }
    }

    recentConversations.sort((a, b) => {
      const dateA = new Date(a.start_time || a.created_at).getTime();
      const dateB = new Date(b.start_time || b.created_at).getTime();
      return dateB - dateA;
    });

    return new Response(
      JSON.stringify({
        activeConversations,
        recentConversations: recentConversations.slice(0, 20),
        agentCount: agentConfigs.length,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Realtime conversations error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
