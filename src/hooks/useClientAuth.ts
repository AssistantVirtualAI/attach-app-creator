import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/lib/i18n';

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
      // Call backend function for secure password verification
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: {
          action: 'login',
          login_id: loginId,
          password,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.session) {
        throw new Error(t('messages.connectionError'));
      }

      const clientSession: ClientSession = data.session;

      localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(clientSession));
      setSession(clientSession);

      return clientSession;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAsAdmin = useCallback(async (clientId: string) => {
    setIsLoading(true);
    try {
      // Get the current Supabase session to include auth token
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData?.session?.access_token;

      if (!accessToken) {
        console.log('No admin session found, cannot login as admin');
        return null;
      }

      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: {
          action: 'admin-login',
          client_id: clientId,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.session) return null;

      const clientSession: ClientSession = data.session;
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
    loginAsAdmin,
    logout,
  };
};
