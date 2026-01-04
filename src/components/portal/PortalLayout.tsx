import { useEffect } from 'react';
import { useNavigate, Outlet, useParams, Link, useLocation } from 'react-router-dom';
import { usePortal, PortalProvider } from '@/hooks/usePortalAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LogOut, 
  LayoutDashboard, 
  MessageSquare, 
  BarChart3, 
  BookOpen, 
  Settings,
  FileCode,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AvaLogo } from '@/components/portal/AvaLogo';
import { GlowBadge } from '@/components/portal/GlowBadge';

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
    if (!isLoading && session && session.agentSlug !== agentSlug) {
      logout();
      navigate(`/portal/${agentSlug}`);
    }
  }, [session, agentSlug, isLoading, logout, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-8 w-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated || !session) {
    return null;
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: `/portal/${agentSlug}/dashboard`, color: 'text-blue-400' },
    { icon: MessageSquare, label: 'Conversations', href: `/portal/${agentSlug}/conversations`, color: 'text-cyan-400' },
    { icon: BarChart3, label: 'Analytics', href: `/portal/${agentSlug}/analytics`, color: 'text-purple-400' },
    { icon: BookOpen, label: 'Base de connaissances', href: `/portal/${agentSlug}/knowledge`, color: 'text-green-400' },
    { icon: FileCode, label: 'Prompt & Endpoints', href: `/portal/${agentSlug}/prompt`, color: 'text-orange-400' },
  ];

  if (hasEditAccess()) {
    navItems.push({ icon: Settings, label: 'Configuration', href: `/portal/${agentSlug}/settings`, color: 'text-pink-400' });
  }

  const handleLogout = () => {
    logout();
    navigate(`/portal/${agentSlug}`);
  };

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="relative w-72 border-r border-border/50 bg-card/80 backdrop-blur-xl flex flex-col z-10"
      >
        {/* Header with AVA Logo */}
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <AvaLogo size="sm" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-lg bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                AVA Statistics
              </span>
              <span className="text-xs text-muted-foreground block mt-0.5">Portail Client</span>
            </div>
          </div>
          
          {/* Agent info */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <p className="font-medium truncate text-sm">{session.agentName}</p>
            <div className="mt-2">
              <GlowBadge 
                variant={session.role === 'admin' ? 'admin' : 'viewer'}
              >
                {session.role === 'admin' ? 'Administrateur' : 'Lecture seule'}
              </GlowBadge>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 p-4">
          <nav className="space-y-1.5">
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
                      variant="ghost"
                      className={`w-full justify-start gap-3 h-11 transition-all duration-200 ${
                        isActive 
                          ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]' 
                          : 'hover:bg-muted/50 hover:translate-x-1'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : item.color}`} />
                      <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">
                {session.clientName?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm truncate flex-1">{session.clientName}</span>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 h-10" 
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="container mx-auto p-6 max-w-7xl"
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
