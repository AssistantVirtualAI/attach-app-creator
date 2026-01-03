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
      case 'get':
      case 'list': {
        console.log(`[elevenlabs-kb] Fetching knowledge base for agent ${targetAgentId}`);
        
        if (!targetAgentId) {
          return new Response(
            JSON.stringify({ error: 'Agent ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
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
        
        // Transform to consistent format
        const items = knowledgeBase.map((item: any, index: number) => ({
          id: item.id || item.document_id || `kb-${index}`,
          name: item.name || item.title || `Document ${index + 1}`,
          type: item.type || 'text',
          content: item.content || item.text || '',
          url: item.url || null,
          file_name: item.file_name || null,
          file_size: item.file_size || null,
          metadata: item.metadata || {}
        }));
        
        return new Response(
          JSON.stringify({ 
            knowledge_base: { 
              items,
              agent_name: configData.name
            } 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add': {
        console.log(`[elevenlabs-kb] Adding document to agent ${targetAgentId}`);
        
        if (!targetAgentId) {
          return new Response(
            JSON.stringify({ error: 'Agent ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!title || !content) {
          return new Response(
            JSON.stringify({ error: 'Title and content are required' }),
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
          const errorText = await agentResponse.text();
          console.error('[elevenlabs-kb] Failed to fetch agent:', errorText);
          throw new Error('Failed to fetch agent config');
        }
        
        const agentData = await agentResponse.json();
        const currentKB = agentData.knowledge_base || [];
        
        // Add new text item to knowledge base
        const newItem = { 
          type: 'text',
          name: title,
          content: content,
          id: `kb-${Date.now()}`,
          metadata: { category: category || 'Général', created_at: new Date().toISOString() }
        };
        
        const updateResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              knowledge_base: [...currentKB, newItem]
            }),
          }
        );
        
        if (!updateResponse.ok) {
          const updateError = await updateResponse.text();
          console.error('[elevenlabs-kb] Failed to update agent:', updateError);
          throw new Error(`Failed to add document: ${updateError}`);
        }
        
        console.log('[elevenlabs-kb] Added content via direct agent update');
        
        return new Response(
          JSON.stringify({ success: true, item: newItem }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { itemId, itemName } = await req.json().catch(() => ({}));
        console.log(`[elevenlabs-kb] Deleting item from agent ${targetAgentId}: ${itemId || itemName}`);
        
        if (!targetAgentId) {
          return new Response(
            JSON.stringify({ error: 'Agent ID required' }),
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
        
        // Filter out the item to delete
        const updatedKB = currentKB.filter((item: any) => {
          if (itemId && (item.id === itemId || item.document_id === itemId)) return false;
          if (itemName && item.name === itemName) return false;
          return true;
        });
        
        if (updatedKB.length === currentKB.length) {
          return new Response(
            JSON.stringify({ error: 'Item not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const updateResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              knowledge_base: updatedKB
            }),
          }
        );
        
        if (!updateResponse.ok) {
          const updateError = await updateResponse.text();
          throw new Error(`Failed to delete item: ${updateError}`);
        }
        
        console.log('[elevenlabs-kb] Successfully deleted item');
        
        return new Response(
          JSON.stringify({ success: true }),
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
        const newItems = items.map((item: any) => ({
          type: 'text',
          name: item.title,
          content: item.content,
          id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        return new Response(
          JSON.stringify({ error: 'Action non supportée' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
