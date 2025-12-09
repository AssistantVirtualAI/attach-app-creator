import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavGroup } from './sidebarConfig';

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
      <CollapsibleTrigger className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg transition-all duration-200 ${
        isActiveGroup 
          ? 'bg-primary/10 text-primary' 
          : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'
      }`}>
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" />
          <span className="font-medium text-sm">{group.label}</span>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pl-4 mt-1 space-y-1">
        {group.items.map((item) => {
          const ItemIcon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-neon'
                  : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'
              }`}
            >
              <ItemIcon className="w-4 h-4" />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};
