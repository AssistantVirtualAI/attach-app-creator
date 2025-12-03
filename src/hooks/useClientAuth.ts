import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClientSession {
  clientId: string;
  clientName: string;
  organizationId: string;
  theme: string;
  language: string;
}

const CLIENT_SESSION_KEY = 'ava_client_session';

export const useClientAuth = () => {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedSession = localStorage.getItem(CLIENT_SESSION_KEY);
    if (storedSession) {
      try {
        setSession(JSON.parse(storedSession));
      } catch {
        localStorage.removeItem(CLIENT_SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (loginId: string, password: string) => {
    setIsLoading(true);
    try {
      // Find client by login_id
      const { data: client, error } = await supabase
        .from('clients')
        .select('id, name, organization_id, theme, language, login_id')
        .eq('login_id', loginId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      if (!client) {
        throw new Error('Identifiants invalides');
      }

      // For demo purposes - in production, implement proper password verification
      // The password should be stored hashed in a separate table or field
      
      const clientSession: ClientSession = {
        clientId: client.id,
        clientName: client.name,
        organizationId: client.organization_id,
        theme: client.theme || 'light',
        language: client.language || 'fr',
      };

      localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(clientSession));
      setSession(clientSession);

      return clientSession;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CLIENT_SESSION_KEY);
    setSession(null);
  }, []);

  return {
    session,
    isLoading,
    isAuthenticated: !!session,
    login,
    logout,
  };
};
