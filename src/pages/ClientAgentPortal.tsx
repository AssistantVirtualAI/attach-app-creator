import { useEffect } from 'react';
import { useNavigate, Outlet, useParams, Link, useLocation } from 'react-router-dom';
import { ClientProvider, useClient } from '@/context/ClientContext';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { AgentSelector } from '@/components/client-portal/AgentSelector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LogOut, 
  LayoutDashboard, 
  MessageSquare, 
  BarChart3, 
  BookOpen, 
  Settings,
  Bot,
  Crown,
  Eye,
  ChevronLeft
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const ClientAgentPortalContent = () => {
  const { isAuthenticated, isLoading: authLoading, session, logout } = useClient();
  const { clientId, agentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { hasAccess, role, agentName, isLoading: accessLoading } = useClientAgentAccess(clientId, agentId);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/client/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!accessLoading && !hasAccess && clientId && agentId) {
      navigate(`/client/${clientId}/conversations`);
    }
  }, [hasAccess, accessLoading, clientId, agentId, navigate]);

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !hasAccess) {
    return null;
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: `/client/${clientId}/agent/${agentId}/dashboard` },
    { icon: MessageSquare, label: 'Conversations', href: `/client/${clientId}/agent/${agentId}/conversations` },
    { icon: BarChart3, label: 'Analytics', href: `/client/${clientId}/agent/${agentId}/analytics` },
    { icon: BookOpen, label: 'Base de connaissances', href: `/client/${clientId}/agent/${agentId}/knowledge` },
    { icon: Settings, label: 'Configuration', href: `/client/${clientId}/agent/${agentId}/settings` },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-semibold truncate">{agentName || 'Agent'}</span>
          </div>
          <Badge 
            variant={role === 'admin' ? 'default' : 'secondary'}
            className="flex items-center gap-1 w-fit"
          >
            {role === 'admin' ? (
              <>
                <Crown className="h-3 w-3" />
                Administrateur
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Lecture seule
              </>
            )}
          </Badge>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 p-4">
          <nav className="space-y-1 mb-6">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Agent Selector */}
          <AgentSelector />
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <Link to={`/client/${clientId}/conversations`}>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <ChevronLeft className="h-4 w-4" />
              Retour au portail
            </Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const ClientAgentPortal = () => {
  return (
    <ClientProvider>
      <ClientAgentPortalContent />
    </ClientProvider>
  );
};

export default ClientAgentPortal;
