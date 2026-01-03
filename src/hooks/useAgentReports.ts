import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalConversations: number;
  avgSatisfaction: number;
  avgDuration: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  resolutionRate: number;
  topTags: { tag: string; count: number }[];
  topImprovements: string[];
  recentTrend: 'up' | 'down' | 'stable';
}

export interface AgentReportsData {
  agents: AgentMetrics[];
  globalMetrics: {
    totalConversations: number;
    avgSatisfaction: number;
    bestPerformingAgent: string | null;
    worstPerformingAgent: string | null;
  };
}

export function useAgentReports(selectedAgentId?: string) {
  const { selectedOrg } = useOrganization();

  return useQuery({
    queryKey: ['agent-reports', selectedOrg?.id, selectedAgentId],
    queryFn: async (): Promise<AgentReportsData> => {
      if (!selectedOrg?.id) {
        return { agents: [], globalMetrics: { totalConversations: 0, avgSatisfaction: 0, bestPerformingAgent: null, worstPerformingAgent: null } };
      }

      // Fetch agents
      const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .eq('organization_id', selectedOrg.id);

      if (!agents || agents.length === 0) {
        return { agents: [], globalMetrics: { totalConversations: 0, avgSatisfaction: 0, bestPerformingAgent: null, worstPerformingAgent: null } };
      }

      // Filter by selected agent if provided
      const targetAgents = selectedAgentId && selectedAgentId !== 'all'
        ? agents.filter(a => a.id === selectedAgentId)
        : agents;

      // Fetch conversations for metrics
      let conversationsQuery = supabase
        .from('conversations')
        .select('id, agent_id, satisfaction_score, sentiment, duration, smart_tags, resolution_status, created_at')
        .eq('organization_id', selectedOrg.id);

      if (selectedAgentId && selectedAgentId !== 'all') {
        conversationsQuery = conversationsQuery.eq('agent_id', selectedAgentId);
      }

      const { data: conversations } = await conversationsQuery;

      // Fetch agent insights
      let insightsQuery = supabase
        .from('agent_insights')
        .select('agent_id, satisfaction_score, overall_sentiment, improvements, smart_tags')
        .eq('organization_id', selectedOrg.id);

      if (selectedAgentId && selectedAgentId !== 'all') {
        insightsQuery = insightsQuery.eq('agent_id', selectedAgentId);
      }

      const { data: insights } = await insightsQuery;

      // Calculate metrics per agent
      const agentMetrics: AgentMetrics[] = targetAgents.map(agent => {
        const agentConversations = conversations?.filter(c => c.agent_id === agent.id) || [];
        const agentInsights = insights?.filter(i => i.agent_id === agent.id) || [];

        const totalConversations = agentConversations.length;
        
        // Average satisfaction
        const satisfactionScores = agentConversations
          .filter(c => c.satisfaction_score !== null)
          .map(c => Number(c.satisfaction_score));
        const avgSatisfaction = satisfactionScores.length > 0
          ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
          : 0;

        // Average duration
        const durations = agentConversations
          .filter(c => c.duration !== null)
          .map(c => c.duration as number);
        const avgDuration = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

        // Sentiment distribution
        const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
        agentConversations.forEach(c => {
          const sentiment = c.sentiment?.toLowerCase() || 'neutral';
          if (sentiment.includes('positif') || sentiment === 'positive') {
            sentimentCounts.positive++;
          } else if (sentiment.includes('négatif') || sentiment === 'negative') {
            sentimentCounts.negative++;
          } else {
            sentimentCounts.neutral++;
          }
        });

        // Also count from insights
        agentInsights.forEach(i => {
          const sentiment = i.overall_sentiment?.toLowerCase() || '';
          if (sentiment.includes('positif') || sentiment === 'positive') {
            sentimentCounts.positive++;
          } else if (sentiment.includes('négatif') || sentiment === 'negative') {
            sentimentCounts.negative++;
          }
        });

        // Resolution rate
        const resolved = agentConversations.filter(c => c.resolution_status === 'resolved').length;
        const resolutionRate = totalConversations > 0 ? (resolved / totalConversations) * 100 : 0;

        // Top tags
        const tagCounts: Record<string, number> = {};
        agentConversations.forEach(c => {
          (c.smart_tags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
        agentInsights.forEach(i => {
          (i.smart_tags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
        const topTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag, count]) => ({ tag, count }));

        // Top improvements
        const allImprovements: string[] = [];
        agentInsights.forEach(i => {
          const improvements = i.improvements as any[];
          if (Array.isArray(improvements)) {
            improvements.forEach(imp => {
              if (typeof imp === 'string') {
                allImprovements.push(imp);
              } else if (imp?.suggestion) {
                allImprovements.push(imp.suggestion);
              }
            });
          }
        });
        // Count and get top 5
        const improvementCounts: Record<string, number> = {};
        allImprovements.forEach(imp => {
          improvementCounts[imp] = (improvementCounts[imp] || 0) + 1;
        });
        const topImprovements = Object.entries(improvementCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([imp]) => imp);

        // Recent trend (compare last 7 days to previous 7 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        
        const recentConversations = agentConversations.filter(c => new Date(c.created_at) >= sevenDaysAgo);
        const previousConversations = agentConversations.filter(c => {
          const date = new Date(c.created_at);
          return date >= fourteenDaysAgo && date < sevenDaysAgo;
        });

        const recentAvgSat = recentConversations
          .filter(c => c.satisfaction_score)
          .reduce((sum, c) => sum + Number(c.satisfaction_score), 0) / (recentConversations.length || 1);
        const prevAvgSat = previousConversations
          .filter(c => c.satisfaction_score)
          .reduce((sum, c) => sum + Number(c.satisfaction_score), 0) / (previousConversations.length || 1);

        let recentTrend: 'up' | 'down' | 'stable' = 'stable';
        if (recentAvgSat > prevAvgSat + 0.5) recentTrend = 'up';
        else if (recentAvgSat < prevAvgSat - 0.5) recentTrend = 'down';

        return {
          agentId: agent.id,
          agentName: agent.name,
          totalConversations,
          avgSatisfaction,
          avgDuration,
          sentimentDistribution: sentimentCounts,
          resolutionRate,
          topTags,
          topImprovements,
          recentTrend,
        };
      });

      // Global metrics
      const totalConversations = agentMetrics.reduce((sum, a) => sum + a.totalConversations, 0);
      const avgSatisfaction = agentMetrics.length > 0
        ? agentMetrics.reduce((sum, a) => sum + a.avgSatisfaction, 0) / agentMetrics.length
        : 0;

      const sortedByPerformance = [...agentMetrics].sort((a, b) => b.avgSatisfaction - a.avgSatisfaction);
      const bestPerformingAgent = sortedByPerformance[0]?.agentName || null;
      const worstPerformingAgent = sortedByPerformance[sortedByPerformance.length - 1]?.agentName || null;

      return {
        agents: agentMetrics,
        globalMetrics: {
          totalConversations,
          avgSatisfaction,
          bestPerformingAgent,
          worstPerformingAgent,
        },
      };
    },
    enabled: !!selectedOrg?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
