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
    const { action, agentId, content, category, title, items } = await req.json();
    
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
        console.log(`Fetching knowledge base for agent ${targetAgentId}`);
        
        const kbResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}/knowledge-base`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'xi-api-key': apiKey,
            },
          }
        );

        if (!kbResponse.ok) {
          const errorText = await kbResponse.text();
          console.error('ElevenLabs API error:', kbResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${kbResponse.status}`);
        }

        const kbData = await kbResponse.json();
        
        return new Response(
          JSON.stringify({
            knowledge_base: {
              items: kbData.items || [],
              categories: kbData.categories || [],
              total_items: kbData.total_items || 0,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        console.log(`Updating knowledge base for agent ${targetAgentId}`);
        
        const updateResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}/knowledge-base`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title,
              content,
              category,
            }),
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('ElevenLabs API error:', updateResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${updateResponse.status}`);
        }

        const updateData = await updateResponse.json();
        
        return new Response(
          JSON.stringify({ success: true, data: updateData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync': {
        console.log(`Syncing ${items?.length || 0} items to ElevenLabs`);
        
        if (!items || items.length === 0) {
          return new Response(
            JSON.stringify({ synced: 0, total: 0, errors: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let syncedCount = 0;
        const errors = [];

        for (const item of items) {
          try {
            const response = await fetch(
              `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}/knowledge-base`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'xi-api-key': apiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  title: item.title,
                  content: item.content,
                  metadata: {
                    category: item.category,
                    source: 'dashboard'
                  }
                }),
              }
            );

            if (response.ok) {
              syncedCount++;
              console.log(`Successfully synced item: ${item.title}`);
            } else {
              const errorText = await response.text();
              console.error(`Failed to sync item ${item.id}:`, errorText);
              errors.push({ id: item.id, error: errorText });
            }
          } catch (error) {
            console.error(`Exception syncing item ${item.id}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ id: item.id, error: errorMessage });
          }
        }

        return new Response(
          JSON.stringify({ 
            synced: syncedCount, 
            total: items.length,
            errors 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Action non supportée');
    }

  } catch (error) {
    console.error('Knowledge base error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        requiresSetup: true,
        message: 'Erreur lors de la gestion de la knowledge base' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});