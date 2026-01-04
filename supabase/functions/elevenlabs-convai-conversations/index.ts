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
    const { action, agentId, conversationId, page = 1, limit = 50, filters, format = 'mp3', apiKey: providedApiKey } = await req.json();
    
    let apiKey = providedApiKey;
    let targetAgentId = agentId;
    
    // If no API key provided directly, try to get from user's integration
    if (!apiKey) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'API key or authorization required' }), {
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

      apiKey = integration.api_key;
      targetAgentId = agentId || integration.agent_id;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'list': {
        console.log(`Fetching conversations for agent ${targetAgentId}, page ${page}, limit ${limit}`);

        // ElevenLabs API uses cursor-based pagination.
        // We keep page/limit for backwards compatibility, but only the first page is guaranteed
        // unless the caller provides a cursor.
        const cursor = (filters as any)?.cursor ?? undefined;
        const qs = new URLSearchParams();
        if (targetAgentId) qs.set('agent_id', targetAgentId);
        if (cursor) qs.set('cursor', String(cursor));

        const conversationsResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations?${qs.toString()}`,
          {
            headers: {
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
            total: (conversationsData.conversations || []).length,
            has_more: !!conversationsData.has_more,
            next_cursor: conversationsData.next_cursor ?? null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'details': {
        console.log(`[conversations] Fetching details for conversation ${conversationId}`);
        
        const detailsResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
          {
            headers: {
              'xi-api-key': apiKey,
            },
          }
        );

        if (!detailsResponse.ok) {
          const errorText = await detailsResponse.text();
          console.error('[conversations] ElevenLabs API error:', detailsResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${detailsResponse.status} - ${errorText}`);
        }

        const detailsData = await detailsResponse.json();
        console.log(`[conversations] Got details for ${conversationId}, has transcript: ${!!detailsData.transcript}`);
        
        return new Response(
          JSON.stringify(detailsData),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'audio': {
        console.log(`[conversations] Fetching audio for conversation ${conversationId}, format: ${format}`);
        
        const audioResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio?format=${format}`,
          {
            headers: {
              'xi-api-key': apiKey,
            },
          }
        );

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          console.error('ElevenLabs API error:', audioResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${audioResponse.status}`);
        }

        // Get audio as base64 for easier client handling
        const audioBuffer = await audioResponse.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
        
        return new Response(
          JSON.stringify({ 
            audio_base64: base64Audio,
            audio_url: `data:audio/${format};base64,${base64Audio}`,
            format 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
