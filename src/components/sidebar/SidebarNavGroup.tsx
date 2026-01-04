import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavGroup } from './sidebarConfig';
import { motion, AnimatePresence } from 'framer-motion';

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
          ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300' 
          : 'text-slate-400 hover:text-purple-300 hover:bg-purple-500/10'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg transition-all duration-300 ${
            isActiveGroup 
              ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 shadow-[0_0_10px_rgba(139,92,246,0.3)]' 
              : 'bg-slate-800/50'
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm">{group.label}</span>
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
                        ? 'bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 text-white font-medium shadow-[0_0_15px_rgba(139,92,246,0.25)] border-l-purple-500'
                        : 'text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 hover:translate-x-1 border-l-purple-500/20'
                    }`}
                  >
                    <ItemIcon className="w-4 h-4" />
                    <span className="text-sm">{item.name}</span>
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
