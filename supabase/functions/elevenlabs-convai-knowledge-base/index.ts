import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ElevenLabs agent IDs are alphanumeric strings (e.g., "QNdB45Jpgh06Hr67TzFO")
const ELEVENLABS_AGENT_ID_REGEX = /^[a-zA-Z0-9]{10,30}$/;
const VALID_ACTIONS = ['list', 'get', 'get_document', 'add', 'create_text', 'create_url', 'delete', 'link_to_agent', 'unlink_from_agent'] as const;
type ValidAction = typeof VALID_ACTIONS[number];

function isValidUUID(value: unknown): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidAgentId(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // Accept both UUID format (internal) and ElevenLabs format
  return UUID_REGEX.test(value) || ELEVENLABS_AGENT_ID_REGEX.test(value);
}

function isValidAction(value: unknown): value is ValidAction {
  return typeof value === 'string' && VALID_ACTIONS.includes(value as ValidAction);
}

function sanitizeString(value: unknown, maxLength: number = 10000): string | null {
  if (typeof value !== 'string') return null;
  return value.slice(0, maxLength).trim();
}

function isValidUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, agentId, apiKey, documentId, title, content, url, category, itemId, search, pageSize } = body;

    // Validate action
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required', success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidAction(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`, success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate agentId if provided - accept both UUID (internal DB) and ElevenLabs format
    if (agentId && !isValidAgentId(agentId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid agent ID format', success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate documentId/itemId if provided
    const docId = documentId || itemId;
    if (docId && typeof docId === 'string' && docId.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Document ID too long', success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize text inputs
    const sanitizedTitle = title ? sanitizeString(title, 500) : null;
    const sanitizedContent = content ? sanitizeString(content, 100000) : null;
    const sanitizedCategory = category ? sanitizeString(category, 100) : null;
    const sanitizedSearch = search ? sanitizeString(search, 200) : null;

    // Validate URL if provided
    if (url && !isValidUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format', success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[KB] Action: ${action}, agentId: ${agentId}`);

    // Get API key from integration if not provided directly
    let elevenLabsApiKey = apiKey;
    let platformAgentId: string | null = null;
    
    if (agentId) {
      // Get the agent to find its platform_agent_id and API key
      const { data: agent } = await supabase
        .from("agents")
        .select("platform_agent_id, platform_api_key, organization_id, config, name")
        .eq("id", agentId)
        .single();

      if (agent) {
        platformAgentId = agent.platform_agent_id;
        
        // Try agent's own API key first
        if (agent.platform_api_key) {
          elevenLabsApiKey = agent.platform_api_key;
        } else if ((agent.config as any)?.api_key) {
          elevenLabsApiKey = (agent.config as any).api_key;
        }
        
        // Fallback to organization integration
        if (!elevenLabsApiKey && agent.organization_id) {
          const { data: integration } = await supabase
            .from("organization_integrations")
            .select("api_key")
            .eq("organization_id", agent.organization_id)
            .eq("platform", "elevenlabs")
            .eq("is_active", true)
            .maybeSingle();

          if (integration?.api_key) {
            elevenLabsApiKey = integration.api_key;
          }
        }
        
        console.log(`[KB] Agent: ${agent.name}, platformAgentId: ${platformAgentId}`);
      }
    }

    if (!elevenLabsApiKey) {
      console.log("[KB] No ElevenLabs API key found");
      return new Response(
        JSON.stringify({ 
          requiresSetup: true, 
          message: "Configuration ElevenLabs requise. Veuillez configurer votre clé API." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper function for ElevenLabs API calls
    const callElevenLabs = async (endpoint: string, options: RequestInit = {}) => {
      const fullUrl = `${ELEVENLABS_API_BASE}${endpoint}`;
      console.log(`[KB] Calling: ${options.method || 'GET'} ${fullUrl}`);
      
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          "xi-api-key": elevenLabsApiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[KB] ElevenLabs API error ${response.status}: ${errorText}`);
        throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`);
      }

      // Handle DELETE which may return empty response
      if (response.status === 204 || (options.method === 'DELETE' && response.status < 300)) {
        return { success: true };
      }

      return response.json();
    };

    switch (action) {
      case "list":
      case "get": {
        // List all knowledge base documents using the dedicated KB endpoint
        const params = new URLSearchParams();
        if (pageSize) params.append("page_size", String(Math.min(Number(pageSize) || 100, 100)));
        if (sanitizedSearch) params.append("search", sanitizedSearch);
        
        const queryString = params.toString() ? `?${params.toString()}` : "";
        
        console.log(`[KB] Fetching knowledge base list`);
        const data = await callElevenLabs(`/convai/knowledge-base${queryString}`);
        
        console.log(`[KB] Response keys: ${Object.keys(data).join(', ')}`);
        
        // ElevenLabs returns documents in 'documents' array
        const documents = data.documents || data.knowledge_base || [];
        console.log(`[KB] Found ${documents.length} total documents`);
        
        // Filter by agent if platformAgentId is available
        let filteredDocs = documents;
        if (platformAgentId) {
          filteredDocs = documents.filter((doc: any) => {
            const dependentAgents = doc.dependent_agents || [];
            const isLinked = dependentAgents.some((a: any) => a.id === platformAgentId || a.agent_id === platformAgentId);
            return isLinked;
          });
          console.log(`[KB] After filtering for agent ${platformAgentId}: ${filteredDocs.length} documents`);
        }
        
        // Transform to our format
        const items = filteredDocs.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type || 'text',
          content: doc.text || doc.content || '',
          url: doc.url,
          file_name: doc.file_name || doc.name,
          file_size: doc.metadata?.size_bytes || doc.size_bytes,
          created_at: doc.metadata?.created_at_unix_secs 
            ? new Date(doc.metadata.created_at_unix_secs * 1000).toISOString()
            : doc.created_at,
          updated_at: doc.metadata?.last_updated_at_unix_secs
            ? new Date(doc.metadata.last_updated_at_unix_secs * 1000).toISOString()
            : doc.updated_at,
          dependent_agents: doc.dependent_agents || [],
          metadata: doc.metadata || {},
        }));

        return new Response(
          JSON.stringify({ 
            knowledge_base: { 
              items,
              total: items.length,
              all_documents_count: documents.length
            } 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_document": {
        const docId = documentId || itemId;
        if (!docId) {
          throw new Error("documentId requis pour get_document");
        }
        
        const doc = await callElevenLabs(`/convai/knowledge-base/${docId}`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            document: {
              id: doc.id,
              name: doc.name,
              type: doc.type,
              content: doc.text || doc.content,
              url: doc.url,
              file_size: doc.metadata?.size_bytes,
              created_at: doc.metadata?.created_at_unix_secs 
                ? new Date(doc.metadata.created_at_unix_secs * 1000).toISOString()
                : null,
              dependent_agents: doc.dependent_agents || [],
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "add":
      case "create_text": {
        // Create a text document using the dedicated endpoint
        const docName = sanitizedTitle || `Document ${new Date().toISOString()}`;
        const docContent = sanitizedContent || "";
        
        if (!docContent) {
          return new Response(
            JSON.stringify({ error: "Le contenu est requis pour créer un document texte", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[KB] Creating text document: ${docName}`);
        
        const data = await callElevenLabs("/convai/knowledge-base/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: docName,
            text: docContent,
          }),
        });

        console.log(`[KB] Created document: ${JSON.stringify(data)}`);
        
        // Link to agent if we have a platformAgentId
        if (platformAgentId && data.id) {
          try {
            console.log(`[KB] Linking document ${data.id} to agent ${platformAgentId}`);
            
            // Get current agent config
            const agentConfig = await callElevenLabs(`/convai/agents/${platformAgentId}`);
            const currentKbIds = (agentConfig.knowledge_base || []).map((kb: any) => kb.id || kb);
            
            if (!currentKbIds.includes(data.id)) {
              currentKbIds.push(data.id);
              
              await callElevenLabs(`/convai/agents/${platformAgentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  knowledge_base: currentKbIds,
                }),
              });
              console.log(`[KB] Document linked to agent`);
            }
          } catch (linkError) {
            console.error(`[KB] Failed to link document to agent:`, linkError);
            // Don't fail the whole operation
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            documentId: data.id,
            message: "Document créé avec succès"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_url": {
        // Create a document from URL - validation already done above
        if (!url) {
          return new Response(
            JSON.stringify({ error: "L'URL est requise pour créer un document depuis une URL", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[KB] Creating URL document: ${url}`);
        
        const data = await callElevenLabs("/convai/knowledge-base/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url,
            name: sanitizedTitle || url,
          }),
        });

        console.log(`[KB] Created URL document: ${JSON.stringify(data)}`);

        // Link to agent if we have a platformAgentId
        if (platformAgentId && data.id) {
          try {
            const agentConfig = await callElevenLabs(`/convai/agents/${platformAgentId}`);
            const currentKbIds = (agentConfig.knowledge_base || []).map((kb: any) => kb.id || kb);
            
            if (!currentKbIds.includes(data.id)) {
              currentKbIds.push(data.id);
              
              await callElevenLabs(`/convai/agents/${platformAgentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  knowledge_base: currentKbIds,
                }),
              });
            }
          } catch (linkError) {
            console.error(`[KB] Failed to link URL document to agent:`, linkError);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            documentId: data.id,
            message: "Document créé depuis l'URL avec succès"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        // Delete a document using the dedicated endpoint
        const docIdToDelete = documentId || itemId;
        
        if (!docIdToDelete) {
          throw new Error("documentId requis pour supprimer");
        }

        console.log(`[KB] Deleting document: ${docIdToDelete}`);
        
        // Use force=true to delete even if used by agents
        await callElevenLabs(`/convai/knowledge-base/${docIdToDelete}?force=true`, {
          method: "DELETE",
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Document supprimé avec succès" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "link_to_agent": {
        // Link a document to an agent
        const docId = documentId || itemId;
        if (!docId || !platformAgentId) {
          throw new Error("documentId et agentId requis pour lier un document");
        }

        // Get current agent config
        const agentConfig = await callElevenLabs(`/convai/agents/${platformAgentId}`);
        const currentKbIds = (agentConfig.knowledge_base || []).map((kb: any) => kb.id || kb);
        
        if (!currentKbIds.includes(docId)) {
          currentKbIds.push(docId);
          
          await callElevenLabs(`/convai/agents/${platformAgentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              knowledge_base: currentKbIds,
            }),
          });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Document lié à l'agent avec succès" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "unlink_from_agent": {
        // Unlink a document from an agent
        const docId = documentId || itemId;
        if (!docId || !platformAgentId) {
          throw new Error("documentId et agentId requis pour délier un document");
        }

        // Get current agent config
        const agentConfig = await callElevenLabs(`/convai/agents/${platformAgentId}`);
        const currentKbIds = (agentConfig.knowledge_base || []).map((kb: any) => kb.id || kb)
          .filter((id: string) => id !== docId);

        await callElevenLabs(`/convai/agents/${platformAgentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            knowledge_base: currentKbIds,
          }),
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Document délié de l'agent avec succès" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Action non supportée: ${action}`);
    }
  } catch (error: unknown) {
    console.error("[KB] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur lors de l'opération";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
