import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { DashboardMetrics, DateRange } from './useDashboardMetrics';
import { format } from 'date-fns';

export interface AgentWithStats {
  id: string;
  name: string;
  platform_agent_id: string;
  platform: string;
  conversations: number;
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
  resolutionRate: 0,
  resolvedConversations: 0,
  sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
  peakHours: [],
  qualityScore: 0,
  weeklyGrowth: 0,
  totalDurationMinutes: 0,
  aiInsightsAvailable: false,
  analysisCoverageRate: 0,
  topSmartTags: [],
  topImprovements: [],
};

export const useDashboardAgents = () => {
  const { selectedOrgId } = useOrganization();

  return useQuery({
    queryKey: ['dashboard-agents', selectedOrgId],
    queryFn: async (): Promise<AgentWithStats[]> => {
      if (!selectedOrgId) return [];

      // Get agents
      const { data: agents, error } = await supabase
        .from('agents')
        .select('id, name, platform_agent_id, platform')
        .eq('organization_id', selectedOrgId);

      if (error) throw error;

      // Get conversation counts per agent from ElevenLabs
      const { data: conversationsData } = await supabase.functions.invoke(
        'elevenlabs-all-agents-conversations',
        { body: { page: 1, limit: 200, action: 'list' } }
      ).catch(() => ({ data: null }));

      const conversations = conversationsData?.conversations || [];
      
      // Count conversations per agent
      const agentConversationCounts: Record<string, number> = {};
      conversations.forEach((c: any) => {
        const agentId = c.agent_id;
        if (agentId) {
          agentConversationCounts[agentId] = (agentConversationCounts[agentId] || 0) + 1;
        }
      });

      return (agents || []).map(agent => ({
        ...agent,
        conversations: agentConversationCounts[agent.platform_agent_id] || 0
      }));
    },
    enabled: !!selectedOrgId,
    staleTime: 60000,
  });
};

