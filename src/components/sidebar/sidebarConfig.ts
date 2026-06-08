import {
  Home, TrendingUp, MessageSquare, BarChart3, BookOpen,
  Bot, Sparkles, FileQuestion, Users, UserPlus, Calendar,
  Phone, MessageCircle, GitBranch, Sliders, Webhook,
  CreditCard, Settings, Tag, Headphones, LayoutDashboard, Radio, Globe,
  Shield, Building2, PhoneCall, Voicemail, Smartphone, Disc, Bell, Brain, Router, Activity, CheckSquare,
  Music, Download, User
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

/**
 * Default (legacy AVA AI workspace) sidebar.
 * Used for non-Lemtel orgs and on routes outside /admin, /org, /my.
 */
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
];

/** Lemtel master admin (/admin/*) */
export const adminPortalGroups: NavGroup[] = [
  {
    id: 'admin-main',
    labelKey: 'Lemtel Admin',
    icon: Shield,
    items: [
      { nameKey: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { nameKey: 'Organizations', href: '/admin/organizations', icon: Building2 },
      { nameKey: 'All Users', href: '/admin/users', icon: Users },
      { nameKey: 'All Calls', href: '/admin/calls', icon: PhoneCall },
      { nameKey: 'Reports', href: '/admin/reports', icon: BarChart3 },
      { nameKey: 'Billing', href: '/admin/billing', icon: CreditCard },
      { nameKey: 'Audit Logs', href: '/admin/audit', icon: Shield },
      { nameKey: 'System Settings', href: '/admin/system', icon: Settings },
    ]
  },
];

/** Organization portal (/org/[slug]/*) */
export function buildOrgPortalGroups(slug: string): NavGroup[] {
  const base = `/org/${slug}`;
  return [
    {
      id: 'org-overview',
      labelKey: 'Overview',
      icon: TrendingUp,
      items: [
        { nameKey: 'Dashboard', href: `${base}/dashboard`, icon: LayoutDashboard },
      ]
    },
    {
      id: 'phone-system',
      labelKey: '📞 Phone System',
      icon: PhoneCall,
      items: [
        { nameKey: 'Extensions', href: `${base}/phone-system/extensions`, icon: Smartphone },
        { nameKey: 'Devices', href: `${base}/phone-system/devices`, icon: Router },
        { nameKey: 'Phone Numbers', href: `${base}/phone-system/dids`, icon: Phone },
        { nameKey: 'IVR / Auto-Attendant', href: `${base}/phone-system/ivr`, icon: Voicemail },
        { nameKey: 'Call Queues', href: `${base}/phone-system/queues`, icon: Headphones },
        { nameKey: 'Ring Groups', href: `${base}/phone-system/ring-groups`, icon: Bell },
        { nameKey: 'Music on Hold', href: `${base}/phone-system/moh`, icon: Music },
        { nameKey: 'PBX Settings', href: `${base}/phone-system/settings`, icon: Settings },
      ]
    },
    {
      id: 'call-center',
      labelKey: '🎧 Call Center',
      icon: Headphones,
      items: [
        { nameKey: 'Wallboard', href: `${base}/call-center/wallboard`, icon: Activity },
        { nameKey: 'Agents', href: `${base}/call-center/agents`, icon: User },
        { nameKey: 'Supervisors', href: `${base}/call-center/supervisors`, icon: Shield },
        { nameKey: 'Queues Config', href: `${base}/call-center/queues`, icon: Headphones },
        { nameKey: 'Reports', href: `${base}/call-center/reports`, icon: BarChart3 },
        { nameKey: 'Settings', href: `${base}/call-center/config`, icon: Settings },
      ]
    },
    {
      id: 'analytics',
      labelKey: '📈 Analytics',
      icon: BarChart3,
      items: [
        { nameKey: 'Call Recordings', href: `${base}/recordings`, icon: Disc },
        { nameKey: 'Call History (CDRs)', href: `${base}/analytics/cdrs`, icon: PhoneCall },
        { nameKey: 'AI Insights', href: `${base}/ai`, icon: Brain },
        { nameKey: 'Reports', href: `${base}/analytics/reports`, icon: BarChart3 },
      ]
    },
    {
      id: 'communications',
      labelKey: 'Communications',
      icon: MessageSquare,
      items: [
        { nameKey: 'Messages (SMS/MMS)', href: `${base}/messages`, icon: MessageSquare },
        { nameKey: 'Voicemail', href: `${base}/voicemail`, icon: Voicemail },
        { nameKey: 'Team Chat', href: `${base}/team`, icon: Users },
      ]
    },
    {
      id: 'org-admin',
      labelKey: 'Admin',
      icon: Settings,
      items: [
        { nameKey: 'Users & Access', href: `${base}/users`, icon: Users },
        { nameKey: 'Downloads', href: `${base}/downloads`, icon: Download },
        { nameKey: 'Settings', href: `${base}/settings`, icon: Settings },
      ]
    },
  ];
}

/** End-user portal (/my/*) */
export const myPortalGroups: NavGroup[] = [
  {
    id: 'my',
    labelKey: 'My Workspace',
    icon: Home,
    items: [
      { nameKey: 'My Dashboard', href: '/my/dashboard', icon: LayoutDashboard },
      { nameKey: 'My Extension', href: '/my/extension', icon: Smartphone },
      { nameKey: 'My Call History', href: '/my/calls', icon: PhoneCall },
      { nameKey: 'My Recordings', href: '/my/recordings', icon: Disc },
      { nameKey: 'My Voicemail', href: '/my/voicemail', icon: Voicemail },
      { nameKey: 'My Messages', href: '/my/messages', icon: MessageSquare },
      { nameKey: 'Download Apps', href: '/my/download', icon: Download },
      { nameKey: 'My Settings', href: '/my/settings', icon: Sliders },
    ]
  },
];

/**
 * Pick the correct sidebar group set based on the current pathname.
 * Returns null when no portal-specific override applies.
 */
export function getPortalGroups(pathname: string): NavGroup[] | null {
  if (pathname.startsWith('/admin')) return adminPortalGroups;
  if (pathname.startsWith('/my')) return myPortalGroups;
  const orgMatch = pathname.match(/^\/org\/([^/]+)/);
  if (orgMatch) return buildOrgPortalGroups(orgMatch[1]);
  return null;
}

export const settingsLink: NavItem = {
  nameKey: 'sidebar.settings',
  href: '/settings',
  icon: Settings,
};
