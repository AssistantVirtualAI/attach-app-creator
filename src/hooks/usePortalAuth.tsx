import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PortalSession {
  clientId: string;
  clientName: string;
  organizationId: string;
  agentId: string;
  agentName: string;
  agentSlug: string;
  role: 'viewer' | 'admin';
  canEditKnowledge: boolean;
  canEditPrompt: boolean;
  theme: string;
  language: string;
}

const PORTAL_SESSION_KEY = 'ava_portal_session';

export const usePortalAuth = () => {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedSession = localStorage.getItem(PORTAL_SESSION_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setSession(parsed);
      } catch {
        localStorage.removeItem(PORTAL_SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (agentSlug: string, loginId: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: { 
          action: 'login-by-agent-slug', 
          agent_slug: agentSlug,
          login_id: loginId,
          password
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.session) throw new Error('Erreur de connexion');

      const portalSession: PortalSession = data.session;
      localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(portalSession));
      setSession(portalSession);
      return portalSession;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(PORTAL_SESSION_KEY);
    setSession(null);
  }, []);

  return {
    session,
    isLoading,
    isAuthenticated: !!session,
    login,
    logout,
    hasEditAccess: () => session?.role === 'admin',
    canEditKnowledge: () => session?.canEditKnowledge === true,
    canEditPrompt: () => session?.canEditPrompt === true,
  };
};

interface PortalContextType {
  session: PortalSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (agentSlug: string, loginId: string, password: string) => Promise<PortalSession>;
  logout: () => void;
  hasEditAccess: () => boolean;
  canEditKnowledge: () => boolean;
  canEditPrompt: () => boolean;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = usePortalAuth();
  return <PortalContext.Provider value={auth}>{children}</PortalContext.Provider>;
};

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) throw new Error('usePortal must be used within a PortalProvider');
  return context;
};
