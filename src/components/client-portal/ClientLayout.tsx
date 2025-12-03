import { ReactNode } from 'react';
import { useClient } from '@/context/ClientContext';
import { Button } from '@/components/ui/button';
import { LogOut, MessageSquare, BarChart3, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface ClientLayoutProps {
  children: ReactNode;
}

export const ClientLayout = ({ children }: ClientLayoutProps) => {
  const { session, logout } = useClient();
  const location = useLocation();

  if (!session) return null;

  const navItems = [
    { icon: MessageSquare, label: 'Conversations', href: `/client/${session.clientId}/conversations` },
    { icon: BarChart3, label: 'Analytics', href: `/client/${session.clientId}/analytics` },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-foreground">{session.clientName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.href} to={item.href}>
                <Button
                  variant={location.pathname === item.href ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};
