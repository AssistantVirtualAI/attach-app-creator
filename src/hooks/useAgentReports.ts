import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { format, subDays, startOfDay, getHours, getDay } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  platform: string;
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
  dataSource: 'platform' | 'local' | 'mixed';
}

export interface DailyTrend {
  day: string;
  date: string;
  conversations: number;
  satisfaction: number;
}

export interface HourlyDistribution {
  hour: string;
  conversations: number;
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
  dailyTrends: DailyTrend[];
  hourlyDistribution: HourlyDistribution[];
  peakHour: string;
  quietHour: string;
  busiestDay: string;
  dataSource: 'platform' | 'local' | 'mixed';
  lastSync?: string;
}

interface DateRange {
  start: Date;
  end: Date;
}

const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const FULL_DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FULL_DAY_NAMES_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function useAgentReports(selectedAgentId?: string, dateRange?: DateRange) {
  const { selectedOrg } = useOrganization();
  const { language } = useLanguage();

  const dayNames = language === 'fr' ? DAY_NAMES_FR : DAY_NAMES_EN;
  const fullDayNames = language === 'fr' ? FULL_DAY_NAMES_FR : FULL_DAY_NAMES_EN;

  return useQuery({
    queryKey: ['agent-reports', selectedOrg?.id, selectedAgentId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString(), language],
    queryFn: async (): Promise<AgentReportsData> => {
      if (!selectedOrg?.id) {
        return getEmptyReportsData(language);
      }

      // Fetch agents with their platform info
      const { data: agents } = await supabase
        .from('agents')
        .select('id, name, platform, platform_agent_id, platform_api_key')
        .eq('organization_id', selectedOrg.id);

      if (!agents || agents.length === 0) {
        return getEmptyReportsData(language);
      }

      // Filter by selected agent if provided
      const targetAgents = selectedAgentId && selectedAgentId !== 'all'
        ? agents.filter(a => a.id === selectedAgentId)
        : agents;

      // Fetch local conversations with date filtering
      let conversationsQuery = supabase
        .from('conversations')
        .select('id, agent_id, satisfaction_score, sentiment, duration, smart_tags, resolution_status, created_at, platform')
        .eq('organization_id', selectedOrg.id);

      // Apply date range filter
      if (dateRange) {
        conversationsQuery = conversationsQuery
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString());
      }

      if (selectedAgentId && selectedAgentId !== 'all') {
        conversationsQuery = conversationsQuery.eq('agent_id', selectedAgentId);
      }

      const { data: conversations } = await conversationsQuery;

      // Fetch insights
      let insightsQuery = supabase
        .from('agent_insights')
        .select('agent_id, satisfaction_score, overall_sentiment, improvements, smart_tags')
        .eq('organization_id', selectedOrg.id);

      if (selectedAgentId && selectedAgentId !== 'all') {
        insightsQuery = insightsQuery.eq('agent_id', selectedAgentId);
      }

      const { data: insights } = await insightsQuery;

      // Fetch ElevenLabs analytics for each agent that has platform_agent_id
      const elevenLabsAgents = targetAgents.filter(a => a.platform === 'elevenlabs' && a.platform_agent_id);
      
      // Calculate dynamic timeframe based on date range
      const getTimeframe = () => {
        if (!dateRange) return '7days';
        const diffDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) return '24hours';
        if (diffDays <= 7) return '7days';
        if (diffDays <= 30) return '30days';
        if (diffDays <= 90) return '90days';
        return 'all';
      };

      const platformAnalyticsPromises = elevenLabsAgents.map(async (agent) => {
        try {
          const { data, error } = await supabase.functions.invoke('elevenlabs-convai-analytics', {
            body: { 
              agentId: agent.platform_agent_id,
              timeframe: getTimeframe(),
              includeCharts: true
            }
          });
          
          if (error) {
            console.warn(`Failed to fetch ElevenLabs analytics for ${agent.name}:`, error);
            return { agentId: agent.id, data: null };
          }
          
          return { agentId: agent.id, data };
        } catch (err) {
          console.warn(`Error fetching ElevenLabs analytics for ${agent.name}:`, err);
          return { agentId: agent.id, data: null };
        }
      });

      const platformAnalyticsResults = await Promise.all(platformAnalyticsPromises);
      const platformAnalyticsMap = new Map(
        platformAnalyticsResults.map(r => [r.agentId, r.data])
      );

      // Try to use platform charts when local conversations are empty
      let dailyTrends: DailyTrend[] = calculateDailyTrends(conversations || [], dayNames);
      let hourlyDistribution: HourlyDistribution[] = [];
      let peakHour = '—';
      let quietHour = '—';

      // If local data is empty, try to use platform charts
      if ((conversations?.length || 0) === 0 && platformAnalyticsResults.length > 0) {
        // Aggregate platform chart data
        const platformWithCharts = platformAnalyticsResults.filter(r => r.data?.charts);
        
        if (platformWithCharts.length > 0) {
          // Use conversations_over_time from first available platform
          const firstPlatformCharts = platformWithCharts[0].data.charts;
          
          if (firstPlatformCharts?.conversations_over_time) {
            dailyTrends = firstPlatformCharts.conversations_over_time.slice(-7).map((point: any) => ({
              day: dayNames[new Date(point.date || point.timestamp).getDay()],
              date: new Date(point.date || point.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
              conversations: point.count || point.value || 0,
              satisfaction: point.avg_satisfaction || 0,
            }));
          }
          
          if (firstPlatformCharts?.peak_hours) {
            hourlyDistribution = firstPlatformCharts.peak_hours.map((point: any) => ({
              hour: `${point.hour}h`,
              conversations: point.count || point.value || 0,
            }));
            
            // Find peak and quiet hours from platform data
            const peakData = firstPlatformCharts.peak_hours.reduce((max: any, h: any) => 
              (h.count || h.value || 0) > (max.count || max.value || 0) ? h : max, 
              firstPlatformCharts.peak_hours[0]
            );
            const quietData = firstPlatformCharts.peak_hours.reduce((min: any, h: any) => 
              (h.count || h.value || 0) < (min.count || min.value || 0) ? h : min, 
              firstPlatformCharts.peak_hours[0]
            );
            peakHour = `${peakData?.hour}h`;
            quietHour = `${quietData?.hour}h`;
          }
        }
      } else {
        // Use local data
        const hourlyResult = calculateHourlyDistribution(conversations || []);
        hourlyDistribution = hourlyResult.hourlyDistribution;
        peakHour = hourlyResult.peakHour;
        quietHour = hourlyResult.quietHour;
      }

      // Calculate busiest day
      const busiestDay = calculateBusiestDay(conversations || [], fullDayNames);

      // Build agent metrics combining local + platform data
      const agentMetrics: AgentMetrics[] = targetAgents.map(agent => {
        const agentConversations = conversations?.filter(c => c.agent_id === agent.id) || [];
        const agentInsights = insights?.filter(i => i.agent_id === agent.id) || [];
        const platformData = platformAnalyticsMap.get(agent.id);

        // Use platform data if available, otherwise use local data
        let totalConversations = agentConversations.length;
        let avgSatisfaction = 0;
        let avgDuration = 0;
        let successRate = 0;
        let dataSource: 'platform' | 'local' | 'mixed' = 'local';

        if (platformData?.metrics) {
          // Merge platform data
          totalConversations = Math.max(platformData.metrics.total_conversations || 0, agentConversations.length);
          avgDuration = platformData.metrics.avg_duration || 0;
          successRate = platformData.metrics.success_rate || 0;
          dataSource = agentConversations.length > 0 ? 'mixed' : 'platform';
        }

        // Calculate satisfaction from local data
        if (agentConversations.length > 0) {
          const scores = agentConversations.filter(c => c.satisfaction_score).map(c => Number(c.satisfaction_score));
          avgSatisfaction = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        }

        // Duration from local if not from platform
        if (!platformData?.metrics && agentConversations.length > 0) {
          const durations = agentConversations.filter(c => c.duration).map(c => c.duration as number);
          avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        }

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
        const resolutionRate = agentConversations.length > 0 ? (resolved / agentConversations.length) * 100 : 0;

        // Success rate based on positive sentiment if not from platform
        if (!platformData?.metrics) {
          successRate = totalConversations > 0 
            ? ((sentimentCounts.positive / totalConversations) * 100) 
            : 0;
        }

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

        return {
          agentId: agent.id,
          agentName: agent.name,
          platform: agent.platform || 'unknown',
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

      // Global metrics
      const totalConversations = agentMetrics.reduce((sum, a) => sum + a.totalConversations, 0);
      
      const avgSatisfaction = agentMetrics.length > 0 
        ? agentMetrics.filter(a => a.avgSatisfaction > 0).reduce((sum, a) => sum + a.avgSatisfaction, 0) / 
          (agentMetrics.filter(a => a.avgSatisfaction > 0).length || 1)
        : 0;

      const totalVoiceMinutes = Math.round(agentMetrics.reduce((sum, a) => sum + (a.avgDuration * a.totalConversations / 60), 0));

      const globalSuccessRate = agentMetrics.length > 0 
        ? agentMetrics.reduce((sum, a) => sum + a.successRate, 0) / agentMetrics.length 
        : 0;

      const sortedByPerformance = [...agentMetrics].sort((a, b) => b.avgSatisfaction - a.avgSatisfaction);
      const bestPerformingAgent = sortedByPerformance[0]?.agentName || null;
      const worstPerformingAgent = sortedByPerformance.length > 1 
        ? sortedByPerformance[sortedByPerformance.length - 1]?.agentName 
        : null;

      // Determine overall data source
      const hasPlatformData = agentMetrics.some(a => a.dataSource === 'platform' || a.dataSource === 'mixed');
      const hasLocalData = agentMetrics.some(a => a.dataSource === 'local' || a.dataSource === 'mixed');
      const overallDataSource: 'platform' | 'local' | 'mixed' = 
        hasPlatformData && hasLocalData ? 'mixed' : 
        hasPlatformData ? 'platform' : 'local';

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
        dailyTrends,
        hourlyDistribution,
        peakHour,
        quietHour,
        busiestDay,
        dataSource: overallDataSource,
        lastSync: new Date().toISOString(),
      };
    },
    enabled: !!selectedOrg?.id,
    staleTime: 2 * 60 * 1000,
  });
}

function calculateDailyTrends(conversations: any[], dayNames: string[]): DailyTrend[] {
  const trends: DailyTrend[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = subDays(now, i);
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const dayConversations = conversations.filter(c => {
      const convDate = new Date(c.created_at);
      return convDate >= dayStart && convDate < dayEnd;
    });

    const satisfactionScores = dayConversations
      .filter(c => c.satisfaction_score)
      .map(c => Number(c.satisfaction_score));

    const avgSatisfaction = satisfactionScores.length > 0
      ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
      : 0;

    trends.push({
      day: dayNames[getDay(date)],
      date: format(date, 'dd/MM'),
      conversations: dayConversations.length,
      satisfaction: parseFloat(avgSatisfaction.toFixed(1)),
    });
  }

  return trends;
}

function calculateHourlyDistribution(conversations: any[]): {
  hourlyDistribution: HourlyDistribution[];
  peakHour: string;
  quietHour: string;
} {
  const hourlyCounts: Record<number, number> = {};
  
  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourlyCounts[i] = 0;
  }

  // Count conversations by hour
  conversations.forEach(c => {
    const hour = getHours(new Date(c.created_at));
    hourlyCounts[hour]++;
  });

  const hourlyDistribution: HourlyDistribution[] = Object.entries(hourlyCounts)
    .map(([hour, count]) => ({
      hour: `${hour}h`,
      conversations: count,
    }));

  // Find peak and quiet hours
  let peakHour = '12h';
  let quietHour = '3h';
  let maxCount = 0;
  let minCount = Infinity;

  Object.entries(hourlyCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = `${hour}h`;
    }
    if (count < minCount) {
      minCount = count;
      quietHour = `${hour}h`;
    }
  });

  return { hourlyDistribution, peakHour, quietHour };
}

function calculateBusiestDay(conversations: any[], fullDayNames: string[]): string {
  const dayCounts: Record<number, number> = {};
  
  for (let i = 0; i < 7; i++) {
    dayCounts[i] = 0;
  }

  conversations.forEach(c => {
    const dayIndex = getDay(new Date(c.created_at));
    dayCounts[dayIndex]++;
  });

  let busiestDayIndex = 0;
  let maxCount = 0;

  Object.entries(dayCounts).forEach(([day, count]) => {
    if (count > maxCount) {
      maxCount = count;
      busiestDayIndex = parseInt(day);
    }
  });

  return fullDayNames[busiestDayIndex];
}

function getEmptyReportsData(language: string): AgentReportsData {
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
    dailyTrends: [],
    hourlyDistribution: [],
    peakHour: '—',
    quietHour: '—',
    busiestDay: '—',
    dataSource: 'local',
  };
}
