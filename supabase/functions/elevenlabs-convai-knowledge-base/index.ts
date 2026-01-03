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
    const { action, agentId, title, content, category, items, apiKey: providedApiKey, integrationId } = await req.json();
    
    console.log(`[elevenlabs-kb] Action: ${action}, AgentId: ${agentId}`);
    
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
        console.error('[elevenlabs-kb] Auth error:', userError);
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
          console.log('[elevenlabs-kb] Got API key from agent config');
        } else if (agentData?.config && (agentData.config as any)?.api_key) {
          apiKey = (agentData.config as any).api_key;
          console.log('[elevenlabs-kb] Got API key from agent config.api_key');
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
          console.log('[elevenlabs-kb] Got API key from integration');
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
          console.log('[elevenlabs-kb] Got API key from user integration');
        }
      }
    }

    if (!apiKey) {
      console.log('[elevenlabs-kb] No API key found');
      return new Response(
        JSON.stringify({ 
          requiresSetup: true, 
          message: 'Configuration ElevenLabs requise' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'get': {
        console.log(`[elevenlabs-kb] Fetching knowledge base for agent ${targetAgentId}`);
        
        // Get agent config which includes knowledge base
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
          console.error('[elevenlabs-kb] ElevenLabs API error:', configResponse.status, errorText);
          throw new Error(`ElevenLabs API error: ${configResponse.status}`);
        }

        const configData = await configResponse.json();
        console.log('[elevenlabs-kb] Successfully fetched agent knowledge base');
        
        // Extract knowledge base from agent config
        const knowledgeBase = configData.knowledge_base || [];
        
        return new Response(
          JSON.stringify({ 
            knowledge_base: { 
              items: knowledgeBase,
              agent_name: configData.name
            } 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add': {
        console.log(`[elevenlabs-kb] Adding document to agent ${targetAgentId}`);
        
        if (!title || !content) {
          return new Response(
            JSON.stringify({ error: 'Title and content are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Create a text document in ElevenLabs knowledge base
        const formData = new FormData();
        const blob = new Blob([content], { type: 'text/plain' });
        formData.append('file', blob, `${title}.txt`);
        formData.append('name', title);
        
        const createDocResponse = await fetch(
          'https://api.elevenlabs.io/v1/convai/knowledge-base/documents',
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
            },
            body: formData,
          }
        );

        let docData = null;
        
        if (!createDocResponse.ok) {
          const errorText = await createDocResponse.text();
          console.error('[elevenlabs-kb] Error creating document:', createDocResponse.status, errorText);
          
          // Try alternative: add as text directly via agent update
          // Get current agent config
          const agentResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
            {
              headers: { 'xi-api-key': apiKey },
            }
          );
          
          if (agentResponse.ok) {
            const agentData = await agentResponse.json();
            const currentKB = agentData.knowledge_base || [];
            
            // Add new text item to knowledge base
            const updateResponse = await fetch(
              `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
              {
                method: 'PATCH',
                headers: {
                  'xi-api-key': apiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  knowledge_base: [...currentKB, { 
                    type: 'text',
                    name: title,
                    content: content,
                    metadata: { category: category || 'Général' }
                  }]
                }),
              }
            );
            
            if (updateResponse.ok) {
              docData = { success: true, method: 'direct_update' };
              console.log('[elevenlabs-kb] Added content via direct agent update');
            } else {
              const updateError = await updateResponse.text();
              console.error('[elevenlabs-kb] Failed to update agent:', updateError);
              throw new Error(`Failed to add document: ${updateError}`);
            }
          }
        } else {
          docData = await createDocResponse.json();
          console.log('[elevenlabs-kb] Document created:', docData);

          // Link document to the agent if we got a document_id
          if (docData?.document_id) {
            const agentResponse = await fetch(
              `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
              {
                headers: { 'xi-api-key': apiKey },
              }
            );
            
            if (agentResponse.ok) {
              const agentData = await agentResponse.json();
              const currentKB = agentData.knowledge_base || [];
              
              const updateResponse = await fetch(
                `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
                {
                  method: 'PATCH',
                  headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    knowledge_base: [...currentKB, { 
                      type: 'document',
                      id: docData.document_id,
                      name: title
                    }]
                  }),
                }
              );
              
              if (!updateResponse.ok) {
                console.error('[elevenlabs-kb] Failed to link document to agent');
              }
            }
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, data: docData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync': {
        console.log(`[elevenlabs-kb] Syncing items to agent ${targetAgentId}`);
        
        if (!items || !Array.isArray(items)) {
          return new Response(
            JSON.stringify({ error: 'Items array required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current agent config
        const agentResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            headers: { 'xi-api-key': apiKey },
          }
        );
        
        if (!agentResponse.ok) {
          throw new Error('Failed to fetch agent config');
        }
        
        const agentData = await agentResponse.json();
        const currentKB = agentData.knowledge_base || [];
        
        // Add all items as text entries
        const newItems = items.map(item => ({
          type: 'text',
          name: item.title,
          content: item.content,
          metadata: { category: item.category || 'Général' }
        }));
        
        const updateResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              knowledge_base: [...currentKB, ...newItems]
            }),
          }
        );
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to sync items: ${errorText}`);
        }
        
        return new Response(
          JSON.stringify({ success: true, synced: items.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Action non supportée');
    }

  } catch (error) {
    console.error('[elevenlabs-kb] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
