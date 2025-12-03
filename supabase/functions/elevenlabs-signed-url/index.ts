import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for reading agent data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch agent with API key
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('platform_agent_id, platform_api_key, platform')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('Agent fetch error:', agentError);
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (agent.platform !== 'elevenlabs') {
      return new Response(
        JSON.stringify({ error: 'Agent is not an ElevenLabs agent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agent.platform_api_key || !agent.platform_agent_id) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key or Agent ID not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request signed URL from ElevenLabs
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agent.platform_agent_id}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': agent.platform_api_key,
        },
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('ElevenLabs API error:', elevenLabsResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get signed URL from ElevenLabs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { signed_url } = await elevenLabsResponse.json();

    console.log('Successfully generated signed URL for agent:', agentId);

    return new Response(
      JSON.stringify({ signedUrl: signed_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in elevenlabs-signed-url:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
