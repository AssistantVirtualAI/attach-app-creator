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
  const isActiveGroup = group.items.some(item => location.pathname === item.href);
  
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
      <CollapsibleTrigger className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-300 ${
        isActiveGroup 
          ? 'bg-primary/15 text-foreground border border-primary/30' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg transition-all duration-300 ${
            isActiveGroup 
              ? 'bg-primary/20 shadow-sm' 
              : 'bg-muted'
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm">{t(group.labelKey)}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </CollapsibleTrigger>
      
      <AnimatePresence>
        {isOpen && (
          <CollapsibleContent className="pl-4 mt-1 space-y-1 overflow-hidden">
            {group.items.map((item, index) => {
              const ItemIcon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 border-l-2 ml-2 ${
                      isActive
                        ? 'bg-primary/15 text-foreground font-medium shadow-sm border-l-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted hover:translate-x-1 border-l-border'
                    }`}
                  >
                    <ItemIcon className="w-4 h-4" />
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