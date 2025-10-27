import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KnowledgeBaseItem {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  usage_count: number;
  is_synced: boolean;
  last_synced_at: string | null;
  elevenlabs_id: string | null;
  created_at: string;
  updated_at: string;
}

// Récupérer tous les articles
export const useKnowledgeBase = () => {
  return useQuery({
    queryKey: ['knowledge-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base_items')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as KnowledgeBaseItem[];
    },
  });
};

// Récupérer les catégories uniques
export const useKnowledgeBaseCategories = () => {
  return useQuery({
    queryKey: ['knowledge-base-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base_items')
        .select('category')
        .order('category');

      if (error) throw error;
      
      const uniqueCategories = [...new Set(data.map(item => item.category))];
      return uniqueCategories;
    },
  });
};

// Recherche full-text
export const useKnowledgeBaseSearch = (searchTerm: string, category: string = 'all') => {
  return useQuery({
    queryKey: ['knowledge-base-search', searchTerm, category],
    queryFn: async () => {
      let query = supabase
        .from('knowledge_base_items')
        .select('*');

      // Filtre par catégorie
      if (category !== 'all') {
        query = query.eq('category', category);
      }

      // Recherche full-text si terme présent
      if (searchTerm) {
        query = query.textSearch('search_vector', searchTerm, {
          type: 'websearch',
          config: 'french'
        });
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;
      return data as KnowledgeBaseItem[];
    },
    enabled: searchTerm.length > 0 || category !== 'all',
  });
};

// Créer un article
export const useCreateKnowledgeBaseItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<KnowledgeBaseItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'usage_count' | 'is_synced' | 'last_synced_at' | 'elevenlabs_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('knowledge_base_items')
        .insert({
          ...item,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-categories'] });
      toast.success('Article créé avec succès');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });
};

// Mettre à jour un article
export const useUpdateKnowledgeBaseItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KnowledgeBaseItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('knowledge_base_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('Article mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
};

// Supprimer un article
export const useDeleteKnowledgeBaseItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_base_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('Article supprimé');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });
};

// Synchroniser avec ElevenLabs
export const useSyncKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Récupérer tous les articles non synchronisés
      const { data: items } = await supabase
        .from('knowledge_base_items')
        .select('*')
        .eq('is_synced', false);

      if (!items || items.length === 0) {
        return { synced: 0 };
      }

      // Appeler l'Edge Function pour synchroniser
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'sync',
          items: items.map(item => ({
            id: item.id,
            title: item.title,
            content: item.content,
            category: item.category,
          }))
        }
      });

      if (error) throw error;

      // Marquer les articles comme synchronisés
      const { error: updateError } = await supabase
        .from('knowledge_base_items')
        .update({ 
          is_synced: true, 
          last_synced_at: new Date().toISOString() 
        })
        .in('id', items.map(item => item.id));

      if (updateError) throw updateError;

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success(`${data.synced || 0} articles synchronisés avec ElevenLabs`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la synchronisation');
    },
  });
};
