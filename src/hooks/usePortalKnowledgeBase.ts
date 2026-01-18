import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/hooks/usePortalAuth';

export interface KnowledgeItem {
  id: string;
  name: string;
  title?: string;
  type: 'text' | 'url' | 'file';
  content?: string;
  url?: string;
  created_at?: string;
  contentUnavailableReason?: string;
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
          return fetchVapiKB(organizationId, platformAgentId);
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
  let agentFetched = false;
  
  if (agentId) {
    try {
      const { data: agentData, error: agentError } = await supabase.functions.invoke('retell-proxy', {
        body: { action: 'getAgent', organizationId, agentId },
      });
      
      if (!agentError && agentData?.data) {
        agentFetched = true;
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

  console.log('[RetellKB] Total available KBs:', kbs.length);

  // If agent has linked KBs, filter to only show those
  // If no linked KBs but agent was fetched, show all org KBs (agent hasn't been configured yet)
  // This ensures the portal client matches the portal admin behavior
  const filteredKbs = linkedKbIds.length > 0 
    ? kbs.filter((kb: any) => linkedKbIds.includes(kb.knowledge_base_id))
    : kbs; // Show all available KBs if none specifically linked

  console.log('[RetellKB] Displaying KBs:', filteredKbs.length, linkedKbIds.length > 0 ? '(filtered by agent links)' : '(all available)');

  const items: KnowledgeItem[] = filteredKbs.map((kb: any) => ({
    id: kb.knowledge_base_id,
    name: kb.knowledge_base_name || 'Base de connaissances',
    type: 'text',
    created_at: kb.created_at,
  }));

  return { items, total: kbs.length };
}

// Fetch VAPI knowledge base - filtered by assistant's linked files
async function fetchVapiKB(
  organizationId: string | undefined,
  assistantId: string | undefined
): Promise<KnowledgeBaseResponse> {
  let linkedFileIds: string[] = [];
  let isFilteredByAssistant = false;

  // Try to get assistant config to find linked knowledge base / files
  if (assistantId) {
    try {
      const { data: assistantData, error: assistantError } = await supabase.functions.invoke('vapi-proxy', {
        body: { action: 'getAssistant', organizationId, assistantId },
      });

      if (!assistantError && assistantData?.data) {
        const assistant = assistantData.data;
        console.log('[VapiKB] Assistant data:', JSON.stringify(assistant));

        // Check various possible shapes for knowledge base references
        // knowledgeBase can be an object with fileIds or id
        if (assistant.knowledgeBase) {
          const kb = assistant.knowledgeBase;
          if (Array.isArray(kb.fileIds)) {
            linkedFileIds = kb.fileIds;
            isFilteredByAssistant = true;
          } else if (kb.id) {
            // Fetch the knowledge base to get file IDs
            try {
              const { data: kbData } = await supabase.functions.invoke('vapi-proxy', {
                body: { action: 'getKnowledgeBase', organizationId, knowledgeBaseId: kb.id },
              });
              if (kbData?.data?.fileIds) {
                linkedFileIds = kbData.data.fileIds;
                isFilteredByAssistant = true;
              }
            } catch (kbError) {
              console.warn('[VapiKB] Could not fetch KB details:', kbError);
            }
          }
        }

        // Also check knowledgeBases (array of KB objects)
        if (Array.isArray(assistant.knowledgeBases)) {
          for (const kb of assistant.knowledgeBases) {
            if (Array.isArray(kb.fileIds)) {
              linkedFileIds.push(...kb.fileIds);
              isFilteredByAssistant = true;
            } else if (kb.id) {
              try {
                const { data: kbData } = await supabase.functions.invoke('vapi-proxy', {
                  body: { action: 'getKnowledgeBase', organizationId, knowledgeBaseId: kb.id },
                });
                if (kbData?.data?.fileIds) {
                  linkedFileIds.push(...kbData.data.fileIds);
                  isFilteredByAssistant = true;
                }
              } catch (kbError) {
                console.warn('[VapiKB] Could not fetch KB details:', kbError);
              }
            }
          }
        }

        // Check direct knowledgeBaseId reference
        if (assistant.knowledgeBaseId) {
          try {
            const { data: kbData } = await supabase.functions.invoke('vapi-proxy', {
              body: { action: 'getKnowledgeBase', organizationId, knowledgeBaseId: assistant.knowledgeBaseId },
            });
            if (kbData?.data?.fileIds) {
              linkedFileIds.push(...kbData.data.fileIds);
              isFilteredByAssistant = true;
            }
          } catch (kbError) {
            console.warn('[VapiKB] Could not fetch KB from knowledgeBaseId:', kbError);
          }
        }

        console.log('[VapiKB] Linked file IDs from assistant:', linkedFileIds);
      }
    } catch (e) {
      console.warn('[VapiKB] Could not fetch assistant config for KB filtering:', e);
    }
  }

  // Fetch all files
  const { data, error } = await supabase.functions.invoke('vapi-proxy', {
    body: { action: 'listFiles', organizationId },
  });

  if (error) throw error;

  let files = data?.data || data || [];
  files = Array.isArray(files) ? files : [];

  // Filter by linked file IDs if we found any
  if (isFilteredByAssistant && linkedFileIds.length > 0) {
    files = files.filter((file: any) => linkedFileIds.includes(file.id));
    console.log('[VapiKB] Filtered files by assistant links:', files.length);
  }

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

        case 'retell': {
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

          // Then link the new KB to the agent
          const newKbId = retellData?.data?.knowledge_base_id;
          if (newKbId && platformAgentId) {
            console.log('[RetellKB] Linking new KB', newKbId, 'to agent', platformAgentId);
            
            // Get current agent config to preserve existing KB IDs
            const { data: agentData } = await supabase.functions.invoke('retell-proxy', {
              body: { action: 'getAgent', organizationId, agentId: platformAgentId },
            });
            
            const currentKbIds = agentData?.data?.knowledge_base_ids || [];
            const updatedKbIds = [...currentKbIds, newKbId];
            
            // Update agent with new KB list
            const { error: updateError } = await supabase.functions.invoke('retell-proxy', {
              body: { 
                action: 'updateAgent',
                organizationId,
                agentId: platformAgentId,
                retellAgentId: platformAgentId,
                config: { knowledge_base_ids: updatedKbIds },
              },
            });
            
            if (updateError) {
              console.warn('[RetellKB] Failed to link KB to agent:', updateError);
            } else {
              console.log('[RetellKB] Successfully linked KB to agent');
            }
          }
          
          return retellData;
        }

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

// Update document mutation
export const usePortalUpdateKnowledgeDocument = () => {
  const { session } = usePortal();
  const queryClient = useQueryClient();
  const platform = session?.platform;
  const organizationId = session?.organizationId;
  const platformAgentId = session?.platformAgentId;

  return useMutation({
    mutationFn: async ({ documentId, name, content, url }: { documentId: string; name?: string; content?: string; url?: string }) => {
      if (!platform) throw new Error('Platform not available');

      switch (platform) {
        case 'elevenlabs': {
          // ElevenLabs doesn't have a direct update endpoint for content
          // We need to delete and recreate, or use rename if only name changes
          if (name && !content && !url) {
            // Just renaming
            const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
              body: { 
                action: 'rename',
                agentId: platformAgentId,
                organizationId,
                documentId,
                newName: name,
              },
            });
            if (error) throw error;
            return data;
          } else {
            // For content updates, we need to delete and recreate
            // First delete
            await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
              body: { 
                action: 'delete',
                agentId: platformAgentId,
                organizationId,
                documentId,
              },
            });
            // Then add new
            const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
              body: { 
                action: 'add',
                agentId: platformAgentId,
                organizationId,
                name: name || 'Document',
                content,
                url,
              },
            });
            if (error) throw error;
            return data;
          }
        }

        case 'retell': {
          // Use updateKnowledgeBase action
          const updatePayload: any = {};
          if (name) updatePayload.knowledge_base_name = name;
          if (content) updatePayload.knowledge_base_texts = [{ title: name || 'Document', text: content }];
          if (url) updatePayload.knowledge_base_urls = [url];
          
          const { data, error } = await supabase.functions.invoke('retell-proxy', {
            body: { 
              action: 'updateKnowledgeBase',
              organizationId,
              knowledgeBaseId: documentId,
              ...updatePayload,
            },
          });
          if (error) throw error;
          return data;
        }

        case 'vapi': {
          // Vapi doesn't support direct file update, so delete and recreate
          await supabase.functions.invoke('vapi-proxy', {
            body: { 
              action: 'deleteFile',
              organizationId,
              fileId: documentId,
            },
          });
          
          const { data, error } = await supabase.functions.invoke('vapi-proxy', {
            body: { 
              action: 'createFile',
              organizationId,
              name: name || 'document.txt',
              content,
              url,
            },
          });
          if (error) throw error;
          return data;
        }

        default:
          throw new Error(`Platform ${platform} not supported`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['portal-knowledge-document'] });
    },
  });
};

