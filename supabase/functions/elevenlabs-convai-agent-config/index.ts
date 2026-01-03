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
const { 
      action, 
      agentId, 
      prompt, 
      firstMessage, 
      voiceSettings, 
      llmSettings,
      fullConfig,
      apiKey: providedApiKey, 
      integrationId 
    } = await req.json();
    
    console.log(`[elevenlabs-agent-config] Action: ${action}, AgentId: ${agentId}`);
    
    let apiKey = providedApiKey;
    let targetAgentId = agentId;
    
    // If no API key provided directly, try to get from integration or user
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
        console.error('[elevenlabs-agent-config] Auth error:', userError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Try to get API key from agent's config first if agentId is provided
      if (agentId) {
        const { data: agentData } = await supabase
          .from('agents')
          .select('platform_api_key, config')
          .eq('platform_agent_id', agentId)
          .single();

        if (agentData?.platform_api_key) {
          apiKey = agentData.platform_api_key;
          console.log('[elevenlabs-agent-config] Got API key from agent config');
        } else if (agentData?.config && (agentData.config as any)?.api_key) {
          apiKey = (agentData.config as any).api_key;
          console.log('[elevenlabs-agent-config] Got API key from agent config.api_key');
        }
      }

      // If still no key, try integration
      if (!apiKey && integrationId) {
        const { data: integration } = await supabase
          .from('organization_integrations')
          .select('api_key, agent_id')
          .eq('id', integrationId)
          .eq('is_active', true)
          .single();

        if (integration?.api_key) {
          apiKey = integration.api_key;
          targetAgentId = agentId || integration.agent_id;
          console.log('[elevenlabs-agent-config] Got API key from integration');
        }
      }

      // Fallback: try user's ElevenLabs integration
      if (!apiKey) {
        const { data: integration } = await supabase
          .from('organization_integrations')
          .select('api_key, agent_id')
          .eq('user_id', user.id)
          .eq('platform', 'elevenlabs')
          .eq('is_active', true)
          .single();

        if (integration?.api_key) {
          apiKey = integration.api_key;
          targetAgentId = agentId || integration.agent_id;
          console.log('[elevenlabs-agent-config] Got API key from user integration');
        }
      }
    }

    if (!apiKey) {
      console.log('[elevenlabs-agent-config] No API key found');
      return new Response(
        JSON.stringify({ 
          requiresSetup: true, 
          message: 'Configuration ElevenLabs requise' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetAgentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'get': {
        console.log(`[elevenlabs-agent-config] Fetching config for agent ${targetAgentId}`);
        
        const configResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            headers: {
              'xi-api-key': apiKey,
            },
          }
        );

        if (!configResponse.ok) {
          const errorText = await configResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', configResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${configResponse.status} - ${errorText}`);
        }

        const configData = await configResponse.json();
        console.log('[elevenlabs-agent-config] Successfully fetched agent config');
        
        return new Response(
          JSON.stringify({ agent: configData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_prompt': {
        console.log(`[elevenlabs-agent-config] Updating prompt for agent ${targetAgentId}`);
        
        // Use PATCH to update agent configuration
        const updateBody: any = {
          conversation_config: {
            agent: {
              prompt: {
                prompt: prompt
              }
            }
          }
        };

        // Add first message if provided
        if (firstMessage) {
          updateBody.conversation_config.agent.first_message = firstMessage;
        }
        
        const promptResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateBody),
          }
        );

        if (!promptResponse.ok) {
          const errorText = await promptResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', promptResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${promptResponse.status} - ${errorText}`);
        }

        const promptData = await promptResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated prompt');
        
        return new Response(
          JSON.stringify({ success: true, data: promptData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_voice': {
        console.log(`[elevenlabs-agent-config] Updating voice settings for agent ${targetAgentId}`);
        
        const voiceBody: any = {
          conversation_config: {
            tts: voiceSettings
          }
        };
        
        const voiceResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(voiceBody),
          }
        );

        if (!voiceResponse.ok) {
          const errorText = await voiceResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', voiceResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${voiceResponse.status} - ${errorText}`);
        }

        const voiceData = await voiceResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated voice settings');
        
        return new Response(
          JSON.stringify({ success: true, data: voiceData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_llm': {
        console.log(`[elevenlabs-agent-config] Updating LLM settings for agent ${targetAgentId}`);
        
        if (!llmSettings) {
          return new Response(
            JSON.stringify({ error: 'LLM settings required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const llmBody: any = {
          conversation_config: {
            agent: {
              prompt: {
                llm: llmSettings
              }
            }
          }
        };
        
        const llmResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(llmBody),
          }
        );

        if (!llmResponse.ok) {
          const errorText = await llmResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', llmResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${llmResponse.status} - ${errorText}`);
        }

        const llmData = await llmResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated LLM settings');
        
        return new Response(
          JSON.stringify({ success: true, data: llmData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_first_message': {
        console.log(`[elevenlabs-agent-config] Updating first message for agent ${targetAgentId}`);
        
        if (!firstMessage) {
          return new Response(
            JSON.stringify({ error: 'First message required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const fmBody: any = {
          conversation_config: {
            agent: {
              first_message: firstMessage
            }
          }
        };
        
        const fmResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fmBody),
          }
        );

        if (!fmResponse.ok) {
          const errorText = await fmResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', fmResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${fmResponse.status} - ${errorText}`);
        }

        const fmData = await fmResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated first message');
        
        return new Response(
          JSON.stringify({ success: true, data: fmData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_full': {
        console.log(`[elevenlabs-agent-config] Full update for agent ${targetAgentId}`);
        
        if (!fullConfig) {
          return new Response(
            JSON.stringify({ error: 'Full config required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const fullResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fullConfig),
          }
        );

        if (!fullResponse.ok) {
          const errorText = await fullResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', fullResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${fullResponse.status} - ${errorText}`);
        }

        const fullData = await fullResponse.json();
        console.log('[elevenlabs-agent-config] Successfully performed full update');
        
        return new Response(
          JSON.stringify({ success: true, data: fullData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Action non supportée: ${action}`);
    }

  } catch (error) {
    console.error('[elevenlabs-agent-config] Error:', error);
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
