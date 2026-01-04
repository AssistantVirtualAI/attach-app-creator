import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ELEVENLABS_AGENT_ID_REGEX = /^[a-zA-Z0-9]{10,30}$/;
const READ_ACTIONS = ['list', 'get', 'get_document'] as const;
const WRITE_ACTIONS = ['add', 'create_text', 'create_url', 'delete', 'link_to_agent', 'unlink_from_agent', 'rename'] as const;
const VALID_ACTIONS = [...READ_ACTIONS, ...WRITE_ACTIONS] as const;
type ValidAction = typeof VALID_ACTIONS[number];

function isValidUUID(value: unknown): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidAgentId(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value) || ELEVENLABS_AGENT_ID_REGEX.test(value);
}

function isValidAction(value: unknown): value is ValidAction {
  return typeof value === 'string' && VALID_ACTIONS.includes(value as ValidAction);
}

function isWriteAction(action: ValidAction): boolean {
  return (WRITE_ACTIONS as readonly string[]).includes(action);
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create service client for DB operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, agentId, apiKey, documentId, title, content, url, category, itemId, search, pageSize, newName } = body;

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

    // Validate agentId if provided
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
    const sanitizedNewName = newName ? sanitizeString(newName, 500) : null;

    // Validate URL if provided
    if (url && !isValidUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format', success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[KB] Action: ${action}, agentId: ${agentId}`);

    // ============ RBAC CHECK FOR WRITE ACTIONS ============
    if (isWriteAction(action)) {
      const authHeader = req.headers.get('Authorization');
      
      if (!authHeader) {
        console.log('[KB] Write action attempted without auth header');
        return new Response(
          JSON.stringify({ error: 'Accès refusé. Authentification requise pour cette action.', success: false }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create client with user's auth
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
      
      if (userError || !user) {
        console.log('[KB] Auth validation failed:', userError);
        return new Response(
          JSON.stringify({ error: 'Accès refusé. Session invalide.', success: false }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[KB] User ${user.id} attempting write action: ${action}`);

      // Check if super admin
      const { data: isSuperAdmin } = await supabaseService.rpc('is_super_admin', { _user_id: user.id });
      
      if (isSuperAdmin) {
        console.log('[KB] User is super admin, access granted');
      } else {
        // Need to check org_admin role for the agent's organization
        let organizationId: string | null = null;

        // Get organization from agent
        if (agentId && isValidUUID(agentId)) {
          const { data: agent } = await supabaseService
            .from('agents')
            .select('organization_id')
            .eq('id', agentId)
            .single();
          
          if (agent) {
            organizationId = agent.organization_id;
          }
        }

        // If no org found from agent, try from platform_agent_id
        if (!organizationId && agentId) {
          const { data: agent } = await supabaseService
            .from('agents')
            .select('organization_id')
            .eq('platform_agent_id', agentId)
            .single();
          
          if (agent) {
            organizationId = agent.organization_id;
          }
        }

        if (!organizationId) {
          console.log('[KB] Could not determine organization for access check');
          return new Response(
            JSON.stringify({ error: 'Accès refusé. Organisation non trouvée.', success: false }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if user has org_admin role
        const { data: hasRole } = await supabaseService.rpc('has_role', { 
          _user_id: user.id, 
          _org_id: organizationId,
          _role: 'org_admin'
        });

        if (!hasRole) {
          console.log(`[KB] User ${user.id} does not have org_admin role for org ${organizationId}`);
          return new Response(
            JSON.stringify({ error: 'Accès refusé. Seuls les administrateurs peuvent effectuer cette action.', success: false }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log('[KB] User has org_admin role, access granted');
      }
    }

    // ============ GET API KEY ============
    let elevenLabsApiKey = apiKey;
    let platformAgentId: string | null = null;
    
    if (agentId) {
      // Get the agent to find its platform_agent_id and API key
      const { data: agent } = await supabaseService
        .from("agents")
        .select("platform_agent_id, platform_api_key, organization_id, config, name")
        .eq("id", agentId)
        .single();

      if (agent) {
        platformAgentId = agent.platform_agent_id;
        
        if (agent.platform_api_key) {
          elevenLabsApiKey = agent.platform_api_key;
        } else if ((agent.config as any)?.api_key) {
          elevenLabsApiKey = (agent.config as any).api_key;
        }
        
        if (!elevenLabsApiKey && agent.organization_id) {
          const { data: integration } = await supabaseService
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

      if (response.status === 204 || (options.method === 'DELETE' && response.status < 300)) {
        return { success: true };
      }

      return response.json();
    };

    switch (action) {
      case "list":
      case "get": {
        const params = new URLSearchParams();
        if (pageSize) params.append("page_size", String(Math.min(Number(pageSize) || 100, 100)));
        if (sanitizedSearch) params.append("search", sanitizedSearch);
        
        const queryString = params.toString() ? `?${params.toString()}` : "";
        
        console.log(`[KB] Fetching knowledge base list`);
        const data = await callElevenLabs(`/convai/knowledge-base${queryString}`);
        
        console.log(`[KB] Response keys: ${Object.keys(data).join(', ')}`);
        
        const documents = data.documents || data.knowledge_base || [];
        console.log(`[KB] Found ${documents.length} total documents`);
        
        let filteredDocs = documents;
        if (platformAgentId) {
          filteredDocs = documents.filter((doc: any) => {
            const dependentAgents = doc.dependent_agents || [];
            const isLinked = dependentAgents.some((a: any) => a.id === platformAgentId || a.agent_id === platformAgentId);
            return isLinked;
          });
          console.log(`[KB] After filtering for agent ${platformAgentId}: ${filteredDocs.length} documents`);
        }
        
        const items = filteredDocs.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          title: doc.name,
          type: doc.type || 'text',
          content: doc.text || doc.content || '',
          category: doc.metadata?.category || doc.metadata?.tag || 'Général',
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
        
        const categories = [...new Set(items.map((item: any) => item.category).filter(Boolean))];

        return new Response(
          JSON.stringify({ 
            knowledge_base: { 
              items,
              categories,
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
        
        if (platformAgentId && data.id) {
          try {
            console.log(`[KB] Linking document ${data.id} to agent ${platformAgentId}`);
            
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

      case "rename": {
        const docIdToRename = documentId || itemId;
        
        if (!docIdToRename) {
          throw new Error("documentId requis pour renommer");
        }
        
        if (!sanitizedNewName) {
          throw new Error("newName requis pour renommer");
        }

        console.log(`[KB] Renaming document ${docIdToRename} to: ${sanitizedNewName}`);
        
        await callElevenLabs(`/convai/knowledge-base/${docIdToRename}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sanitizedNewName,
          }),
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Document renommé avec succès" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        const docIdToDelete = documentId || itemId;
        
        if (!docIdToDelete) {
          throw new Error("documentId requis pour supprimer");
        }

        console.log(`[KB] Deleting document: ${docIdToDelete}`);
        
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
        const docId = documentId || itemId;
        if (!docId || !platformAgentId) {
          throw new Error("documentId et agentId requis pour lier un document");
        }

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
        const docId = documentId || itemId;
        if (!docId || !platformAgentId) {
          throw new Error("documentId et agentId requis pour délier un document");
        }

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
        return new Response(
          JSON.stringify({ error: 'Action non reconnue', success: false }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[KB] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
