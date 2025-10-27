import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Home, TrendingUp, MessageSquare, BookOpen, Settings, Bot, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { OrganizationSelector } from '@/components/organization/OrganizationSelector';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { signOut } = useAuth();
  const { selectedOrg, userRole } = useOrganization();
  const { role, isSuperAdmin } = usePermissions();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Analytics', href: '/analytics', icon: TrendingUp },
    { name: 'Conversations', href: '/conversations', icon: MessageSquare },
    { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen },
    { name: 'Agent Config', href: '/agent-config', icon: Bot },
    { name: 'Paramètres', href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] cyber-grid">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 glass-card border-r border-border/50 z-50">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border/50">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-neon">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold gradient-text">AVA Statistics</h1>
            </Link>
          </div>

          {/* Organization Selector */}
          <div className="border-b border-border/50 pb-4">
            <OrganizationSelector />
            {role && (
              <div className="px-4 mt-2">
                <Badge variant="outline" className="text-xs">
                  {isSuperAdmin ? '👑 Super Admin' : 
                   role === 'org_admin' ? '🔑 Admin' :
                   role === 'manager' ? '👨‍💼 Manager' :
                   role === 'agent' ? '👤 Agent' : '👁️ Viewer'}
                </Badge>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary/20 text-primary border border-primary/30 shadow-neon'
                      : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-border/50">
            <Button
              onClick={() => signOut()}
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-5 h-5" />
              <span>Déconnexion</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
};