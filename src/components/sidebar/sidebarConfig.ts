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
    labelKey: 'sidebar.dashboard',
    icon: TrendingUp,
    items: [
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
  // Administration group removed per request

  {
    id: 'phone-system',
    labelKey: '📞 Phone System',
    icon: PhoneCall,
    lemtelOnly: true,
    items: [
      { nameKey: 'Dashboard', href: '/org/lemtel/telephony/dashboard', icon: LayoutDashboard },
      { nameKey: 'Phone Numbers', href: '/org/lemtel/telephony/numbers', icon: Phone },
      { nameKey: 'Extensions', href: '/org/lemtel/telephony/extensions', icon: Smartphone },
      { nameKey: 'Users', href: '/org/lemtel/telephony/users', icon: Users },
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
      { nameKey: 'Team', href: '/org/lemtel/telephony/team', icon: Users },
      { nameKey: 'My Preferences', href: '/org/lemtel/telephony/preferences', icon: Sliders },
      { nameKey: 'PBX Settings', href: '/org/lemtel/telephony/settings', icon: Settings },
      { nameKey: 'Diagnostics', href: '/org/lemtel/telephony/diagnostics', icon: Activity },
      { nameKey: '✅ Go-Live Checklist', href: '/org/lemtel/telephony/checklist', icon: CheckSquare },
    ]
  },
  {
    id: 'callcenter',
    labelKey: 'Call Center',
    icon: Headphones,
    lemtelOnly: true,
    items: [
      { nameKey: 'Agent Console', href: '/org/lemtel/callcenter/agent', icon: Phone },
      { nameKey: 'Wallboard', href: '/org/lemtel/callcenter/wallboard', icon: Activity },
      { nameKey: 'CC Admin', href: '/org/lemtel/callcenter/admin', icon: Shield },
    ]
  },
  {
    id: 'lemtel-admin-v3',
    labelKey: '🛠️ Lemtel Admin (v3)',
    icon: Shield,
    lemtelOnly: true,
    items: [
      { nameKey: 'Admin Dashboard', href: '/org/lemtel/admin/dashboard', icon: LayoutDashboard },
      { nameKey: 'Extensions', href: '/org/lemtel/admin/extensions', icon: Smartphone },
      { nameKey: 'Devices', href: '/org/lemtel/admin/devices', icon: Router },
      { nameKey: 'Phone Numbers', href: '/org/lemtel/admin/dids', icon: Phone },
      { nameKey: 'IVR / Auto-Attendant', href: '/org/lemtel/admin/ivr', icon: Voicemail },
      { nameKey: 'Call Queues', href: '/org/lemtel/admin/queues', icon: Headphones },
      { nameKey: 'Ring Groups', href: '/org/lemtel/admin/ring-groups', icon: Bell },
      { nameKey: 'Recordings', href: '/org/lemtel/admin/recordings', icon: Disc },
      { nameKey: 'Voicemail', href: '/org/lemtel/admin/voicemail', icon: Voicemail },
      { nameKey: 'Reports', href: '/org/lemtel/admin/reports', icon: BarChart3 },
      { nameKey: 'Settings', href: '/org/lemtel/admin/settings', icon: Settings },
      { nameKey: 'Downloads', href: '/org/lemtel/admin/downloads', icon: Smartphone },
    ]
  },
  {
    id: 'lemtel-my-v3',
    labelKey: '🏠 My Workspace',
    icon: Users,
    lemtelOnly: true,
    items: [
      { nameKey: 'My Dashboard', href: '/org/lemtel/my/dashboard', icon: LayoutDashboard },
      { nameKey: 'My Calls', href: '/org/lemtel/my/calls', icon: PhoneCall },
      { nameKey: 'My Recordings', href: '/org/lemtel/my/recordings', icon: Disc },
      { nameKey: 'My Voicemail', href: '/org/lemtel/my/voicemail', icon: Voicemail },
      { nameKey: 'My SMS', href: '/org/lemtel/my/sms', icon: MessageSquare },
      { nameKey: 'My Settings', href: '/org/lemtel/my/settings', icon: Sliders },
      { nameKey: 'Download Apps', href: '/org/lemtel/my/downloads', icon: Smartphone },
    ]
  },
];

export const settingsLink: NavItem = {
  nameKey: 'sidebar.settings',
  href: '/settings',
  icon: Settings,
};
