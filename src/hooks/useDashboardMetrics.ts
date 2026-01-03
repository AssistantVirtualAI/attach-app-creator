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
  dataSource: 'elevenlabs' | 'local' | 'mixed';
  weeklyData: { name: string; conversations: number; satisfaction: number }[];
  agentPerformance: { name: string; conversations: number; satisfaction: number; duration: number }[];
  // New enhanced metrics
  resolutionRate: number;
  resolvedConversations: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  peakHours: { hour: number; count: number }[];
  qualityScore: number;
  weeklyGrowth: number;
  totalDurationMinutes: number;
}

const defaultMetrics: DashboardMetrics = {
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
  dataSource: 'local',
  weeklyData: [],
  agentPerformance: [],
  // New enhanced metrics defaults
  resolutionRate: 0,
  resolvedConversations: 0,
  sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
  peakHours: [],
  qualityScore: 0,
  weeklyGrowth: 0,
  totalDurationMinutes: 0,
};

export const useDashboardMetrics = () => {
  const { selectedOrgId } = useOrganization();

  return useQuery({
    queryKey: ['dashboard-metrics', selectedOrgId],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!selectedOrgId) {
        return defaultMetrics;
      }

      // Fetch ElevenLabs analytics and conversations in parallel with local data
      const [
        elevenLabsAnalytics,
        elevenLabsConversations,
        clientsRes,
        agentsRes,
      ] = await Promise.all([
        supabase.functions.invoke('elevenlabs-all-agents-analytics', {
          body: { timeframe: '30d', includeCharts: true }
        }).catch(() => ({ data: null, error: 'Failed' })),
        supabase.functions.invoke('elevenlabs-all-agents-conversations', {
          body: { page: 1, limit: 100, action: 'list' }
        }).catch(() => ({ data: null, error: 'Failed' })),
        supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', selectedOrgId)
          .eq('status', 'active'),
        supabase
          .from('agents')
          .select('id, name, platform, platform_agent_id')
          .eq('organization_id', selectedOrgId),
      ]);

      const agents = agentsRes.data || [];
      const elevenLabsData = elevenLabsAnalytics.data;
      const conversationsData = elevenLabsConversations.data;
      
      let dataSource: 'elevenlabs' | 'local' | 'mixed' = 'local';
      let totalConversations = 0;
      let avgSatisfaction = 0;
      let avgDuration = 0;
      let platformDistribution: { platform: string; count: number }[] = [];
      let recentActivity: DashboardMetrics['recentActivity'] = [];
      let weeklyData: DashboardMetrics['weeklyData'] = [];
      let agentPerformance: DashboardMetrics['agentPerformance'] = [];

      // Process ElevenLabs data if available
      if (elevenLabsData && !elevenLabsData.requiresSetup) {
        dataSource = 'elevenlabs';
        
        totalConversations = elevenLabsData.metrics?.totalConversations || 0;
        avgSatisfaction = elevenLabsData.metrics?.avgSatisfaction || 0;
        avgDuration = elevenLabsData.metrics?.avgDuration || 0;

        // Process agent performance
        if (elevenLabsData.agents && Array.isArray(elevenLabsData.agents)) {
          agentPerformance = elevenLabsData.agents.map((agent: any) => ({
            name: agent.name || 'Agent',
            conversations: agent.totalConversations || 0,
            satisfaction: agent.avgSatisfaction || 0,
            duration: agent.avgDuration || 0,
          }));
        }

        // Process chart data for weekly view
        if (elevenLabsData.chartData?.daily && Array.isArray(elevenLabsData.chartData.daily)) {
          const last7Days = elevenLabsData.chartData.daily.slice(-7);
          const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
          weeklyData = last7Days.map((day: any) => {
            const date = new Date(day.date);
            return {
              name: dayNames[date.getDay()],
              conversations: day.conversations || 0,
              satisfaction: day.avgSatisfaction || 0,
            };
          });
        }
      }

      // Process conversations for recent activity and platform distribution
      if (conversationsData?.conversations && Array.isArray(conversationsData.conversations)) {
        const conversations = conversationsData.conversations;
        
        // Calculate today's conversations
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const conversationsToday = conversations.filter((c: any) => {
          const convDate = new Date(c.start_time || c.created_at);
          return convDate >= today;
        }).length;

        // Calculate this week's conversations
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const conversationsThisWeek = conversations.filter((c: any) => {
          const convDate = new Date(c.start_time || c.created_at);
          return convDate >= weekAgo;
        }).length;

        // Platform distribution
        const platformCounts: Record<string, number> = {};
        conversations.forEach((c: any) => {
          const platform = 'ElevenLabs';
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        });
        platformDistribution = Object.entries(platformCounts).map(([platform, count]) => ({
          platform,
          count,
        }));

        // Recent activity - filter out invalid dates
        recentActivity = conversations
          .filter((c: any) => {
            const timestamp = c.start_time || c.created_at;
            if (!timestamp) return false;
            const date = new Date(timestamp);
            return !isNaN(date.getTime());
          })
          .slice(0, 10)
          .map((c: any) => ({
            id: c.conversation_id || c.id,
            type: 'conversation' as const,
            title: `Conversation ${(c.conversation_id || c.id)?.substring(0, 8) || 'N/A'}`,
            timestamp: c.start_time || c.created_at,
          }));

        // Generate weekly data if not from analytics
        if (weeklyData.length === 0) {
          const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
          const dayCounts: Record<string, { conversations: number; satisfaction: number[] }> = {};
          
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayName = dayNames[date.getDay()];
            dayCounts[dayName] = { conversations: 0, satisfaction: [] };
          }

          conversations.forEach((c: any) => {
            const convDate = new Date(c.start_time || c.created_at);
            const dayName = dayNames[convDate.getDay()];
            if (dayCounts[dayName]) {
              dayCounts[dayName].conversations++;
              if (c.analysis?.satisfaction_score) {
                dayCounts[dayName].satisfaction.push(c.analysis.satisfaction_score);
              }
            }
          });

          weeklyData = Object.entries(dayCounts).map(([name, data]) => ({
            name,
            conversations: data.conversations,
            satisfaction: data.satisfaction.length > 0 
              ? data.satisfaction.reduce((a, b) => a + b, 0) / data.satisfaction.length 
              : 0,
          }));
        }

        // Update total if not from analytics
        if (totalConversations === 0) {
          totalConversations = conversationsData.total || conversations.length;
        }

        // Calculate sentiment breakdown from conversations
        const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
        let resolvedCount = 0;
        let totalDuration = 0;
        const hourCounts: Record<number, number> = {};

        conversations.forEach((c: any) => {
          // Sentiment
          const sentiment = c.analysis?.overall_sentiment || 'neutral';
          if (sentiment === 'positive') sentimentBreakdown.positive++;
          else if (sentiment === 'negative') sentimentBreakdown.negative++;
          else sentimentBreakdown.neutral++;
          
          // Resolution
          if (c.status === 'done' || c.analysis?.call_successful) resolvedCount++;
          
          // Duration
          if (c.call_duration_secs) totalDuration += c.call_duration_secs;
          
          // Peak hours
          const hour = new Date(c.start_time || c.created_at).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const peakHours = Object.entries(hourCounts)
          .map(([hour, count]) => ({ hour: parseInt(hour), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const resolutionRate = conversations.length > 0 
          ? Math.round((resolvedCount / conversations.length) * 100) 
          : 0;

        const qualityScore = avgSatisfaction > 0 
          ? Math.round((avgSatisfaction / 5) * 100) 
          : 0;

        return {
          totalConversations,
          conversationsToday,
          conversationsThisWeek,
          conversationsThisMonth: totalConversations,
          previousPeriodConversations: 0,
          conversationsTrend: elevenLabsData?.trends?.conversationsTrend || 0,
          incomingMessages: totalConversations,
          previousPeriodMessages: 0,
          messagesTrend: 0,
          uniqueUsers: conversationsData.total || conversations.length,
          previousPeriodUsers: 0,
          usersTrend: 0,
          avgInteractions: 0,
          avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
          avgDuration: Math.round(avgDuration),
          activeClients: clientsRes.count || 0,
          totalAgents: agents.length,
          platformDistribution,
          recentActivity,
          lastUpdated: new Date().toISOString(),
          dataSource,
          weeklyData,
          agentPerformance,
          // Enhanced metrics
          resolutionRate,
          resolvedConversations: resolvedCount,
          sentimentBreakdown,
          peakHours,
          qualityScore,
          weeklyGrowth: elevenLabsData?.trends?.conversationsTrend || 0,
          totalDurationMinutes: Math.round(totalDuration / 60),
        };
      }

      // Fallback to local data
      return {
        ...defaultMetrics,
        activeClients: clientsRes.count || 0,
        totalAgents: agents.length,
        lastUpdated: new Date().toISOString(),
        dataSource: 'local',
      };
    },
    enabled: !!selectedOrgId,
    refetchInterval: 30000,
  });
};

// Hook for syncing ElevenLabs conversations
export const useSyncElevenLabsConversations = () => {
  return useQuery({
    queryKey: ['sync-elevenlabs-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-elevenlabs-conversations', {
        body: { action: 'sync' }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: false, // Manual trigger only
  });
};
