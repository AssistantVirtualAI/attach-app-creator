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
    const { action, agentId, conversationId, page = 1, limit = 50, filters, format = 'mp3' } = await req.json();
    
    const authHeader = req.headers.get('Authorization')!;
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

    const { data: integration, error: integrationError } = await supabase
      .from('organization_integrations')
      .select('api_key, agent_id')
      .eq('user_id', user.id)
      .eq('platform', 'elevenlabs')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ 
          requiresSetup: true, 
          message: 'Configuration ElevenLabs requise' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = integration.api_key;
    const targetAgentId = agentId || integration.agent_id;

    switch (action) {
      case 'list': {
        console.log(`Fetching conversations for agent ${targetAgentId}, page ${page}, limit ${limit}`);
        
        const conversationsResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}/conversations?page=${page}&limit=${limit}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'xi-api-key': apiKey,
            },
          }
        );

        if (!conversationsResponse.ok) {
          const errorText = await conversationsResponse.text();
          console.error('ElevenLabs API error:', conversationsResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${conversationsResponse.status}`);
        }

        const conversationsData = await conversationsResponse.json();
        
        return new Response(
          JSON.stringify({
            conversations: conversationsData.conversations || [],
            pagination: conversationsData.pagination || {
              page: page,
              limit: limit,
              total: 0,
              has_more: false,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'details': {
        console.log(`Fetching details for conversation ${conversationId}`);
        
        const detailsResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'xi-api-key': apiKey,
            },
          }
        );

        if (!detailsResponse.ok) {
          const errorText = await detailsResponse.text();
          console.error('ElevenLabs API error:', detailsResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${detailsResponse.status}`);
        }

        const detailsData = await detailsResponse.json();
        
        return new Response(
          JSON.stringify(detailsData),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'audio': {
        console.log(`Fetching audio for conversation ${conversationId}, format: ${format}`);
        
        const audioResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio?format=${format}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'xi-api-key': apiKey,
            },
          }
        );

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          console.error('ElevenLabs API error:', audioResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${audioResponse.status}`);
        }

        const audioBlob = await audioResponse.blob();
        
        return new Response(audioBlob, {
          headers: {
            ...corsHeaders,
            'Content-Type': `audio/${format}`,
          },
        });
      }

      default:
        throw new Error('Action non supportée');
    }

  } catch (error) {
    console.error('Conversations error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        requiresSetup: true,
        message: 'Erreur lors de la récupération des conversations' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});