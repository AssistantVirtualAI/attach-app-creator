import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/hooks/usePortalAuth';

export interface KnowledgeItem {
  id: string;
  name: string;
  type: 'text' | 'url' | 'file';
  content?: string;
  url?: string;
  created_at?: string;
}

export interface KnowledgeBaseResponse {
  items: KnowledgeItem[];
  total: number;
}

// SECURITY: All hooks now use organizationId for auth - API keys are fetched server-side

// Generic hook that works for all platforms
export const usePortalKnowledgeBase = () => {
  const { session } = usePortal();
  const platform = session?.platform;
  const organizationId = session?.organizationId;
  const platformAgentId = session?.platformAgentId;

  return useQuery({
    queryKey: ['portal-knowledge-base', platform, platformAgentId],
    queryFn: async (): Promise<KnowledgeBaseResponse> => {
      if (!platform) throw new Error('Platform not available');

      switch (platform) {
        case 'elevenlabs':
          return fetchElevenLabsKB(platformAgentId, organizationId);
        case 'retell':
          return fetchRetellKB(organizationId, platformAgentId);
        case 'vapi':
          return fetchVapiKB(organizationId);
        default:
          throw new Error(`Platform ${platform} not supported`);
      }
    },
    enabled: !!platform && !!organizationId,
  });
};

// Fetch ElevenLabs knowledge base
async function fetchElevenLabsKB(
  agentId: string | undefined,
  organizationId: string | undefined
): Promise<KnowledgeBaseResponse> {
  const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
    body: { 
      action: 'list',
      agentId,
      organizationId,
    },
  });

  if (error) throw error;

  const items = data?.knowledge_base?.items || data?.items || [];
  return {
    items: items.map((item: any) => ({
      id: item.id,
      name: item.name || item.title || 'Sans titre',
      type: item.type || 'text',
      content: item.content,
      url: item.url,
      created_at: item.created_at,
    })),
    total: items.length,
  };
}

// Fetch Retell knowledge bases - filtered by agent's linked KBs
async function fetchRetellKB(
  organizationId: string | undefined,
  agentId: string | undefined
): Promise<KnowledgeBaseResponse> {
  // First get the agent config to find linked knowledge_base_ids
  let linkedKbIds: string[] = [];
  
  if (agentId) {
    try {
      const { data: agentData, error: agentError } = await supabase.functions.invoke('retell-proxy', {
        body: { action: 'getAgent', organizationId, agentId },
      });
      
      if (!agentError && agentData?.data) {
        // Retell agent config has knowledge_base_ids array
        linkedKbIds = agentData.data.knowledge_base_ids || [];
        console.log('[RetellKB] Agent linked KB IDs:', linkedKbIds);
      }
    } catch (e) {
      console.warn('[RetellKB] Could not fetch agent config for KB filtering:', e);
    }
  }

  // Fetch all knowledge bases
  const { data, error } = await supabase.functions.invoke('retell-proxy', {
    body: { action: 'listKnowledgeBases', organizationId },
  });

  if (error) throw error;

  // Retell returns array directly or wrapped in data
  const rawKbs = data?.data || data || [];
  const kbs = Array.isArray(rawKbs) ? rawKbs : [];

  // Filter to only show KBs linked to this agent if we have linked IDs
  const filteredKbs = linkedKbIds.length > 0 
    ? kbs.filter((kb: any) => linkedKbIds.includes(kb.knowledge_base_id))
    : kbs; // If no agent or no linked IDs, show all (fallback)

  const items: KnowledgeItem[] = filteredKbs.map((kb: any) => ({
    id: kb.knowledge_base_id,
    name: kb.knowledge_base_name || 'Base de connaissances',
    type: 'text',
    created_at: kb.created_at,
  }));

  return { items, total: items.length };
}

// Fetch VAPI knowledge base
async function fetchVapiKB(
  organizationId: string | undefined
): Promise<KnowledgeBaseResponse> {
  const { data, error } = await supabase.functions.invoke('vapi-proxy', {
    body: { action: 'listFiles', organizationId },
  });

  if (error) throw error;

  const files = data?.data || data || [];
  return {
    items: files.map((file: any) => ({
      id: file.id,
      name: file.name || file.filename || 'Fichier',
      type: file.type || 'file',
      url: file.url,
      created_at: file.created_at || file.createdAt,
    })),
    total: files.length,
  };
}

