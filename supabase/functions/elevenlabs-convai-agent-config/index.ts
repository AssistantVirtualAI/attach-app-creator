import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

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
      ttsSettings,
      asrSettings,
      turnSettings,
      conversationSettings,
      agentAdvancedSettings,
      platformSettings,
      tools,
      webhookConfig,
      apiKey: providedApiKey, 
      integrationId,
      organizationId
    } = await req.json();
    
    console.log(`[elevenlabs-agent-config] Action: ${action}, AgentId: ${agentId}, organizationId: ${organizationId}, hasApiKey: ${!!providedApiKey}`);
    
    let apiKey = providedApiKey;
    let targetAgentId = agentId;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    // If no API key provided directly, try multiple fallback strategies
    if (!apiKey) {
      // Strategy 1: Try organizationId if provided (for portal usage)
      if (organizationId) {
        console.log(`[elevenlabs-agent-config] Looking up API key via organizationId: ${organizationId}`);
        const { data: integration } = await supabaseService
          .from('organization_integrations')
          .select('api_key, agent_id')
          .eq('organization_id', organizationId)
          .eq('platform', 'elevenlabs')
          .eq('is_active', true)
          .maybeSingle();
        
        if (integration?.api_key) {
          apiKey = integration.api_key;
          targetAgentId = agentId || integration.agent_id;
          console.log(`[elevenlabs-agent-config] Got API key from organization_integrations via organizationId`);
        }
      }
      
      // Strategy 2: Try agentId to find agent's organization
      if (!apiKey && agentId) {
        const { data: agent } = await supabaseService
          .from('agents')
          .select('platform_agent_id, platform_api_key, organization_id, config')
          .or(`id.eq.${agentId},platform_agent_id.eq.${agentId}`)
          .maybeSingle();
        
        if (agent) {
          targetAgentId = agent.platform_agent_id || agentId;
          
          if (agent.platform_api_key) {
            apiKey = agent.platform_api_key;
            console.log(`[elevenlabs-agent-config] Got API key from agent.platform_api_key`);
          } else if ((agent.config as any)?.api_key) {
            apiKey = (agent.config as any).api_key;
            console.log(`[elevenlabs-agent-config] Got API key from agent.config.api_key`);
          } else if (agent.organization_id) {
            const { data: integration } = await supabaseService
              .from('organization_integrations')
              .select('api_key')
              .eq('organization_id', agent.organization_id)
              .eq('platform', 'elevenlabs')
              .eq('is_active', true)
              .maybeSingle();
            
            if (integration?.api_key) {
              apiKey = integration.api_key;
              console.log(`[elevenlabs-agent-config] Got API key from organization_integrations via agent's org`);
            }
          }
        }
      }
      
      // Strategy 3: Try user authentication as last resort
      if (!apiKey) {
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
          });

          const { data: { user } } = await supabaseAuth.auth.getUser(token);
          if (user) {
            const { data: integration } = await supabaseAuth
              .from('organization_integrations')
              .select('api_key, agent_id')
              .eq('user_id', user.id)
              .eq('platform', 'elevenlabs')
              .eq('is_active', true)
              .maybeSingle();

            if (integration?.api_key) {
              apiKey = integration.api_key;
              targetAgentId = agentId || integration.agent_id;
              console.log(`[elevenlabs-agent-config] Got API key from user's integration`);
            }
          }
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

    // Actions that don't require an agent ID
    if (action === 'get_voices') {
      console.log('[elevenlabs-agent-config] Fetching available voices');
      
      const voicesResponse = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
        headers: { 'xi-api-key': apiKey },
      });

      if (!voicesResponse.ok) {
        const errorText = await voicesResponse.text();
        throw new Error(`ElevenLabs API error: ${voicesResponse.status} - ${errorText}`);
      }

      const voicesData = await voicesResponse.json();
      console.log(`[elevenlabs-agent-config] Fetched ${voicesData.voices?.length || 0} voices`);
      
      return new Response(
        JSON.stringify({ voices: voicesData.voices }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_models') {
      console.log('[elevenlabs-agent-config] Fetching available models');
      
      const modelsResponse = await fetch(`${ELEVENLABS_BASE_URL}/models`, {
        headers: { 'xi-api-key': apiKey },
      });

      if (!modelsResponse.ok) {
        const errorText = await modelsResponse.text();
        throw new Error(`ElevenLabs API error: ${modelsResponse.status} - ${errorText}`);
      }

      const modelsData = await modelsResponse.json();
      console.log(`[elevenlabs-agent-config] Fetched ${modelsData.length || 0} models`);
      
      return new Response(
        JSON.stringify({ models: modelsData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list_workspace_webhooks') {
      console.log('[elevenlabs-agent-config] Listing workspace webhooks');

      const webhooksResponse = await fetch(`${ELEVENLABS_BASE_URL}/workspace/webhooks?include_usages=true`, {
        headers: { 'xi-api-key': apiKey },
      });

      if (!webhooksResponse.ok) {
        const errorText = await webhooksResponse.text();
        throw new Error(`ElevenLabs API error: ${webhooksResponse.status} - ${errorText}`);
      }

      const webhooksData = await webhooksResponse.json();
      const count = Array.isArray(webhooksData?.webhooks) ? webhooksData.webhooks.length : 0;
      console.log(`[elevenlabs-agent-config] Fetched ${count} workspace webhooks`);

      return new Response(
        JSON.stringify({ webhooks: webhooksData.webhooks || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetAgentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentUrl = `${ELEVENLABS_BASE_URL}/convai/agents/${targetAgentId}`;

    switch (action) {
      case 'get': {
        console.log(`[elevenlabs-agent-config] Fetching config for agent ${targetAgentId}`);
        
        const configResponse = await fetch(agentUrl, {
          headers: { 'xi-api-key': apiKey },
        });

        if (!configResponse.ok) {
          const errorText = await configResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', configResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${configResponse.status} - ${errorText}`);
        }

        const configData = await configResponse.json();
        console.log('[elevenlabs-agent-config] Successfully fetched agent config');
        
        // Normalize the response so the client always gets the same structure
        // ElevenLabs returns conversation_config.agent.prompt.prompt, etc.
        const conversationConfig = configData.conversation_config || {};
        const agentConfig = conversationConfig.agent || {};
        
        const normalizedAgent = {
          ...configData,
          // Flatten prompt access
          prompt: {
            prompt: agentConfig.prompt?.prompt || configData.prompt?.prompt || '',
          },
          // Flatten first_message access
          first_message: agentConfig.first_message || configData.first_message || '',
          // Flatten TTS settings
          tts: conversationConfig.tts || configData.tts || {},
          // Keep original for reference
          conversation_config: conversationConfig,
        };
        
        return new Response(
          JSON.stringify({ agent: normalizedAgent }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_prompt': {
        console.log(`[elevenlabs-agent-config] Updating prompt for agent ${targetAgentId}`);
        
        const updateBody: any = {
          conversation_config: {
            agent: {
              prompt: {
                prompt: prompt
              }
            }
          }
        };

        if (firstMessage) {
          updateBody.conversation_config.agent.first_message = firstMessage;
        }
        
        const promptResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateBody),
        });

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
        
        const voiceResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(voiceBody),
        });

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

      case 'update_tts_full': {
        console.log(`[elevenlabs-agent-config] Updating full TTS settings for agent ${targetAgentId}`);
        
        if (!ttsSettings) {
          return new Response(
            JSON.stringify({ error: 'TTS settings required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const ttsBody = {
          conversation_config: {
            tts: ttsSettings
          }
        };
        
        const ttsResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ttsBody),
        });

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', ttsResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${ttsResponse.status} - ${errorText}`);
        }

        const ttsData = await ttsResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated TTS settings');
        
        return new Response(
          JSON.stringify({ success: true, data: ttsData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_asr': {
        console.log(`[elevenlabs-agent-config] Updating ASR settings for agent ${targetAgentId}`);
        
        if (!asrSettings) {
          return new Response(
            JSON.stringify({ error: 'ASR settings required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const asrBody = {
          conversation_config: {
            stt: asrSettings
          }
        };
        
        const asrResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(asrBody),
        });

        if (!asrResponse.ok) {
          const errorText = await asrResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', asrResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${asrResponse.status} - ${errorText}`);
        }

        const asrData = await asrResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated ASR settings');
        
        return new Response(
          JSON.stringify({ success: true, data: asrData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_turn': {
        console.log(`[elevenlabs-agent-config] Updating turn settings for agent ${targetAgentId}`);
        
        if (!turnSettings) {
          return new Response(
            JSON.stringify({ error: 'Turn settings required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const turnBody = {
          conversation_config: {
            turn: turnSettings
          }
        };
        
        const turnResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(turnBody),
        });

        if (!turnResponse.ok) {
          const errorText = await turnResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', turnResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${turnResponse.status} - ${errorText}`);
        }

        const turnData = await turnResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated turn settings');
        
        return new Response(
          JSON.stringify({ success: true, data: turnData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_conversation': {
        console.log(`[elevenlabs-agent-config] Updating conversation settings for agent ${targetAgentId}`);
        
        if (!conversationSettings) {
          return new Response(
            JSON.stringify({ error: 'Conversation settings required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const convBody = {
          conversation_config: {
            conversation: conversationSettings
          }
        };
        
        const convResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(convBody),
        });

        if (!convResponse.ok) {
          const errorText = await convResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', convResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${convResponse.status} - ${errorText}`);
        }

        const convData = await convResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated conversation settings');
        
        return new Response(
          JSON.stringify({ success: true, data: convData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_agent_advanced': {
        console.log(`[elevenlabs-agent-config] Updating advanced agent settings for agent ${targetAgentId}`);
        
        if (!agentAdvancedSettings) {
          return new Response(
            JSON.stringify({ error: 'Agent advanced settings required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const advancedBody = {
          conversation_config: {
            agent: agentAdvancedSettings
          }
        };
        
        const advancedResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(advancedBody),
        });

        if (!advancedResponse.ok) {
          const errorText = await advancedResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', advancedResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${advancedResponse.status} - ${errorText}`);
        }

        const advancedData = await advancedResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated advanced agent settings');
        
        return new Response(
          JSON.stringify({ success: true, data: advancedData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_platform_settings': {
        console.log(`[elevenlabs-agent-config] Updating platform settings for agent ${targetAgentId}`);
        
        if (!platformSettings) {
          return new Response(
            JSON.stringify({ error: 'Platform settings required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const platformBody = {
          platform_settings: platformSettings
        };
        
        const platformResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(platformBody),
        });

        if (!platformResponse.ok) {
          const errorText = await platformResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', platformResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${platformResponse.status} - ${errorText}`);
        }

        const platformData = await platformResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated platform settings');
        
        return new Response(
          JSON.stringify({ success: true, data: platformData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_tools': {
        console.log(`[elevenlabs-agent-config] Updating tools for agent ${targetAgentId}`);
        
        if (!tools) {
          return new Response(
            JSON.stringify({ error: 'Tools configuration required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const toolsBody = {
          conversation_config: {
            agent: {
              tools: tools
            }
          }
        };
        
        const toolsResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(toolsBody),
        });

        if (!toolsResponse.ok) {
          const errorText = await toolsResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', toolsResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${toolsResponse.status} - ${errorText}`);
        }

        const toolsData = await toolsResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated tools');
        
        return new Response(
          JSON.stringify({ success: true, data: toolsData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_webhooks': {
        console.log(`[elevenlabs-agent-config] Updating webhooks for agent ${targetAgentId}`);
        
        if (!webhookConfig) {
          return new Response(
            JSON.stringify({ error: 'Webhook configuration required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const webhookBody = {
          platform_settings: {
            webhooks: webhookConfig
          }
        };
        
        const webhookResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookBody),
        });

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text();
          console.error('[elevenlabs-agent-config] ElevenLabs API error:', webhookResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${webhookResponse.status} - ${errorText}`);
        }

        const webhookData = await webhookResponse.json();
        console.log('[elevenlabs-agent-config] Successfully updated webhooks');
        
        return new Response(
          JSON.stringify({ success: true, data: webhookData }),
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
        
        const llmResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(llmBody),
        });

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
        
        const fmResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fmBody),
        });

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
        
        const fullResponse = await fetch(agentUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fullConfig),
        });

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