// Get document content - Fixed to use proper action for each platform
export const usePortalKnowledgeDocument = (documentId: string | null) => {
  const { session } = usePortal();
  const platform = session?.platform;
  const organizationId = session?.organizationId;
  const platformAgentId = session?.platformAgentId;

  return useQuery({
    queryKey: ['portal-knowledge-document', platform, documentId],
    queryFn: async (): Promise<KnowledgeItem> => {
      if (!platform || !documentId) throw new Error('Missing parameters');

      switch (platform) {
        case 'elevenlabs': {
          // Use get_document action to fetch actual content
          const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
            body: { 
              action: 'get_document',
              agentId: platformAgentId,
              organizationId,
              documentId,
            },
          });
          if (error) throw error;
          
          const doc = data?.document || data;
          return {
            id: doc.id || documentId,
            name: doc.name || doc.title || 'Document',
            type: doc.type || 'text',
            content: doc.content || doc.text || undefined,
            url: doc.url,
            created_at: doc.created_at,
            contentUnavailableReason: doc.contentUnavailableReason,
          };
        }

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
          
          // Parse knowledge_base_sources (new Retell API structure)
          const sources = kb?.knowledge_base_sources || [];
          const documents = sources.filter((s: any) => s.type === 'document');
          const urls = sources.filter((s: any) => s.type === 'url');

          const contentParts: string[] = [];
          
          // Add documents (files)
          if (documents.length > 0) {
            contentParts.push(
              '## Documents\n' +
              documents.map((doc: any) => 
                `- **${doc.filename || 'Document'}**${doc.file_url ? ` ([Télécharger](${doc.file_url}))` : ''}`
              ).join('\n')
            );
          }
          
          // Add URLs
          if (urls.length > 0) {
            contentParts.push(
              '## URLs\n' +
              urls.map((u: any) => `- ${u.url}`).join('\n')
            );
          }

          return {
            id: kb?.knowledge_base_id || documentId,
            name: kb?.knowledge_base_name || 'Base de connaissances',
            type: 'text',
            content: contentParts.join('\n\n') || 'Aucun contenu disponible',
            url: urls.length > 0 ? urls[0].url : undefined,
            created_at: kb?.created_at,
          };
        }

        case 'vapi': {
          // First get file metadata
          const { data: vapiData, error: vapiError } = await supabase.functions.invoke('vapi-proxy', {
            body: { 
              action: 'getFile',
              organizationId,
              fileId: documentId,
            },
          });
          if (vapiError) throw vapiError;
          
          const file = vapiData?.data || vapiData;
          
          // Try to fetch actual content from the file URL if available
          let fileContent: string | undefined;
          let contentUnavailableReason: string | undefined;
          
          if (file.url) {
            try {
              // Use the getFileContent action to download and extract text
              const { data: contentData, error: contentError } = await supabase.functions.invoke('vapi-proxy', {
                body: { 
                  action: 'getFileContent',
                  organizationId,
                  fileId: documentId,
                  fileUrl: file.url,
                },
              });
              
              if (!contentError && contentData?.data?.content) {
                fileContent = contentData.data.content;
              } else if (contentData?.data?.contentUnavailableReason) {
                contentUnavailableReason = contentData.data.contentUnavailableReason;
              }
            } catch (e) {
              console.warn('[VapiKB] Could not fetch file content:', e);
              contentUnavailableReason = 'fetch_error';
            }
          }
          
          return {
            id: file.id || documentId,
            name: file.name || file.filename || 'Fichier',
            type: file.type || 'file',
            content: fileContent,
            url: file.url,
            created_at: file.created_at || file.createdAt,
            contentUnavailableReason,
          };
        }

        default:
          throw new Error(`Platform ${platform} not supported`);
      }
    },
    enabled: !!platform && !!documentId && !!organizationId,
  });
};
