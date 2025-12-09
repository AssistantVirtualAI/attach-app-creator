import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Home, TrendingUp, MessageSquare, BookOpen, Settings, Bot, Webhook, CreditCard, Sliders, Moon, Sun, Users, BarChart3, GitBranch, Menu, X, Tag, Phone, Calendar, FileQuestion, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from '@/context/ThemeContext';
import { SidebarFooter } from '@/components/sidebar/SidebarFooter';
import { CookieConsentBanner } from '@/components/gdpr/CookieConsentBanner';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { role, isSuperAdmin, isRole } = usePermissions();
  const { selectedOrg } = useOrganization();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Base navigation for all users
  const baseNavigation = [
    { name: 'Maison', href: '/', icon: Home },
    { name: 'Dashboard', href: '/dashboard', icon: TrendingUp },
    { name: 'Conversations', href: '/conversations', icon: MessageSquare },
    { name: 'Voice Analytics', href: '/voice-analytics', icon: BarChart3 },
    { name: 'Base de connaissances', href: '/knowledge-base', icon: BookOpen },
  ];

  // Admin-only navigation
  const adminNavigation = [
    { name: 'Clientèle', href: '/clients', icon: Users },
    { name: 'Agents', href: '/agents', icon: Bot },
    { name: 'Agent Builder', href: '/agent-builder', icon: Sparkles },
    { name: 'Topics', href: '/topics', icon: Tag },
    { name: 'Campagnes', href: '/campaigns', icon: Phone },
    { name: 'Rendez-vous', href: '/appointments', icon: Calendar },
    { name: 'Rapports Agents', href: '/agent-reports', icon: FileQuestion },
    { name: 'Workflows', href: '/workflows', icon: GitBranch },
    { name: 'Intégrations', href: '/integrations', icon: Sliders },
    { name: 'Journaux Webhook', href: '/webhook-logs', icon: Webhook },
    { name: 'Facturation Stripe', href: '/stripe-billing', icon: CreditCard },
    { name: 'Config SaaS', href: '/saas-config', icon: Settings },
  ];

  // Settings available for all
  const settingsNavigation = [
    { name: 'Paramètres', href: '/settings', icon: Settings },
  ];

  // Combine navigation based on role
  const navigation = [
    ...baseNavigation,
    ...(!isRole('agent') ? adminNavigation : []),
    ...settingsNavigation,
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] cyber-grid">
      {/* Mobile Header with Hamburger */}
      <header className="fixed top-0 left-0 right-0 h-14 glass-card border-b border-border/50 z-40 flex items-center px-4 md:hidden">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-card/50 transition-colors"
        >
          <Menu className="w-6 h-6 text-foreground" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold gradient-text">AVA Dashboard</span>
        </div>
      </header>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-64 glass-card border-r border-border/50 z-50 transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border/50 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-neon">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold gradient-text">AVA Dashboard</h1>
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-card/50 transition-colors md:hidden"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Role Badge & Theme Toggle */}
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            {role && (
              <Badge variant="outline" className="text-xs">
                {isSuperAdmin ? '👑 Super Admin' : 
                 role === 'org_admin' ? '🔑 Admin' :
                 role === 'manager' ? '👨‍💼 Manager' :
                 role === 'agent' ? '👤 Agent' : '👁️ Viewer'}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsSidebarOpen(false)}
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

          {/* Footer */}
          <SidebarFooter />
        </div>
      </aside>

      {/* Main content */}
      <main className="pt-14 md:pt-0 md:ml-64 min-h-screen">
        {children}
      </main>

      {/* Cookie Consent Banner */}
      {selectedOrg?.gdpr_enabled && (
        <CookieConsentBanner 
          organizationId={selectedOrg.id} 
          gdprEnabled={selectedOrg.gdpr_enabled} 
        />
      )}
    </div>
  );
};