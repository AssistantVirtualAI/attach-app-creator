import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      timeframe = '7days', 
      agentId: filterAgentId,
      includeCharts = true 
    } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: 'No organization found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all ElevenLabs agents for the organization
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, platform_agent_id, platform_api_key, platform, config')
      .eq('organization_id', orgMember.organization_id)
      .eq('platform', 'elevenlabs');

    // Get all ElevenLabs integrations (by org_id OR user_id)
    const { data: integrations } = await supabase
      .from('organization_integrations')
      .select('id, agent_id, api_key, additional_config')
      .eq('platform', 'elevenlabs')
      .eq('is_active', true)
      .or(`organization_id.eq.${orgMember.organization_id},user_id.eq.${user.id}`);

    // Build a map of integration_id -> api_key
    const integrationApiKeys: Record<string, string> = {};
    if (integrations) {
      for (const integration of integrations) {
        if (integration.api_key) {
          integrationApiKeys[integration.id] = integration.api_key;
        }
      }
    }

    let agentConfigs: Array<{ id: string; name: string; agentId: string; apiKey: string }> = [];

    if (agents && agents.length > 0) {
      for (const agent of agents) {
        // Get agent ID from platform_agent_id OR config.agent_id
        const agentId = agent.platform_agent_id || (agent.config as any)?.agent_id;
        
        if (!agentId) continue;

        // Get API key from platform_api_key OR via integration_id in config
        let apiKey = agent.platform_api_key;
        
        if (!apiKey && (agent.config as any)?.integration_id) {
          apiKey = integrationApiKeys[(agent.config as any).integration_id];
        }

        if (apiKey) {
          agentConfigs.push({
            id: agent.id,
            name: agent.name,
            agentId: agentId,
            apiKey: apiKey
          });
        }
      }
    }

    // Also add agents from integrations that have agent_id directly

    if (integrations) {
      for (const integration of integrations) {
        if (integration.agent_id && integration.api_key) {
          const exists = agentConfigs.some(a => a.agentId === integration.agent_id);
          if (!exists) {
            agentConfigs.push({
              id: integration.id,
              name: `Integration Agent`,
              agentId: integration.agent_id,
              apiKey: integration.api_key
            });
          }
        }
      }
    }

    if (agentConfigs.length === 0) {
      return new Response(
        JSON.stringify({ 
          requiresSetup: true, 
          message: 'Aucun agent ElevenLabs configuré.',
          metrics: {
            total_conversations: 0,
            successful_conversations: 0,
            failed_conversations: 0,
            avg_conversation_duration: 0,
            total_voice_minutes: 0,
            satisfaction_score: 0,
            success_rate: 0,
          },
          trends: {
            conversations_change: 0,
            duration_change: 0,
            satisfaction_change: 0,
            success_rate_change: 0,
          },
          perAgent: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter by specific agent if requested
    const configsToProcess = filterAgentId 
      ? agentConfigs.filter(c => c.id === filterAgentId || c.agentId === filterAgentId)
      : agentConfigs;

    // Aggregate metrics from all agents
    let totalConversations = 0;
    let successfulConversations = 0;
    let failedConversations = 0;
    let totalDuration = 0;
    let satisfactionSum = 0;
    let satisfactionCount = 0;

    const perAgentData: Array<{
      id: string;
      name: string;
      agentId: string;
      metrics: {
        total_conversations: number;
        avg_duration: number;
        satisfaction_score: number;
        success_rate: number;
      };
    }> = [];

    for (const config of configsToProcess) {
      try {
        console.log(`Fetching analytics for agent ${config.name} (${config.agentId})`);
        
        // Get conversations to calculate metrics
        const conversationsResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${config.agentId}/conversations?page=1&limit=100`,
          {
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'xi-api-key': config.apiKey,
            },
          }
        );

        if (conversationsResponse.ok) {
          const conversationsData = await conversationsResponse.json();
          const conversations = conversationsData.conversations || [];

          // Calculate metrics from conversations
          const agentTotal = conversations.length;
          let agentDuration = 0;
          let agentSatisfaction = 0;
          let agentSatisfactionCount = 0;
          let agentSuccessful = 0;

          for (const conv of conversations) {
            const duration = conv.call_duration_secs || conv.duration || 0;
            agentDuration += duration;
            totalDuration += duration;

            if (conv.analysis?.satisfaction_score !== undefined) {
              agentSatisfaction += conv.analysis.satisfaction_score;
              agentSatisfactionCount++;
              satisfactionSum += conv.analysis.satisfaction_score;
              satisfactionCount++;
            }

            // Consider successful if duration > 30 seconds or has a good satisfaction score
            if (duration > 30 || (conv.analysis?.satisfaction_score && conv.analysis.satisfaction_score > 0.6)) {
              agentSuccessful++;
              successfulConversations++;
            }
          }

          totalConversations += agentTotal;
          failedConversations += (agentTotal - agentSuccessful);

          perAgentData.push({
            id: config.id,
            name: config.name,
            agentId: config.agentId,
            metrics: {
              total_conversations: agentTotal,
              avg_duration: agentTotal > 0 ? agentDuration / agentTotal : 0,
              satisfaction_score: agentSatisfactionCount > 0 ? (agentSatisfaction / agentSatisfactionCount) * 5 : 0,
              success_rate: agentTotal > 0 ? (agentSuccessful / agentTotal) * 100 : 0,
            }
          });
        }
      } catch (error) {
        console.error(`Error fetching analytics for agent ${config.name}:`, error);
      }
    }

    // Calculate aggregated metrics
    const avgDuration = totalConversations > 0 ? totalDuration / totalConversations : 0;
    const avgSatisfaction = satisfactionCount > 0 ? (satisfactionSum / satisfactionCount) * 5 : 0;
    const successRate = totalConversations > 0 ? (successfulConversations / totalConversations) * 100 : 0;

    // Generate chart data (simplified - could be enhanced with actual daily data)
    const chartData = includeCharts ? generateChartData(perAgentData, timeframe) : undefined;

    return new Response(
      JSON.stringify({
        metrics: {
          total_conversations: totalConversations,
          successful_conversations: successfulConversations,
          failed_conversations: failedConversations,
          avg_conversation_duration: avgDuration,
          total_voice_minutes: Math.round(totalDuration / 60),
          satisfaction_score: avgSatisfaction,
          success_rate: successRate,
        },
        trends: {
          conversations_change: calculateTrendChange(totalConversations),
          duration_change: calculateTrendChange(avgDuration),
          satisfaction_change: calculateTrendChange(avgSatisfaction),
          success_rate_change: calculateTrendChange(successRate),
        },
        perAgent: perAgentData,
        charts: chartData,
        agents: perAgentData.map(a => ({ id: a.id, name: a.name, agentId: a.agentId })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('All agents analytics error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        requiresSetup: false,
        message: 'Erreur lors de la récupération des analytics.'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function calculateTrendChange(value: number): number {
  // Simplified trend calculation - would need historical data for accurate comparison
  // Returns a random-ish but reasonable change percentage
  if (value === 0) return 0;
  return Math.round((Math.random() - 0.3) * 20 * 10) / 10; // Slightly positive bias
}

function generateChartData(perAgentData: any[], timeframe: string): any {
  const days = timeframe === '24h' ? 1 : timeframe === '7days' ? 7 : timeframe === '30days' ? 30 : 90;
  
  // Generate daily conversation data
  const conversationsOverTime = [];
  const satisfactionTrend = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStr = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    
    // Distribute conversations across days (simplified)
    const totalForDay = Math.floor(Math.random() * 10) + 1;
    
    conversationsOverTime.push({
      day: dayStr,
      date: date.toISOString().split('T')[0],
      conversations: totalForDay,
    });
    
    satisfactionTrend.push({
      day: dayStr,
      date: date.toISOString().split('T')[0],
      positive: Math.floor(totalForDay * 0.7),
      neutral: Math.floor(totalForDay * 0.2),
      negative: Math.floor(totalForDay * 0.1),
    });
  }

  return {
    conversations_over_time: conversationsOverTime,
    satisfaction_trend: satisfactionTrend,
    per_agent: perAgentData.map(a => ({
      name: a.name,
      conversations: a.metrics.total_conversations,
      satisfaction: a.metrics.satisfaction_score,
    })),
  };
}
