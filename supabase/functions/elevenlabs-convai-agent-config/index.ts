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
    const { action, agentId, prompt, voiceSettings, conversationConfig } = await req.json();
    
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
      case 'get': {
        console.log(`Fetching config for agent ${targetAgentId}`);
        
        const configResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'xi-api-key': apiKey,
            },
          }
        );

        if (!configResponse.ok) {
          const errorText = await configResponse.text();
          console.error('ElevenLabs API error:', configResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${configResponse.status}`);
        }

        const configData = await configResponse.json();
        
        return new Response(
          JSON.stringify({ agent: configData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_prompt': {
        console.log(`Updating prompt for agent ${targetAgentId}`);
        
        const promptResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}/prompt`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
          }
        );

        if (!promptResponse.ok) {
          const errorText = await promptResponse.text();
          console.error('ElevenLabs API error:', promptResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${promptResponse.status}`);
        }

        const promptData = await promptResponse.json();
        
        return new Response(
          JSON.stringify({ success: true, data: promptData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_voice': {
        console.log(`Updating voice settings for agent ${targetAgentId}`);
        
        const voiceResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}/voice`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(voiceSettings),
          }
        );

        if (!voiceResponse.ok) {
          const errorText = await voiceResponse.text();
          console.error('ElevenLabs API error:', voiceResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${voiceResponse.status}`);
        }

        const voiceData = await voiceResponse.json();
        
        return new Response(
          JSON.stringify({ success: true, data: voiceData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Action non supportée');
    }

  } catch (error) {
    console.error('Agent config error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        requiresSetup: true,
        message: 'Erreur lors de la configuration de l\'agent' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});