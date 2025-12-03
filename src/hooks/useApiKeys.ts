import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { useToast } from '@/hooks/use-toast';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | null;
  is_active: boolean | null;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  created_by: string | null;
}

const AVAILABLE_SCOPES = [
  'read:analytics',
  'read:conversations',
  'write:conversations',
  'read:agents',
  'write:agents',
  'read:clients',
  'write:clients',
  'read:knowledge_base',
  'write:knowledge_base',
];

export const useApiKeys = () => {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['api-keys', selectedOrgId],
    queryFn: async (): Promise<ApiKey[]> => {
      if (!selectedOrgId) return [];

      const { data, error } = await supabase
        .from('organization_api_keys')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId,
  });

  const createApiKey = useMutation({
    mutationFn: async ({ 
      name, 
      scopes, 
      expiresAt 
    }: { 
      name: string; 
      scopes: string[]; 
      expiresAt?: Date 
    }): Promise<{ key: string; keyData: ApiKey }> => {
      if (!selectedOrgId) throw new Error('No organization selected');

      // Generate a secure API key
      const { data: generatedKey, error: keyError } = await supabase.rpc('generate_api_key');
      if (keyError) throw keyError;

      const keyPrefix = generatedKey.substring(0, 12);
      
      // Hash the key for storage (simple hash for demo - use bcrypt in production)
      const keyHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(generatedKey)
      );
      const hashArray = Array.from(new Uint8Array(keyHash));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('organization_api_keys')
        .insert({
          organization_id: selectedOrgId,
          name,
          key_prefix: keyPrefix,
          key_hash: hashHex,
          scopes,
          created_by: user?.id,
          expires_at: expiresAt?.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return { key: generatedKey, keyData: data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'Clé API créée avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const revokeApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('organization_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'Clé API révoquée' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la révocation', variant: 'destructive' });
    },
  });

  const deleteApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('organization_api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'Clé API supprimée' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    },
  });

  return {
    apiKeys: query.data || [],
    isLoading: query.isLoading,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
    availableScopes: AVAILABLE_SCOPES,
  };
};
