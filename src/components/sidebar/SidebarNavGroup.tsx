import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavGroup } from './sidebarConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { useOrganization } from '@/context/OrganizationContext';

interface SidebarNavGroupProps {
  group: NavGroup;
  onNavigate?: () => void;
}

const STORAGE_KEY = 'sidebar-collapsed-groups';

const getCollapsedGroups = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setCollapsedGroups = (groups: string[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
};

export const SidebarNavGroup = ({ group, onNavigate }: SidebarNavGroupProps) => {
  const location = useLocation();
  const { t } = useTranslation();
  const { isSuperAdmin, organizationMemberships } = useOrganization();
  const isLemtelMember = isSuperAdmin || organizationMemberships.some(m => m.organization.id === '71755d33-ed64-4ad5-a828-61c9d2029eb7');
  const visibleItems = useMemo(() => group.items.filter(item => !(item.hideForLemtel && isLemtelMember)), [group.items, isLemtelMember]);
  const isActiveGroup = visibleItems.some(item => location.pathname === item.href);
  
  const [isOpen, setIsOpen] = useState(() => {
    if (isActiveGroup) return true;
    const collapsed = getCollapsedGroups();
    return !collapsed.includes(group.id);
  });

  useEffect(() => {
    if (isActiveGroup && !isOpen) {
      setIsOpen(true);
    }
  }, [isActiveGroup, location.pathname]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    const collapsed = getCollapsedGroups();
    if (open) {
      setCollapsedGroups(collapsed.filter(id => id !== group.id));
    } else {
      setCollapsedGroups([...collapsed, group.id]);
    }
  };

  const Icon = group.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className={`group flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all duration-200 ${
        isActiveGroup
          ? 'bg-cockpit-surface-strong/70 text-foreground border border-cockpit-cyan/30'
          : 'text-muted-foreground hover:text-foreground hover:bg-cockpit-surface/50 border border-transparent'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg transition-all duration-200 ${
            isActiveGroup
              ? 'bg-cockpit-cyan/15 text-cockpit-cyan'
              : 'bg-cockpit-surface/60 group-hover:text-cockpit-cyan'
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm tracking-tight">{t(group.labelKey)}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18 }}
        >
          <ChevronDown className="w-4 h-4 opacity-70" />
        </motion.div>
      </CollapsibleTrigger>

      <AnimatePresence>
        {isOpen && (
          <CollapsibleContent className="pl-4 mt-1 space-y-0.5 overflow-hidden">
            {visibleItems.map((item, index) => {
              const ItemIcon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <motion.div
                  key={`${item.href}-${item.nameKey}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.15 }}
                >
                  <Link
                    to={item.href}
                    onClick={onNavigate}
                    className={`relative group/item flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ml-2 ${
                      isActive
                        ? 'bg-cockpit-surface-strong/80 text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-cockpit-surface/40'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-cockpit-cyan shadow-cockpit-glow-cyan" />
                    )}
                    <ItemIcon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-cockpit-cyan' : 'group-hover/item:text-cockpit-cyan'}`} />
                    <span className="text-sm">{t(item.nameKey)}</span>
                  </Link>
                </motion.div>
              );
            })}
          </CollapsibleContent>
        )}
      </AnimatePresence>
    </Collapsible>
  );
};