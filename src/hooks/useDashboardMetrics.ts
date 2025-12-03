import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';

export interface DashboardMetrics {
  totalConversations: number;
  conversationsToday: number;
  conversationsThisWeek: number;
  conversationsThisMonth: number;
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
          avgSatisfaction: 0,
          avgDuration: 0,
          activeClients: 0,
          totalAgents: 0,
          platformDistribution: [],
          recentActivity: [],
        };
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch all data in parallel
      const [
        totalConversationsRes,
        todayConversationsRes,
        weekConversationsRes,
        monthConversationsRes,
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
          .gte('created_at', monthStart),
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
        conversationsThisWeek: weekConversationsRes.count || 0,
        conversationsThisMonth: monthConversationsRes.count || 0,
        avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
        avgDuration: Math.round(avgDuration),
        activeClients: clientsRes.count || 0,
        totalAgents: agentsRes.count || 0,
        platformDistribution,
        recentActivity,
      };
    },
    enabled: !!selectedOrgId,
    refetchInterval: 30000,
  });
};