// Add document mutation
export const usePortalAddKnowledgeDocument = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();
  const platform = session?.platform;
  const organizationId = session?.organizationId;
  const platformAgentId = session?.platformAgentId;

  return useMutation({
    mutationFn: async ({ name, content, url }: { name: string; content?: string; url?: string }) => {
      if (!platform) throw new Error('Platform not available');

      switch (platform) {
        case 'elevenlabs':
          const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
            body: { 
              action: 'add',
              agentId: platformAgentId,
              organizationId,
              name,
              content,
              url,
            },
          });
          if (error) throw error;
          return data;

        case 'retell':
          // First create a knowledge base with the document
          const { data: retellData, error: retellError } = await supabase.functions.invoke('retell-proxy', {
            body: { 
              action: 'createKnowledgeBase',
              organizationId,
              name,
              texts: content ? [{ title: name, content }] : undefined,
              urls: url ? [url] : undefined,
            },
          });
          if (retellError) throw retellError;
          return retellData;

        case 'vapi':
          const { data: vapiData, error: vapiError } = await supabase.functions.invoke('vapi-proxy', {
            body: { 
              action: 'createFile',
              organizationId,
              name,
              content,
              url,
            },
          });
          if (vapiError) throw vapiError;
          return vapiData;

        default:
          throw new Error(`Platform ${platform} not supported`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-knowledge-base'] });
    },
  });
};

// Delete document mutation
export const usePortalDeleteKnowledgeDocument = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();
  const platform = session?.platform;
  const organizationId = session?.organizationId;
  const platformAgentId = session?.platformAgentId;

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!platform) throw new Error('Platform not available');

      switch (platform) {
        case 'elevenlabs':
          const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
            body: { 
              action: 'delete',
              agentId: platformAgentId,
              organizationId,
              documentId,
            },
          });
          if (error) throw error;
          return data;

        case 'retell':
          // For Retell, the documentId IS the knowledge_base_id directly
          const { data: retellData, error: retellError } = await supabase.functions.invoke('retell-proxy', {
            body: { 
              action: 'deleteKnowledgeBase',
              organizationId,
              knowledgeBaseId: documentId,
            },
          });
          if (retellError) throw retellError;
          return retellData;

        case 'vapi':
          const { data: vapiData, error: vapiError } = await supabase.functions.invoke('vapi-proxy', {
            body: { 
              action: 'deleteFile',
              organizationId,
              fileId: documentId,
            },
          });
          if (vapiError) throw vapiError;
          return vapiData;

        default:
          throw new Error(`Platform ${platform} not supported`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-knowledge-base'] });
    },
  });
};

// Get document content
export const usePortalKnowledgeDocument = (documentId: string | null) => {
  const { session } = usePortal();
  const platform = session?.platform;
  const organizationId = session?.organizationId;
  const platformAgentId = session?.platformAgentId;

  return useQuery({
    queryKey: ['portal-knowledge-document', platform, documentId],
    queryFn: async () => {
      if (!platform || !documentId) throw new Error('Missing parameters');

      switch (platform) {
        case 'elevenlabs':
          const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
            body: { 
              action: 'get',
              agentId: platformAgentId,
              organizationId,
              documentId,
            },
          });
          if (error) throw error;
          return data?.document || data;

        case 'retell': {
          // For Retell, the documentId IS the knowledge_base_id directly
          const { data: retellData, error: retellError } = await supabase.functions.invoke('retell-proxy', {
            body: {
              action: 'getKnowledgeBase',
              organizationId,
              knowledgeBaseId: documentId,
            },
          });
          if (retellError) throw retellError;

          const kb = retellData?.data;
          const texts = Array.isArray(kb?.knowledge_base_texts) ? kb.knowledge_base_texts : [];
          const urls = Array.isArray(kb?.knowledge_base_urls) ? kb.knowledge_base_urls : [];

          const contentParts: string[] = [];
          if (texts.length > 0) {
            contentParts.push(
              ...texts.map((t: any, idx: number) => {
                const title = t?.title || `Document ${idx + 1}`;
                const text = t?.text || '';
                return `# ${title}\n\n${text}`.trim();
              })
            );
          }
          if (urls.length > 0) {
            contentParts.push(`Liens:\n${urls.map((u: string) => `- ${u}`).join('\n')}`);
          }

          return {
            id: kb?.knowledge_base_id || documentId,
            name: kb?.knowledge_base_name || 'Base de connaissances',
            type: 'text',
            content: contentParts.join('\n\n---\n\n') || undefined,
            url: urls[0],
            created_at: kb?.created_at,
          } as KnowledgeItem;
        }

        case 'vapi':
          const { data: vapiData, error: vapiError } = await supabase.functions.invoke('vapi-proxy', {
            body: { 
              action: 'getFile',
              organizationId,
              fileId: documentId,
            },
          });
          if (vapiError) throw vapiError;
          return vapiData?.data;

        default:
          throw new Error(`Platform ${platform} not supported`);
      }
    },
    enabled: !!platform && !!documentId && !!organizationId,
  });
};
