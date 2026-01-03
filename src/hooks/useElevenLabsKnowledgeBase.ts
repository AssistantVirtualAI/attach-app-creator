import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ElevenLabsKBItem {
  id: string;
  name: string;
  type: 'text' | 'file' | 'url' | 'folder';
  content?: string;
  url?: string;
  file_name?: string;
  file_size?: number;
  created_at?: string;
  updated_at?: string;
  dependent_agents?: Array<{ id: string; name: string }>;
  metadata?: Record<string, any>;
}

export interface ElevenLabsKBResponse {
  knowledge_base: {
    items: ElevenLabsKBItem[];
    total: number;
    all_documents_count: number;
  };
  requiresSetup?: boolean;
  message?: string;
}

// Fetch knowledge base for a specific agent
export const useElevenLabsKnowledgeBase = (agentId: string | null, apiKey: string | null) => {
  return useQuery({
    queryKey: ['elevenlabs-knowledge-base', agentId],
    queryFn: async () => {
      if (!agentId) throw new Error('Agent ID required');

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'list',
          agentId,
          apiKey: apiKey || undefined,
          pageSize: 100
        }
      });

      if (error) throw error;
      if (data.requiresSetup) {
        throw new Error(data.message || 'Configuration ElevenLabs requise');
      }
      return data as ElevenLabsKBResponse;
    },
    enabled: !!agentId,
  });
};

// Add text document to knowledge base
export const useAddKnowledgeBaseItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      title, 
      content, 
      category 
    }: { 
      agentId: string; 
      apiKey?: string; 
      title: string; 
      content: string; 
      category?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'create_text',
          agentId,
          apiKey: apiKey || undefined,
          title,
          content,
          category: category || 'Général'
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de l\'ajout');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', variables.agentId] });
      toast.success('Document ajouté à la base de connaissances');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de l\'ajout du document');
    },
  });
};

// Add URL document to knowledge base
export const useAddKnowledgeBaseUrl = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      url,
      title
    }: { 
      agentId: string; 
      apiKey?: string; 
      url: string;
      title?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'create_url',
          agentId,
          apiKey: apiKey || undefined,
          url,
          title
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de l\'ajout depuis l\'URL');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', variables.agentId] });
      toast.success('Document importé depuis l\'URL');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de l\'import depuis l\'URL');
    },
  });
};

// Delete item from knowledge base
export const useDeleteKnowledgeBaseItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      documentId
    }: { 
      agentId: string; 
      apiKey?: string; 
      documentId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'delete',
          agentId,
          apiKey: apiKey || undefined,
          documentId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la suppression');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', variables.agentId] });
      toast.success('Document supprimé de la base de connaissances');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });
};

// Link document to agent
export const useLinkDocumentToAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      apiKey, 
      documentId
    }: { 
      agentId: string; 
      apiKey?: string; 
      documentId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'link_to_agent',
          agentId,
          apiKey: apiKey || undefined,
          documentId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Échec de la liaison');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', variables.agentId] });
      toast.success('Document lié à l\'agent');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la liaison');
    },
  });
};

// Legacy hook for backwards compatibility
export const useUpdateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, content, category }: { title: string; content: string; category: string }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'create_text',
          title,
          content,
          category
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base'] });
      toast.success('Base de connaissances mise à jour avec succès');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour de la base de connaissances');
    },
  });
};