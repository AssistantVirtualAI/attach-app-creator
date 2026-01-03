import { 
  Home, TrendingUp, MessageSquare, BarChart3, BookOpen, 
  Bot, Sparkles, FileQuestion, Users, UserPlus, Calendar,
  Phone, MessageCircle, GitBranch, Sliders, Webhook,
  CreditCard, Settings, Tag, Headphones, LayoutDashboard, Radio
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  adminOnly?: boolean;
}

export const sidebarGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'Vue d\'ensemble',
    icon: LayoutDashboard,
    items: [
      { name: 'Maison', href: '/', icon: Home },
      { name: 'Dashboard', href: '/dashboard', icon: TrendingUp },
    ]
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: MessageSquare,
    items: [
      { name: 'Temps Réel', href: '/realtime', icon: Radio },
      { name: 'Conversations', href: '/conversations', icon: MessageSquare },
      { name: 'Voice Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Handoffs', href: '/handoffs', icon: Headphones },
      { name: 'Topics', href: '/topics', icon: Tag },
    ]
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    adminOnly: true,
    items: [
      { name: 'Agents', href: '/agents', icon: Bot },
      { name: 'Agent Builder', href: '/agent-builder', icon: Sparkles },
      { name: 'Rapports Agents', href: '/agent-reports', icon: FileQuestion },
      { name: 'Base de connaissances', href: '/knowledge-base', icon: BookOpen },
    ]
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    adminOnly: true,
    items: [
      { name: 'Clientèle', href: '/clients', icon: Users },
      { name: 'Leads', href: '/leads', icon: UserPlus },
      { name: 'Rendez-vous', href: '/appointments', icon: Calendar },
    ]
  },
  {
    id: 'campaigns',
    label: 'Campagnes',
    icon: Phone,
    adminOnly: true,
    items: [
      { name: 'Campagnes', href: '/campaigns', icon: Phone },
      { name: 'Numéros', href: '/phone-numbers', icon: Phone },
      { name: 'Templates SMS', href: '/sms-templates', icon: MessageCircle },
    ]
  },
  {
    id: 'config',
    label: 'Configuration',
    icon: Sliders,
    adminOnly: true,
    items: [
      { name: 'Workflows', href: '/workflows', icon: GitBranch },
      { name: 'Intégrations', href: '/integrations', icon: Sliders },
      { name: 'Journaux Webhook', href: '/webhook-logs', icon: Webhook },
    ]
  },
  {
    id: 'billing',
    label: 'Facturation',
    icon: CreditCard,
    adminOnly: true,
    items: [
      { name: 'Facturation Stripe', href: '/stripe-billing', icon: CreditCard },
      { name: 'Config SaaS', href: '/saas-config', icon: Settings },
    ]
  },
];

export const settingsLink: NavItem = {
  name: 'Paramètres',
  href: '/settings',
  icon: Settings,
};
