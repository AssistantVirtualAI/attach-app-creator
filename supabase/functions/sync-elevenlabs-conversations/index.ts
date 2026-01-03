import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action = 'sync', agentId, limit = 100 } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // User client for auth
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // Service client for writes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

    // Get agents to sync
    let agentsQuery = supabase
      .from('agents')
      .select('id, name, platform_agent_id, platform_api_key')
      .eq('organization_id', orgMember.organization_id)
      .eq('platform', 'elevenlabs');
    
    if (agentId) {
      agentsQuery = agentsQuery.eq('id', agentId);
    }

    const { data: agents, error: agentsError } = await agentsQuery;

    if (agentsError || !agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No ElevenLabs agents found',
          synced: 0,
          created: 0,
          updated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const syncErrors: string[] = [];

    for (const agent of agents) {
      if (!agent.platform_agent_id || !agent.platform_api_key) {
        console.log(`Skipping agent ${agent.name} - missing credentials`);
        continue;
      }

      try {
        console.log(`Syncing conversations for agent ${agent.name}`);
        
        // Fetch conversations from ElevenLabs
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${agent.platform_agent_id}/conversations?limit=${limit}`,
          {
            headers: {
              'xi-api-key': agent.platform_api_key,
            },
          }
        );

        if (!response.ok) {
          console.error(`Error fetching conversations for ${agent.name}: ${response.status}`);
          syncErrors.push(`Agent ${agent.name}: API error ${response.status}`);
          continue;
        }

        const data = await response.json();
        const conversations = data.conversations || [];

        console.log(`Found ${conversations.length} conversations for ${agent.name}`);

        for (const conv of conversations) {
          // Check if conversation already exists
          const { data: existing } = await supabaseAdmin
            .from('conversations')
            .select('id, external_id')
            .eq('external_id', conv.conversation_id)
            .single();

          const conversationData = {
            external_id: conv.conversation_id,
            title: `Conversation ${conv.conversation_id.substring(0, 8)}`,
            agent_id: agent.id,
            organization_id: orgMember.organization_id,
            user_id: user.id,
            platform: 'elevenlabs',
            status: conv.status || 'completed',
            duration: conv.call_duration_secs || conv.duration || 0,
            created_at: conv.start_time || conv.created_at || new Date().toISOString(),
            transcript: conv.transcript ? JSON.stringify(conv.transcript) : null,
            sentiment: conv.analysis?.sentiment || null,
            satisfaction_score: conv.analysis?.satisfaction_score || null,
            keywords: conv.analysis?.keywords || [],
            metadata: {
              start_time: conv.start_time,
              end_time: conv.end_time,
              caller_id: conv.caller_id,
              summary: conv.analysis?.summary,
              platform_agent_id: agent.platform_agent_id,
              call_duration_secs: conv.call_duration_secs,
            }
          };

          if (existing) {
            // Update existing conversation
            const { error: updateError } = await supabaseAdmin
              .from('conversations')
              .update(conversationData)
              .eq('id', existing.id);

            if (updateError) {
              console.error(`Error updating conversation ${conv.conversation_id}:`, updateError);
            } else {
              totalUpdated++;
            }
          } else {
            // Insert new conversation
            const { error: insertError } = await supabaseAdmin
              .from('conversations')
              .insert(conversationData);

            if (insertError) {
              console.error(`Error inserting conversation ${conv.conversation_id}:`, insertError);
            } else {
              totalCreated++;
            }
          }

          totalSynced++;
        }
      } catch (error) {
        console.error(`Error syncing agent ${agent.name}:`, error);
        syncErrors.push(`Agent ${agent.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        created: totalCreated,
        updated: totalUpdated,
        errors: syncErrors,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        synced: 0,
        created: 0,
        updated: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
