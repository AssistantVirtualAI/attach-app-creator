import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Super admin emails that can access portals without credentials
const SUPER_ADMIN_EMAILS = [
  'mhassoun@assistantvirtualai.com',
  'amassaro@assistantvirtualai.com',
];

export interface PortalSession {
  clientId: string;
  clientName: string;
  organizationId: string;
  agentId: string;
  agentName: string;
  agentSlug: string;
  platformAgentId?: string;
  platformApiKey?: string;
  role: 'viewer' | 'admin' | 'super_admin';
  canEditKnowledge: boolean;
  canEditPrompt: boolean;
  theme: string;
  language: string;
  isSuperAdmin?: boolean;
}

const PORTAL_SESSION_KEY = 'ava_portal_session';

export const usePortalAuth = () => {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // undefined = still checking, null = not logged in, user = logged in
  const [supabaseUser, setSupabaseUser] = useState<any | undefined>(undefined);

  // Check Supabase auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSupabaseUser(user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Check if current Supabase user is a super admin
  const isSuperAdmin = useCallback(() => {
    return supabaseUser?.email && SUPER_ADMIN_EMAILS.includes(supabaseUser.email);
  }, [supabaseUser]);

  // Auto-login for super admins
  const loginAsSuperAdmin = useCallback(async (agentSlug: string): Promise<PortalSession | null> => {
    if (!supabaseUser?.email || !SUPER_ADMIN_EMAILS.includes(supabaseUser.email)) {
      return null;
    }

    try {
      // Fetch agent details
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, name, organization_id, platform_agent_id, platform_api_key, platform, slug')
        .eq('slug', agentSlug)
        .single();

      if (agentError || !agent) {
        console.error('Agent not found:', agentError);
        return null;
      }

      // Fetch API key from organization_integrations if not on agent
      let platformApiKey: string | null = agent.platform_api_key || null;
      if (!platformApiKey && agent.organization_id && agent.platform) {
        const { data: integration } = await supabase
          .from('organization_integrations')
          .select('api_key')
          .eq('organization_id', agent.organization_id)
          .eq('platform', agent.platform)
          .eq('is_active', true)
          .maybeSingle();
        
        platformApiKey = integration?.api_key || null;
      }

      const portalSession: PortalSession = {
        clientId: 'super-admin',
        clientName: 'Super Admin',
        organizationId: agent.organization_id,
        agentId: agent.id,
        agentName: agent.name,
        agentSlug: agent.slug || agentSlug,
        platformAgentId: agent.platform_agent_id || undefined,
        platformApiKey: platformApiKey || undefined,
        role: 'super_admin',
        canEditKnowledge: true,
        canEditPrompt: true,
        theme: 'dark',
        language: 'fr',
        isSuperAdmin: true,
      };

      localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(portalSession));
      setSession(portalSession);
      return portalSession;
    } catch (error) {
      console.error('Super admin login error:', error);
      return null;
    }
  }, [supabaseUser]);

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

      const portalSession: PortalSession = {
        ...data.session,
        isSuperAdmin: false,
      };
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
    loginAsSuperAdmin,
    logout,
    isSuperAdmin,
    supabaseUser,
    hasEditAccess: () => session?.role === 'admin' || session?.role === 'super_admin',
    canEditKnowledge: () => session?.canEditKnowledge === true,
    canEditPrompt: () => session?.canEditPrompt === true,
  };
};

interface PortalContextType {
  session: PortalSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (agentSlug: string, loginId: string, password: string) => Promise<PortalSession>;
  loginAsSuperAdmin: (agentSlug: string) => Promise<PortalSession | null>;
  logout: () => void;
  isSuperAdmin: () => boolean;
  supabaseUser: any;
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
