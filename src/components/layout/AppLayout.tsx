import { ReactNode, useState, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Moon, Sun, Globe, GripVertical } from 'lucide-react';
import { AvaLogo } from '@/components/shared/AvaLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import { SidebarFooter } from '@/components/sidebar/SidebarFooter';
import { SidebarNavGroup } from '@/components/sidebar/SidebarNavGroup';
import { sidebarGroups, settingsLink, NavGroup } from '@/components/sidebar/sidebarConfig';
import { CookieConsentBanner } from '@/components/gdpr/CookieConsentBanner';
import { motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationsBell } from '@/components/notifications/NotificationsBell';
import { OrgSwitcher } from '@/components/layout/OrgSwitcher';
import { useApplyBranding } from '@/hooks/useApplyBranding';

const SIDEBAR_ORDER_KEY = 'sidebar-group-order';

const getSavedOrder = (): string[] | null => {
  try {
    const stored = localStorage.getItem(SIDEBAR_ORDER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const saveOrder = (order: string[]) => {
  localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(order));
};

function SortableNavGroup({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/drag">
      <div
        className="absolute left-0 top-3 p-1 opacity-0 group-hover/drag:opacity-60 cursor-grab active:cursor-grabbing z-10 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <SidebarNavGroup group={group} onNavigate={onNavigate} />
    </div>
  );
}

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { role, isSuperAdmin } = usePermissions();
  const { selectedOrg, selectedOrgId, isLoading, userRole } = useOrganization();
  useApplyBranding(selectedOrgId, 'admin');
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Debug: log sidebar visibility info
  console.log('[Sidebar Debug] Role:', role, 'isSuperAdmin:', isSuperAdmin, 'isLoading:', isLoading, 'userRole:', userRole);

  // Filter groups based on role
  const visibleGroups = useMemo(() => sidebarGroups.filter(group => {
    if (group.superAdminOnly) return !isLoading && isSuperAdmin;
    if (group.adminOnly) {
      if (isLoading) return true;
      return role === 'org_admin' || role === 'manager' || isSuperAdmin;
    }
    return true;
  }), [role, isSuperAdmin, isLoading]);

  // Sidebar group ordering with drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const orderedGroups = useMemo(() => {
    const saved = getSavedOrder();
    if (!saved) return visibleGroups;
    const ordered: typeof visibleGroups = [];
    saved.forEach(id => {
      const g = visibleGroups.find(g => g.id === id);
      if (g) ordered.push(g);
    });
    visibleGroups.forEach(g => {
      if (!ordered.find(o => o.id === g.id)) ordered.push(g);
    });
    return ordered;
  }, [visibleGroups]);

  const [groupOrder, setGroupOrder] = useState(orderedGroups.map(g => g.id));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setGroupOrder(prev => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        const newOrder = arrayMove(prev, oldIndex, newIndex);
        saveOrder(newOrder);
        return newOrder;
      });
    }
  }, []);

  const sortedGroups = useMemo(() => {
    return groupOrder
      .map(id => orderedGroups.find(g => g.id === id))
      .filter(Boolean) as typeof orderedGroups;
  }, [groupOrder, orderedGroups]);

  const isSettingsActive = location.pathname === settingsLink.href;
  const SettingsIcon = settingsLink.icon;

  const getRoleBadge = () => {
    if (isSuperAdmin) return `👑 ${t('roles.superAdmin')}`;
    if (role === 'org_admin') return `🔑 ${t('roles.admin')}`;
    if (role === 'manager') return `👨‍💼 ${t('roles.manager')}`;
    if (role === 'agent') return `👤 ${t('roles.agent')}`;
    return `👁️ ${t('roles.viewer')}`;
  };

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
        <Link to="/" className="ml-3">
          <AvaLogo size="sm" animated={false} showText={false} className="[&_div:first-child]:w-10 [&_div:first-child]:h-10 [&_img]:w-10 [&_img]:h-10" />
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
            <Link to="/" onClick={() => setIsSidebarOpen(false)}>
              <AvaLogo size="lg" animated={true} showText={false} className="[&_div:first-child]:w-16 [&_div:first-child]:h-16 [&_img]:w-16 [&_img]:h-16" />
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-muted transition-colors md:hidden"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Org Switcher + Toolbar */}
          <div className="px-4 py-3 border-b border-sidebar-border space-y-2">
            <OrgSwitcher />
            <div className="flex items-center justify-between gap-2">
              {role && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/40 bg-primary/10 text-foreground font-medium whitespace-nowrap truncate max-w-[120px]">
                  {getRoleBadge()}
                </Badge>
              )}
              <div className="flex items-center gap-0.5 ml-auto">
                <NotificationsBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLanguage('en')} className={language === 'en' ? 'bg-primary/10' : ''}>
                      🇬🇧 English
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLanguage('fr')} className={language === 'fr' ? 'bg-primary/10' : ''}>
                      🇫🇷 Français
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 hover:bg-muted">
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-warning" />
                  ) : (
                    <Moon className="w-4 h-4 text-primary" />
                  )}
                </Button>
              </div>
            </div>
          </div>


          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
                {sortedGroups.map((group) => (
                  <SortableNavGroup
                    key={group.id}
                    group={group}
                    onNavigate={() => setIsSidebarOpen(false)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            
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
              <span className="font-medium text-sm">{t(settingsLink.nameKey)}</span>
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