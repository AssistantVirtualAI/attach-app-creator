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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      {/* Mobile Header with Hamburger */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-gradient-to-r from-slate-900/95 via-purple-950/80 to-slate-900/95 backdrop-blur-xl border-b border-purple-500/20 z-40 flex items-center px-4 md:hidden">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
        >
          <Menu className="w-6 h-6 text-purple-300" />
        </button>
        <Link to="/" className="flex items-center gap-2 ml-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-lg blur-sm opacity-60" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">AVA Statistics</span>
        </Link>
      </header>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-72 bg-gradient-to-b from-slate-900 via-purple-950/30 to-slate-900 backdrop-blur-xl border-r border-purple-500/20 z-50 transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo - AVA Statistics */}
          <div className="p-6 border-b border-purple-500/20 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl blur-lg opacity-60"
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
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </motion.div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">AVA Statistics</h1>
                <span className="text-xs text-purple-300/60">Analytics Platform</span>
              </div>
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors md:hidden"
            >
              <X className="w-5 h-5 text-purple-300" />
            </button>
          </div>

          {/* Role Badge & Theme Toggle */}
          <div className="px-4 py-3 border-b border-purple-500/20 flex items-center justify-between">
            {role && (
              <Badge variant="outline" className="text-xs border-purple-500/30 bg-purple-500/10 text-purple-300">
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
              className="h-8 w-8 hover:bg-purple-500/20"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-yellow-400" />
              ) : (
                <Moon className="w-4 h-4 text-purple-400" />
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
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                  : 'text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 hover:translate-x-1'
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