export const useAgentDashboardMetrics = (agentId: string | null, dateRange?: DateRange) => {
  const { selectedOrgId } = useOrganization();

  // Calculate timeframe based on dateRange
  const getTimeframe = () => {
    if (!dateRange) return '30d';
    const diffDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return '1d';
    if (diffDays <= 7) return '7d';
    if (diffDays <= 30) return '30d';
    return '90d';
  };

  return useQuery({
    queryKey: ['agent-dashboard-metrics', selectedOrgId, agentId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!selectedOrgId) return defaultMetrics;
      
      // If no agent selected, return null (use global metrics)
      if (!agentId) return defaultMetrics;

      // Get the agent's platform_agent_id
      const { data: agent } = await supabase
        .from('agents')
        .select('platform_agent_id, name')
        .eq('id', agentId)
        .single();

      if (!agent?.platform_agent_id) return defaultMetrics;

      const timeframe = getTimeframe();
      const startDate = dateRange ? format(dateRange.start, 'yyyy-MM-dd') : undefined;
      const endDate = dateRange ? format(dateRange.end, 'yyyy-MM-dd') : undefined;

      // Fetch agent-specific analytics
      const [analyticsRes, conversationsRes, insightsRes] = await Promise.all([
        supabase.functions.invoke('elevenlabs-convai-analytics', {
          body: { agentId: agent.platform_agent_id, timeframe, startDate, endDate }
        }).catch(() => ({ data: null })),
        supabase.functions.invoke('elevenlabs-convai-conversations', {
          body: { action: 'list', agentId: agent.platform_agent_id, page: 1, limit: 100, startDate, endDate }
        }).catch(() => ({ data: null })),
        supabase
          .from('agent_insights')
          .select('*')
          .eq('agent_id', agentId)
          .order('analyzed_at', { ascending: false })
          .limit(50)
      ]);

      const analytics = analyticsRes.data;
      const conversationsData = conversationsRes.data;
      const insights = insightsRes.data || [];
      const conversations = conversationsData?.conversations || [];

      // Calculate metrics from agent-specific data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const conversationsToday = conversations.filter((c: any) => {
        const convDate = new Date(c.start_time || c.created_at);
        return convDate >= today;
      }).length;

      const conversationsThisWeek = conversations.filter((c: any) => {
        const convDate = new Date(c.start_time || c.created_at);
        return convDate >= weekAgo;
      }).length;

      // Sentiment breakdown
      const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
      let resolvedCount = 0;
      let totalDuration = 0;
      let totalSatisfaction = 0;
      let satisfactionCount = 0;
      const hourCounts: Record<number, number> = {};

      conversations.forEach((c: any) => {
        const sentiment = c.analysis?.overall_sentiment || 'neutral';
        if (sentiment === 'positive') sentimentBreakdown.positive++;
        else if (sentiment === 'negative') sentimentBreakdown.negative++;
        else sentimentBreakdown.neutral++;

        if (c.status === 'done' || c.analysis?.call_successful) resolvedCount++;
        if (c.call_duration_secs) totalDuration += c.call_duration_secs;
        
        if (c.analysis?.satisfaction_score) {
          totalSatisfaction += c.analysis.satisfaction_score;
          satisfactionCount++;
        }

        const hour = new Date(c.start_time || c.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      // Also include insights sentiment
      insights.forEach((i: any) => {
        const sentiment = i.overall_sentiment || 'neutral';
        if (sentiment === 'positive') sentimentBreakdown.positive++;
        else if (sentiment === 'negative') sentimentBreakdown.negative++;
        else sentimentBreakdown.neutral++;

        if (i.satisfaction_score) {
          totalSatisfaction += Number(i.satisfaction_score);
          satisfactionCount++;
        }
      });

      const avgSatisfaction = satisfactionCount > 0 
        ? totalSatisfaction / satisfactionCount 
        : (analytics?.avgSatisfaction || 0);

      const totalConversations = conversationsData?.total || conversations.length;
      const resolutionRate = totalConversations > 0 
        ? Math.round((resolvedCount / totalConversations) * 100) 
        : 0;

      const peakHours = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Generate weekly data
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

      const weeklyData = Object.entries(dayCounts).map(([name, data]) => ({
        name,
        conversations: data.conversations,
        satisfaction: data.satisfaction.length > 0 
          ? data.satisfaction.reduce((a, b) => a + b, 0) / data.satisfaction.length 
          : 0,
      }));

      // Top smart tags from insights
      const tagCounts: Record<string, number> = {};
      insights.forEach((i: any) => {
        const tags = (i.smart_tags as string[]) || [];
        tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      const topSmartTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

      // Top improvements
      const improvementMap: Record<string, { category: string; suggestion: string; count: number }> = {};
      insights.forEach((i: any) => {
        const improvements = (i.improvements as any[]) || [];
        improvements.forEach(imp => {
          const key = `${imp.category}:${(imp.suggestion || '').substring(0, 50)}`;
          if (!improvementMap[key]) {
            improvementMap[key] = { category: imp.category, suggestion: imp.suggestion || '', count: 0 };
          }
          improvementMap[key].count++;
        });
      });

      const topImprovements = Object.values(improvementMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Recent activity
      const recentActivity = conversations
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

      return {
        totalConversations,
        conversationsToday,
        conversationsThisWeek,
        conversationsThisMonth: totalConversations,
        previousPeriodConversations: 0,
        conversationsTrend: analytics?.trends?.conversationsTrend || 0,
        incomingMessages: totalConversations,
        previousPeriodMessages: 0,
        messagesTrend: 0,
        uniqueUsers: totalConversations,
        previousPeriodUsers: 0,
        usersTrend: 0,
        avgInteractions: 0,
        avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
        avgDuration: Math.round(analytics?.avgDuration || (totalDuration / Math.max(1, conversations.length))),
        activeClients: 0,
        totalAgents: 1,
        platformDistribution: [{ platform: 'ElevenLabs', count: totalConversations }],
        recentActivity,
        lastUpdated: new Date().toISOString(),
        dataSource: 'elevenlabs',
        weeklyData,
        agentPerformance: [{
          name: agent.name,
          conversations: totalConversations,
          satisfaction: avgSatisfaction,
          duration: analytics?.avgDuration || 0
        }],
        resolutionRate,
        resolvedConversations: resolvedCount,
        sentimentBreakdown,
        peakHours,
        qualityScore: avgSatisfaction > 0 ? Math.round((avgSatisfaction / 10) * 100) : 0,
        weeklyGrowth: analytics?.trends?.conversationsTrend || 0,
        totalDurationMinutes: Math.round(totalDuration / 60),
        aiInsightsAvailable: insights.length > 0,
        analysisCoverageRate: totalConversations > 0 
          ? Math.round((insights.length / totalConversations) * 100) 
          : 0,
        topSmartTags,
        topImprovements,
      };
    },
    enabled: !!selectedOrgId && !!agentId,
    refetchInterval: 30000,
  });
};
