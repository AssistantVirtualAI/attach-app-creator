import { Sparkles, Users, Zap, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useClientStats } from '@/hooks/useClientStats';
import { useAICredits } from '@/hooks/useAICredits';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { UserAvatar } from './UserAvatar';

export const SidebarFooter = () => {
  const { activeClients, clientLimit } = useClientStats();
  const { credits } = useAICredits();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="px-3 py-3 border-t border-sidebar-border space-y-2 bg-sidebar/60 backdrop-blur-sm">
      {/* Compact stats row: Clients · Credits */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/50 border border-border/50">
          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {activeClients}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              /{clientLimit}
            </span>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground tabular-nums truncate">
            {credits}
          </span>
        </div>
      </div>

      {/* Slim Upgrade pill + actions */}
      <div className="flex items-center gap-2">
        <Link
          to="/billing?tab=plans"
          className="flex-1 group flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs font-semibold shadow-sm hover:shadow-md hover:opacity-95 transition-all"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{t('sidebar.upgradePlan') || 'Upgrade'}</span>
        </Link>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-md bg-muted/50 hover:bg-primary/10 flex items-center justify-center transition-colors border border-border/50"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-warning" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-primary" />
          )}
        </button>
        <UserAvatar />
      </div>
    </div>
  );
};
