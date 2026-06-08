import { ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Shield, Building2, User, LayoutDashboard, Users, Phone, BarChart3, Settings,
  CreditCard, FileText, Headphones, Voicemail, Download, MessageSquare, Database,
  Server, Activity,
} from "lucide-react";

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };

function Shell({ title, badge, accent, items }: {
  title: string;
  badge: string;
  accent: string;
  items: NavItem[];
}) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-60 border-r bg-card/40 flex flex-col">
        <div className="h-14 px-4 flex items-center gap-2 border-b">
          <div className={`w-2 h-2 rounded-full ${accent}`} />
          <div>
            <div className="text-sm font-semibold leading-tight">{title}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{badge}</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <it.icon className="h-4 w-4" />
                <span>{it.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export function PlatformAdminShell({ children }: { children?: ReactNode }) {
  return (
    <Shell
      title="AVA · Lemtel"
      badge="Platform Admin"
      accent="bg-red-500"
      items={[
        { label: "Overview", to: "/platform", icon: LayoutDashboard },
        { label: "Organizations", to: "/platform/organizations", icon: Building2 },
        { label: "All Users", to: "/platform/users", icon: Users },
        { label: "All Calls", to: "/platform/calls", icon: Phone },
        { label: "Telephony Core", to: "/platform/telephony", icon: Server },
        { label: "Billing", to: "/platform/billing", icon: CreditCard },
        { label: "System Health", to: "/platform/system", icon: Activity },
        { label: "Audit Logs", to: "/platform/audit", icon: FileText },
        { label: "Settings", to: "/platform/settings", icon: Settings },
      ]}
    />
  );
}

export function CustomerAdminShell({ children }: { children?: ReactNode }) {
  return (
    <Shell
      title="Workspace Admin"
      badge="Customer Admin"
      accent="bg-blue-500"
      items={[
        { label: "Dashboard", to: "/customer", icon: LayoutDashboard },
        { label: "Team", to: "/customer/team", icon: Users },
        { label: "Extensions", to: "/customer/extensions", icon: Phone },
        { label: "Queues", to: "/customer/queues", icon: Headphones },
        { label: "IVR", to: "/customer/ivr", icon: Server },
        { label: "Numbers", to: "/customer/numbers", icon: Phone },
        { label: "Calls & Recordings", to: "/customer/calls", icon: FileText },
        { label: "Analytics", to: "/customer/analytics", icon: BarChart3 },
        { label: "Knowledge Base", to: "/customer/knowledge", icon: Database },
        { label: "Billing", to: "/customer/billing", icon: CreditCard },
        { label: "Settings", to: "/customer/settings", icon: Settings },
      ]}
    />
  );
}

export function MyWorkspaceShell({ children }: { children?: ReactNode }) {
  return (
    <Shell
      title="My Workspace"
      badge="User"
      accent="bg-emerald-500"
      items={[
        { label: "Home", to: "/my", icon: LayoutDashboard },
        { label: "Softphone", to: "/my/softphone", icon: Phone },
        { label: "My Calls", to: "/my/calls", icon: FileText },
        { label: "Voicemail", to: "/my/voicemail", icon: Voicemail },
        { label: "Messages", to: "/my/messages", icon: MessageSquare },
        { label: "Recordings", to: "/my/recordings", icon: Headphones },
        { label: "Downloads", to: "/my/downloads", icon: Download },
        { label: "Profile", to: "/my/profile", icon: User },
        { label: "Settings", to: "/my/settings", icon: Settings },
      ]}
    />
  );
}

export function PortalRoleBadge({ role }: { role: "platform" | "customer" | "my" }) {
  const map = {
    platform: { icon: Shield, label: "Platform Admin", color: "text-red-500" },
    customer: { icon: Building2, label: "Customer Admin", color: "text-blue-500" },
    my: { icon: User, label: "My Workspace", color: "text-emerald-500" },
  } as const;
  const { icon: Icon, label, color } = map[role];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}
