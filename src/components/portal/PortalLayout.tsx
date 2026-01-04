import { useEffect } from 'react';
import { useNavigate, Outlet, useParams, Link, useLocation } from 'react-router-dom';
import { usePortal, PortalProvider } from '@/hooks/usePortalAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  FileCode,
  Sparkles
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const PortalLayoutContent = () => {
  const { isAuthenticated, isLoading, session, logout, hasEditAccess } = usePortal();
  const { agentSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(`/portal/${agentSlug}`);
    }
  }, [isAuthenticated, isLoading, navigate, agentSlug]);

  useEffect(() => {
    // Verify the session matches the current agent slug
    if (!isLoading && session && session.agentSlug !== agentSlug) {
      logout();
      navigate(`/portal/${agentSlug}`);
    }
  }, [session, agentSlug, isLoading, logout, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !session) {
    return null;
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: `/portal/${agentSlug}/dashboard` },
    { icon: MessageSquare, label: 'Conversations', href: `/portal/${agentSlug}/conversations` },
    { icon: BarChart3, label: 'Analytics', href: `/portal/${agentSlug}/analytics` },
    { icon: BookOpen, label: 'Base de connaissances', href: `/portal/${agentSlug}/knowledge` },
    { icon: FileCode, label: 'Prompt & Endpoints', href: `/portal/${agentSlug}/prompt` },
  ];

  // Add settings for admin only
  if (hasEditAccess()) {
    navItems.push({ icon: Settings, label: 'Configuration', href: `/portal/${agentSlug}/settings` });
  }

  const handleLogout = () => {
    logout();
    navigate(`/portal/${agentSlug}`);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-64 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold truncate block">{session.agentName}</span>
              <span className="text-xs text-muted-foreground">Portail Client</span>
            </div>
          </div>
          <Badge 
            variant={session.role === 'admin' ? 'default' : 'secondary'}
            className="flex items-center gap-1 w-fit"
          >
            {session.role === 'admin' ? (
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
        <ScrollArea className="flex-1 p-3">
          <nav className="space-y-1">
            {navItems.map((item, index) => {
              const isActive = location.pathname === item.href;
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={item.href}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={`w-full justify-start gap-3 h-10 ${
                        isActive ? 'bg-primary/10 text-primary border-l-2 border-primary' : ''
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span className="truncate">{session.clientName}</span>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" 
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="container mx-auto p-6"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
};

const PortalLayout = () => (
  <PortalProvider>
    <PortalLayoutContent />
  </PortalProvider>
);

export default PortalLayout;
