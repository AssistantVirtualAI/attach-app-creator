import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Menu, X, Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from '@/context/ThemeContext';
import { SidebarFooter } from '@/components/sidebar/SidebarFooter';
import { SidebarNavGroup } from '@/components/sidebar/SidebarNavGroup';
import { sidebarGroups, settingsLink } from '@/components/sidebar/sidebarConfig';
import { CookieConsentBanner } from '@/components/gdpr/CookieConsentBanner';
import { motion } from 'framer-motion';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { role, isSuperAdmin } = usePermissions();
  const { selectedOrg, isLoading, userRole } = useOrganization();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Debug: log sidebar visibility info
  console.log('[Sidebar Debug] Role:', role, 'isSuperAdmin:', isSuperAdmin, 'isLoading:', isLoading, 'userRole:', userRole);

  // Filter groups based on role - show adminOnly groups for admins and managers
  // During loading, show all groups to prevent flash of missing items
  const visibleGroups = sidebarGroups.filter(group => {
    if (group.adminOnly) {
      // During loading, show adminOnly groups (they'll be hidden if user doesn't have access after load)
      if (isLoading) return true;
      // Show adminOnly groups only for org_admin, manager, super_admin
      const isVisible = role === 'org_admin' || role === 'manager' || isSuperAdmin;
      console.log(`[Sidebar Debug] Group "${group.label}" adminOnly=${group.adminOnly}, visible=${isVisible}`);
      return isVisible;
    }
    return true;
  });

  const isSettingsActive = location.pathname === settingsLink.href;
  const SettingsIcon = settingsLink.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header with Hamburger */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur-xl border-b border-border z-40 flex items-center px-4 md:hidden">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Menu className="w-6 h-6 text-foreground" />
        </button>
        <Link to="/" className="flex items-center gap-2 ml-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent rounded-lg blur-sm opacity-60" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <span className="font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">AVA Statistics</span>
        </Link>
      </header>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-72 bg-sidebar backdrop-blur-xl border-r border-sidebar-border z-50 transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo - AVA Statistics */}
          <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent rounded-xl blur-lg opacity-60"
                  animate={{ 
                    opacity: [0.4, 0.7, 0.4],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-xl">
                  <BarChart3 className="w-6 h-6 text-primary-foreground" />
                </div>
              </motion.div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">AVA Statistics</h1>
                <span className="text-xs text-muted-foreground">Analytics Platform</span>
              </div>
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-muted transition-colors md:hidden"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Role Badge & Theme Toggle */}
          <div className="px-4 py-3 border-b border-sidebar-border flex items-center justify-between">
            {role && (
              <Badge variant="outline" className="text-xs border-primary/40 bg-primary/10 text-foreground font-medium">
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
              className="h-8 w-8 hover:bg-muted"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-warning" />
              ) : (
                <Moon className="w-4 h-4 text-primary" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {visibleGroups.map((group) => (
              <SidebarNavGroup
                key={group.id}
                group={group}
                onNavigate={() => setIsSidebarOpen(false)}
              />
            ))}
            
            {/* Settings link - always visible */}
            <Link
              to={settingsLink.href}
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mt-4 ${
                isSettingsActive
                  ? 'bg-primary/15 text-foreground shadow-md border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted hover:translate-x-1'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="font-medium text-sm">{settingsLink.name}</span>
            </Link>
          </nav>

          {/* Footer */}
          <SidebarFooter />
        </div>
      </aside>

      {/* Main content */}
      <main className="pt-14 md:pt-0 md:ml-72 min-h-screen">
        <div className="p-4 lg:p-6">
          {children}
        </div>
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