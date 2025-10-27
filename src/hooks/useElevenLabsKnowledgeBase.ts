import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KnowledgeBaseItem {
  id: string;
  title: string;
  content: string;
  category: string;
}

export interface KnowledgeBaseResponse {
  knowledge_base: {
    items: KnowledgeBaseItem[];
    categories: string[];
    total_items: number;
  };
  requiresSetup?: boolean;
  message?: string;
}

export const useElevenLabsKnowledgeBase = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['elevenlabs-knowledge-base'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { action: 'get' }
      });

      if (error) throw error;
      return data as KnowledgeBaseResponse;
    },
    enabled,
  });
};

export const useUpdateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, content, category }: { title: string; content: string; category: string }) => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'update',
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