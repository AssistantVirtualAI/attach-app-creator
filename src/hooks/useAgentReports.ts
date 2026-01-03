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
  successRate: number;
  topTags: { tag: string; count: number }[];
  topImprovements: string[];
  recentTrend: 'up' | 'down' | 'stable';
  dataSource: 'elevenlabs' | 'local' | 'mixed';
}

export interface AgentReportsData {
  agents: AgentMetrics[];
  globalMetrics: {
    totalConversations: number;
    avgSatisfaction: number;
    totalVoiceMinutes: number;
    successRate: number;
    bestPerformingAgent: string | null;
    worstPerformingAgent: string | null;
  };
  dataSource: 'elevenlabs' | 'local' | 'mixed';
  lastSync?: string;
}

export function useAgentReports(selectedAgentId?: string) {
  const { selectedOrg } = useOrganization();

  return useQuery({
    queryKey: ['agent-reports', selectedOrg?.id, selectedAgentId],
    queryFn: async (): Promise<AgentReportsData> => {
      if (!selectedOrg?.id) {
        return getEmptyReportsData();
      }

      // Fetch agents
      const { data: agents } = await supabase
        .from('agents')
        .select('id, name, platform, platform_agent_id')
        .eq('organization_id', selectedOrg.id);

      if (!agents || agents.length === 0) {
        return getEmptyReportsData();
      }

      // Filter by selected agent if provided
      const targetAgents = selectedAgentId && selectedAgentId !== 'all'
        ? agents.filter(a => a.id === selectedAgentId)
        : agents;

      // Try to fetch ElevenLabs analytics first
      let elevenLabsData: any = null;
      try {
        const { data: analyticsData, error } = await supabase.functions.invoke('elevenlabs-all-agents-analytics', {
          body: { 
            timeframe: '30days',
            agentId: selectedAgentId !== 'all' ? selectedAgentId : undefined,
            includeCharts: true
          }
        });

        if (!error && analyticsData && !analyticsData.requiresSetup) {
          elevenLabsData = analyticsData;
        }
      } catch (e) {
        console.log('ElevenLabs analytics not available, using local data');
      }

      // Also fetch local conversations and insights for enrichment
      let conversationsQuery = supabase
        .from('conversations')
        .select('id, agent_id, satisfaction_score, sentiment, duration, smart_tags, resolution_status, created_at')
        .eq('organization_id', selectedOrg.id);

      if (selectedAgentId && selectedAgentId !== 'all') {
        conversationsQuery = conversationsQuery.eq('agent_id', selectedAgentId);
      }

      const { data: conversations } = await conversationsQuery;

      let insightsQuery = supabase
        .from('agent_insights')
        .select('agent_id, satisfaction_score, overall_sentiment, improvements, smart_tags')
        .eq('organization_id', selectedOrg.id);

      if (selectedAgentId && selectedAgentId !== 'all') {
        insightsQuery = insightsQuery.eq('agent_id', selectedAgentId);
      }

      const { data: insights } = await insightsQuery;

      // Build agent metrics from both sources
      const agentMetrics: AgentMetrics[] = targetAgents.map(agent => {
        // Check if we have ElevenLabs data for this agent
        const elAgent = elevenLabsData?.perAgent?.find((a: any) => 
          a.id === agent.id || a.agentId === agent.platform_agent_id
        );

        // Local data
        const agentConversations = conversations?.filter(c => c.agent_id === agent.id) || [];
        const agentInsights = insights?.filter(i => i.agent_id === agent.id) || [];

        // Use ElevenLabs data if available, otherwise local
        const totalConversations = elAgent?.metrics?.total_conversations || agentConversations.length;
        
        // Calculate satisfaction from local data if not from ElevenLabs
        let avgSatisfaction = elAgent?.metrics?.satisfaction_score || 0;
        if (!avgSatisfaction && agentConversations.length > 0) {
          const scores = agentConversations.filter(c => c.satisfaction_score).map(c => Number(c.satisfaction_score));
          avgSatisfaction = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        }

        // Duration
        let avgDuration = elAgent?.metrics?.avg_duration || 0;
        if (!avgDuration && agentConversations.length > 0) {
          const durations = agentConversations.filter(c => c.duration).map(c => c.duration as number);
          avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        }

        // Success rate
        const successRate = elAgent?.metrics?.success_rate || 0;

        // Sentiment distribution from local data
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
        const resolutionRate = agentConversations.length > 0 ? (resolved / agentConversations.length) * 100 : successRate;

        // Top tags from local
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
        const improvementCounts: Record<string, number> = {};
        allImprovements.forEach(imp => {
          improvementCounts[imp] = (improvementCounts[imp] || 0) + 1;
        });
        const topImprovements = Object.entries(improvementCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([imp]) => imp);

        // Recent trend
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

        const dataSource = elAgent ? 'elevenlabs' : (agentConversations.length > 0 ? 'local' : 'elevenlabs');

        return {
          agentId: agent.id,
          agentName: agent.name,
          totalConversations,
          avgSatisfaction,
          avgDuration,
          sentimentDistribution: sentimentCounts,
          resolutionRate,
          successRate,
          topTags,
          topImprovements,
          recentTrend,
          dataSource,
        };
      });

      // Global metrics - prefer ElevenLabs if available
      const totalConversations = elevenLabsData?.metrics?.total_conversations || 
        agentMetrics.reduce((sum, a) => sum + a.totalConversations, 0);
      
      const avgSatisfaction = elevenLabsData?.metrics?.satisfaction_score ||
        (agentMetrics.length > 0 
          ? agentMetrics.filter(a => a.avgSatisfaction > 0).reduce((sum, a) => sum + a.avgSatisfaction, 0) / 
            (agentMetrics.filter(a => a.avgSatisfaction > 0).length || 1)
          : 0);

      const totalVoiceMinutes = elevenLabsData?.metrics?.total_voice_minutes ||
        Math.round(agentMetrics.reduce((sum, a) => sum + (a.avgDuration * a.totalConversations / 60), 0));

      const globalSuccessRate = elevenLabsData?.metrics?.success_rate ||
        (agentMetrics.length > 0 ? agentMetrics.reduce((sum, a) => sum + a.successRate, 0) / agentMetrics.length : 0);

      const sortedByPerformance = [...agentMetrics].sort((a, b) => b.avgSatisfaction - a.avgSatisfaction);
      const bestPerformingAgent = sortedByPerformance[0]?.agentName || null;
      const worstPerformingAgent = sortedByPerformance.length > 1 
        ? sortedByPerformance[sortedByPerformance.length - 1]?.agentName 
        : null;

      const dataSource = elevenLabsData ? 'elevenlabs' : 'local';

      return {
        agents: agentMetrics,
        globalMetrics: {
          totalConversations,
          avgSatisfaction,
          totalVoiceMinutes,
          successRate: globalSuccessRate,
          bestPerformingAgent,
          worstPerformingAgent,
        },
        dataSource,
        lastSync: new Date().toISOString(),
      };
    },
    enabled: !!selectedOrg?.id,
    staleTime: 2 * 60 * 1000,
  });
}

function getEmptyReportsData(): AgentReportsData {
  return { 
    agents: [], 
    globalMetrics: { 
      totalConversations: 0, 
      avgSatisfaction: 0, 
      totalVoiceMinutes: 0,
      successRate: 0,
      bestPerformingAgent: null, 
      worstPerformingAgent: null 
    },
    dataSource: 'local',
  };
}
