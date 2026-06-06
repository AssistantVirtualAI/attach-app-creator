import { 
  Home, TrendingUp, MessageSquare, BarChart3, BookOpen, 
  Bot, Sparkles, FileQuestion, Users, UserPlus, Calendar,
  Phone, MessageCircle, GitBranch, Sliders, Webhook,
  CreditCard, Settings, Tag, Headphones, LayoutDashboard, Radio, Globe,
  Shield, Building2, PhoneCall, Voicemail, Smartphone, Disc, Bell, Brain, Router, Activity, CheckSquare
} from 'lucide-react';

export interface NavItem {
  nameKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hideForLemtel?: boolean;
}

export interface NavGroup {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  lemtelOnly?: boolean;
  lemtelCustomerOnly?: boolean;
  hideForLemtel?: boolean;
}

export const sidebarGroups: NavGroup[] = [
  {
    id: 'overview',
    labelKey: 'sidebar.groups.overview',
    icon: LayoutDashboard,
    items: [
      { nameKey: 'sidebar.home', href: '/', icon: Home },
      { nameKey: 'sidebar.dashboard', href: '/dashboard', icon: TrendingUp },
    ]
  },
  {
    id: 'conversations',
    labelKey: 'sidebar.groups.conversations',
    icon: MessageSquare,
    items: [
      { nameKey: 'sidebar.realtime', href: '/realtime', icon: Radio },
      { nameKey: 'sidebar.conversationsList', href: '/conversations', icon: MessageSquare },
      { nameKey: 'sidebar.voiceAnalytics', href: '/analytics', icon: BarChart3 },
      { nameKey: 'sidebar.handoffs', href: '/handoffs', icon: Headphones },
      { nameKey: 'sidebar.topics', href: '/topics', icon: Tag },
    ]
  },
  {
    id: 'agents',
    labelKey: 'sidebar.groups.agents',
    icon: Bot,
    adminOnly: true,
    items: [
      { nameKey: 'sidebar.agentsList', href: '/agents', icon: Bot },
      { nameKey: 'sidebar.agentBuilder', href: '/agent-builder', icon: Sparkles },
      { nameKey: 'sidebar.comparison', href: '/agent-comparison', icon: BarChart3 },
      { nameKey: 'sidebar.agentReports', href: '/agent-reports', icon: FileQuestion },
      { nameKey: 'sidebar.knowledgeBase', href: '/knowledge-base', icon: BookOpen },
      { nameKey: 'sidebar.clients', href: '/clients', icon: Users },
    ]
  },
  {
    id: 'crm',
    labelKey: 'sidebar.groups.crm',
    icon: Users,
    adminOnly: true,
    hideForLemtel: true,
    items: [
      { nameKey: 'sidebar.leads', href: '/leads', icon: UserPlus },
      { nameKey: 'sidebar.appointments', href: '/appointments', icon: Calendar },
    ]
  },
  {
    id: 'campaigns',
    labelKey: 'sidebar.groups.campaigns',
    icon: Phone,
    adminOnly: true,
    items: [
      { nameKey: 'sidebar.campaignsList', href: '/campaigns', icon: Phone },
      { nameKey: 'sidebar.phoneNumbers', href: '/phone-numbers', icon: Phone },
      { nameKey: 'sidebar.smsTemplates', href: '/sms-templates', icon: MessageCircle },
    ]
  },
  {
    id: 'config',
    labelKey: 'sidebar.groups.config',
    icon: Sliders,
    adminOnly: true,
    items: [
      { nameKey: 'sidebar.workflows', href: '/workflows', icon: GitBranch },
      { nameKey: 'sidebar.integrations', href: '/integrations', icon: Sliders },
      { nameKey: 'sidebar.twilioManagement', href: '/twilio-management', icon: Phone, hideForLemtel: true },
      { nameKey: 'sidebar.webhookLogs', href: '/webhook-logs', icon: Webhook },
      { nameKey: 'Audit Logs', href: '/audit-logs', icon: Shield },
      { nameKey: 'sidebar.apiExplorer', href: '/api-explorer', icon: Globe },
    ]
  },
  {
    id: 'billing',
    labelKey: 'sidebar.groups.billing',
    icon: CreditCard,
    adminOnly: true,
    hideForLemtel: true,
    items: [
      { nameKey: 'sidebar.stripeBilling', href: '/stripe-billing', icon: CreditCard },
      { nameKey: 'sidebar.saasConfig', href: '/saas-config', icon: Settings },
    ]
  },
  {
    id: 'administration',
    labelKey: 'sidebar.groups.administration',
    icon: Shield,
    superAdminOnly: true,
    items: [
      { nameKey: 'sidebar.superAdmin', href: '/super-admin', icon: Building2 },
    ]
  },
  {
    id: 'phone-system',
    labelKey: '📞 Phone System',
    icon: PhoneCall,
    lemtelOnly: true,
    items: [
      { nameKey: 'Dashboard', href: '/org/lemtel/telephony/dashboard', icon: LayoutDashboard },
      { nameKey: 'Phone Numbers', href: '/org/lemtel/telephony/numbers', icon: Phone },
      { nameKey: 'Extensions', href: '/org/lemtel/telephony/extensions', icon: Smartphone },
      { nameKey: 'Devices', href: '/org/lemtel/telephony/devices', icon: Router },
      { nameKey: 'Call History', href: '/org/lemtel/telephony/calls', icon: PhoneCall },
      { nameKey: 'Recordings', href: '/org/lemtel/telephony/recordings', icon: Disc },
      { nameKey: 'Auto-Attendant', href: '/org/lemtel/telephony/ivr', icon: Voicemail },
      { nameKey: 'Call Queues', href: '/org/lemtel/telephony/queues', icon: Headphones },
      { nameKey: 'Ring Groups', href: '/org/lemtel/telephony/ring-groups', icon: Bell },
      { nameKey: 'SMS / Messages', href: '/org/lemtel/telephony/messages', icon: MessageSquare },
      { nameKey: 'Voice Agents', href: '/org/lemtel/telephony/agents', icon: Bot },
      { nameKey: 'AI Intelligence', href: '/org/lemtel/telephony/ai', icon: Brain },
      { nameKey: 'Softphone', href: '/org/lemtel/telephony/webphone', icon: Phone },
      { nameKey: 'Voicemail', href: '/org/lemtel/telephony/voicemail', icon: Voicemail },
      { nameKey: 'PBX Settings', href: '/org/lemtel/telephony/settings', icon: Settings },
      { nameKey: 'Diagnostics', href: '/org/lemtel/telephony/diagnostics', icon: Activity },
      { nameKey: '✅ Go-Live Checklist', href: '/org/lemtel/telephony/checklist', icon: CheckSquare },
    ]
  },
  {
    id: 'lemtel-legacy',
    labelKey: '📞 Lemtel (Legacy)',
    icon: PhoneCall,
    lemtelOnly: true,
    items: [
      { nameKey: 'Dashboard', href: '/lemtel/dashboard', icon: LayoutDashboard },
      { nameKey: 'Customers', href: '/lemtel/customers', icon: Users },
      { nameKey: 'Call Analytics', href: '/lemtel/analytics', icon: BarChart3 },
      { nameKey: 'Softphone Users', href: '/lemtel/softphone-users', icon: Smartphone },
      { nameKey: 'Lemtel Settings', href: '/lemtel/settings', icon: Settings },
    ]
  },
];

export const settingsLink: NavItem = {
  nameKey: 'sidebar.settings',
  href: '/settings',
  icon: Settings,
};
