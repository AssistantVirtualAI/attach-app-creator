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

// Generic hook that works for all platforms
export const usePortalKnowledgeBase = () => {
  const { session } = usePortal();
  const platform = session?.platform;
  const organizationId = session?.organizationId;
  const platformAgentId = session?.platformAgentId;
  const platformApiKey = session?.platformApiKey;

  return useQuery({
    queryKey: ['portal-knowledge-base', platform, platformAgentId],
    queryFn: async (): Promise<KnowledgeBaseResponse> => {
      if (!platform) throw new Error('Platform not available');

      switch (platform) {
        case 'elevenlabs':
          return fetchElevenLabsKB(platformAgentId, platformApiKey, organizationId);
        case 'retell':
          return fetchRetellKB(organizationId, platformAgentId);
        case 'vapi':
          return fetchVapiKB(organizationId);
        default:
          throw new Error(`Platform ${platform} not supported`);
      }
    },
    enabled: !!platform && (!!organizationId || !!platformApiKey),
  });
};

// Fetch ElevenLabs knowledge base
async function fetchElevenLabsKB(
  agentId: string | undefined,
  apiKey: string | undefined,
  organizationId: string | undefined
): Promise<KnowledgeBaseResponse> {
  const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
    body: { 
      action: 'list',
      agentId,
      apiKey,
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

// Fetch Retell knowledge bases (filtered to the agent when possible)
async function fetchRetellKB(
  organizationId: string | undefined,
  agentId: string | undefined
): Promise<KnowledgeBaseResponse> {
  // Try to fetch agent config to detect which KB(s) are linked to this agent
  let allowedKbIds: string[] | null = null;
  if (agentId) {
    try {
      const { data: agentRes, error: agentErr } = await supabase.functions.invoke('retell-proxy', {
        body: {
          action: 'getAgent',
          organizationId,
          agentId,
        },
      });
      if (!agentErr) {
        const agent = agentRes?.data || agentRes;
        const kbIds =
          agent?.knowledge_base_ids ||
          agent?.knowledge_base_id ||
          agent?.knowledge_base_ids_list ||
          agent?.knowledge_base ||
          null;

        if (Array.isArray(kbIds)) allowedKbIds = kbIds.filter(Boolean);
        else if (typeof kbIds === 'string' && kbIds) allowedKbIds = [kbIds];
      }
    } catch {
      // ignore – we'll fall back to unfiltered list
    }
  }

  const { data, error } = await supabase.functions.invoke('retell-proxy', {
    body: {
      action: 'listKnowledgeBases',
      organizationId,
    },
  });

  if (error) throw error;

  const kbs = data?.data || [];
  const filteredKbs = Array.isArray(allowedKbIds) && allowedKbIds.length > 0
    ? kbs.filter((kb: any) => allowedKbIds.includes(kb.knowledge_base_id))
    : kbs;

  // Flatten KBs into items (texts/urls). If KB content isn't expanded, show KB entries.
  const items: KnowledgeItem[] = [];

  for (const kb of filteredKbs) {
    const hasTexts = Array.isArray(kb.knowledge_base_texts) && kb.knowledge_base_texts.length > 0;
    const hasUrls = Array.isArray(kb.knowledge_base_urls) && kb.knowledge_base_urls.length > 0;

    if (hasTexts) {
      for (const text of kb.knowledge_base_texts) {
        items.push({
          id: `${kb.knowledge_base_id}_text_${text.title || items.length}`,
          name: text.title || 'Document texte',
          type: 'text',
          content: text.text,
          created_at: kb.created_at,
        });
      }
    }

    if (hasUrls) {
      for (const url of kb.knowledge_base_urls) {
        items.push({
          id: `${kb.knowledge_base_id}_url_${url}`,
          name: url,
          type: 'url',
          url,
          created_at: kb.created_at,
        });
      }
    }

    if (!hasTexts && !hasUrls) {
      items.push({
        id: kb.knowledge_base_id,
        name: kb.knowledge_base_name || 'Base de connaissances',
        type: 'text',
        created_at: kb.created_at,
      });
    }
  }

  return { items, total: items.length };
}

// Fetch Vapi files
async function fetchVapiKB(organizationId: string | undefined): Promise<KnowledgeBaseResponse> {
  const { data, error } = await supabase.functions.invoke('vapi-proxy', {
    body: { 
      action: 'listFiles',
      organizationId,
    },
  });

  if (error) throw error;

  const files = data?.data || [];
  return {
    items: files.map((file: any) => ({
      id: file.id,
      name: file.name || file.originalName || 'Fichier',
      type: 'file',
      url: file.url,
      created_at: file.createdAt,
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
  const platformApiKey = session?.platformApiKey;

  return useMutation({
    mutationFn: async ({ name, content, url }: { name: string; content?: string; url?: string }) => {
      if (!platform) throw new Error('Platform not available');

      switch (platform) {
        case 'elevenlabs':
          const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
            body: { 
              action: 'add',
              agentId: platformAgentId,
              apiKey: platformApiKey,
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
  const platformApiKey = session?.platformApiKey;

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!platform) throw new Error('Platform not available');

      switch (platform) {
        case 'elevenlabs':
          const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
            body: { 
              action: 'delete',
              agentId: platformAgentId,
              apiKey: platformApiKey,
              organizationId,
              documentId,
            },
          });
          if (error) throw error;
          return data;

        case 'retell':
          // For Retell, the ID might be a KB ID or composite
          const kbId = documentId.split('_')[0];
          const { data: retellData, error: retellError } = await supabase.functions.invoke('retell-proxy', {
            body: { 
              action: 'deleteKnowledgeBase',
              organizationId,
              knowledgeBaseId: kbId,
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
  const platformApiKey = session?.platformApiKey;

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
              apiKey: platformApiKey,
              organizationId,
              documentId,
            },
          });
          if (error) throw error;
          return data?.document || data;

        case 'retell':
          const kbId = documentId.split('_')[0];
          const { data: retellData, error: retellError } = await supabase.functions.invoke('retell-proxy', {
            body: { 
              action: 'getKnowledgeBase',
              organizationId,
              knowledgeBaseId: kbId,
            },
          });
          if (retellError) throw retellError;
          return retellData?.data;

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
    enabled: !!platform && !!documentId && (!!organizationId || !!platformApiKey),
  });
};
