import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';

export interface DashboardMetrics {
  totalConversations: number;
  conversationsToday: number;
  conversationsThisWeek: number;
  conversationsThisMonth: number;
  previousPeriodConversations: number;
  conversationsTrend: number;
  incomingMessages: number;
  previousPeriodMessages: number;
  messagesTrend: number;
  uniqueUsers: number;
  previousPeriodUsers: number;
  usersTrend: number;
  avgInteractions: number;
  avgSatisfaction: number;
  avgDuration: number;
  activeClients: number;
  totalAgents: number;
  platformDistribution: { platform: string; count: number }[];
  recentActivity: {
    id: string;
    type: 'conversation' | 'client' | 'agent';
    title: string;
    timestamp: string;
  }[];
  lastUpdated: string;
}

export const useDashboardMetrics = () => {
  const { selectedOrgId } = useOrganization();

  return useQuery({
    queryKey: ['dashboard-metrics', selectedOrgId],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!selectedOrgId) {
        return {
          totalConversations: 0,
          conversationsToday: 0,
          conversationsThisWeek: 0,
          conversationsThisMonth: 0,
          previousPeriodConversations: 0,
          conversationsTrend: 0,
          incomingMessages: 0,
          previousPeriodMessages: 0,
          messagesTrend: 0,
          uniqueUsers: 0,
          previousPeriodUsers: 0,
          usersTrend: 0,
          avgInteractions: 0,
          avgSatisfaction: 0,
          avgDuration: 0,
          activeClients: 0,
          totalAgents: 0,
          platformDistribution: [],
          recentActivity: [],
          lastUpdated: new Date().toISOString(),
        };
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const previousWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch all data in parallel
      const [
        totalConversationsRes,
        todayConversationsRes,
        weekConversationsRes,
        previousWeekConversationsRes,
        monthConversationsRes,
        conversationsWithMessagesRes,
        previousWeekMessagesRes,
        satisfactionRes,
        clientsRes,
        agentsRes,
        platformRes,
        recentConversationsRes,
      ] = await Promise.all([
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', selectedOrgId),
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', selectedOrgId)
          .gte('created_at', todayStart),
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', selectedOrgId)
          .gte('created_at', weekStart),
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', selectedOrgId)
          .gte('created_at', previousWeekStart)
          .lt('created_at', weekStart),
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', selectedOrgId)
          .gte('created_at', monthStart),
        // Fetch conversations with messages for current week
        supabase
          .from('conversations')
          .select('id, user_messages, metadata')
          .eq('organization_id', selectedOrgId)
          .gte('created_at', weekStart),
        // Fetch conversations with messages for previous week
        supabase
          .from('conversations')
          .select('id, user_messages, metadata')
          .eq('organization_id', selectedOrgId)
          .gte('created_at', previousWeekStart)
          .lt('created_at', weekStart),
        supabase
          .from('conversations')
          .select('satisfaction_score, duration')
          .eq('organization_id', selectedOrgId)
          .not('satisfaction_score', 'is', null),
        supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', selectedOrgId)
          .eq('status', 'active'),
        supabase
          .from('agents')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', selectedOrgId),
        supabase
          .from('conversations')
          .select('platform')
          .eq('organization_id', selectedOrgId)
          .not('platform', 'is', null),
        supabase
          .from('conversations')
          .select('id, title, created_at, platform')
          .eq('organization_id', selectedOrgId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      // Calculate incoming messages (count of user messages)
      const currentWeekData = conversationsWithMessagesRes.data || [];
      const previousWeekData = previousWeekMessagesRes.data || [];
      
      let incomingMessages = 0;
      let totalInteractions = 0;
      const uniqueUserIds = new Set<string>();
      
      currentWeekData.forEach((c) => {
        const messages = c.user_messages as any[] || [];
        incomingMessages += messages.length;
        totalInteractions += messages.length;
        
        // Extract unique user identifier from metadata
        const metadata = c.metadata as Record<string, any> || {};
        const userId = metadata.user_id || metadata.caller_id || metadata.session_id || c.id;
        if (userId) uniqueUserIds.add(String(userId));
      });

      let previousPeriodMessages = 0;
      const previousUniqueUserIds = new Set<string>();
      
      previousWeekData.forEach((c) => {
        const messages = c.user_messages as any[] || [];
        previousPeriodMessages += messages.length;
        
        const metadata = c.metadata as Record<string, any> || {};
        const userId = metadata.user_id || metadata.caller_id || metadata.session_id || c.id;
        if (userId) previousUniqueUserIds.add(String(userId));
      });

      // Calculate trends (percentage change)
      const currentConversations = weekConversationsRes.count || 0;
      const previousConversations = previousWeekConversationsRes.count || 0;
      const conversationsTrend = previousConversations > 0 
        ? Math.round(((currentConversations - previousConversations) / previousConversations) * 100)
        : currentConversations > 0 ? 100 : 0;

      const messagesTrend = previousPeriodMessages > 0
        ? Math.round(((incomingMessages - previousPeriodMessages) / previousPeriodMessages) * 100)
        : incomingMessages > 0 ? 100 : 0;

      const uniqueUsers = uniqueUserIds.size;
      const previousPeriodUsers = previousUniqueUserIds.size;
      const usersTrend = previousPeriodUsers > 0
        ? Math.round(((uniqueUsers - previousPeriodUsers) / previousPeriodUsers) * 100)
        : uniqueUsers > 0 ? 100 : 0;

      const avgInteractions = currentWeekData.length > 0 
        ? Math.round((totalInteractions / currentWeekData.length) * 10) / 10
        : 0;

      // Calculate averages
      const satisfactionData = satisfactionRes.data || [];
      const avgSatisfaction = satisfactionData.length > 0
        ? satisfactionData.reduce((acc, c) => acc + (c.satisfaction_score || 0), 0) / satisfactionData.length
        : 0;
      const avgDuration = satisfactionData.length > 0
        ? satisfactionData.reduce((acc, c) => acc + (c.duration || 0), 0) / satisfactionData.length
        : 0;

      // Calculate platform distribution
      const platformCounts: Record<string, number> = {};
      (platformRes.data || []).forEach((c) => {
        const platform = c.platform || 'unknown';
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });
      const platformDistribution = Object.entries(platformCounts).map(([platform, count]) => ({
        platform,
        count,
      }));

      // Format recent activity
      const recentActivity = (recentConversationsRes.data || []).map((c) => ({
        id: c.id,
        type: 'conversation' as const,
        title: c.title,
        timestamp: c.created_at,
      }));

      return {
        totalConversations: totalConversationsRes.count || 0,
        conversationsToday: todayConversationsRes.count || 0,
        conversationsThisWeek: currentConversations,
        conversationsThisMonth: monthConversationsRes.count || 0,
        previousPeriodConversations: previousConversations,
        conversationsTrend,
        incomingMessages,
        previousPeriodMessages,
        messagesTrend,
        uniqueUsers,
        previousPeriodUsers,
        usersTrend,
        avgInteractions,
        avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
        avgDuration: Math.round(avgDuration),
        activeClients: clientsRes.count || 0,
        totalAgents: agentsRes.count || 0,
        platformDistribution,
        recentActivity,
        lastUpdated: new Date().toISOString(),
      };
    },
    enabled: !!selectedOrgId,
    refetchInterval: 30000,
  });
};
