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
    const { agentId, timeframe = '7days', includeRealtime = false, includeCharts = true, apiKey: providedApiKey } = await req.json();
    
    let apiKey = providedApiKey;
    let targetAgentId = agentId;
    
    // If no API key provided directly, try to get from user's integration
    if (!apiKey) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'API key or authorization required' }), {
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

      const { data: integration, error: integrationError } = await supabase
        .from('organization_integrations')
        .select('api_key, agent_id, additional_config')
        .eq('user_id', user.id)
        .eq('platform', 'elevenlabs')
        .eq('is_active', true)
        .single();

      if (integrationError || !integration) {
        return new Response(
          JSON.stringify({ 
            requiresSetup: true, 
            message: 'Configuration ElevenLabs requise. Veuillez configurer votre API Key dans les paramètres.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      apiKey = integration.api_key;
      targetAgentId = agentId || integration.agent_id;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetAgentId) {
      return new Response(
        JSON.stringify({ 
          requiresSetup: true, 
          message: 'Agent ID requis. Veuillez le configurer dans les paramètres.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching analytics for agent ${targetAgentId} via conversations`);
    
    // ElevenLabs doesn't have a dedicated analytics endpoint
    // We need to fetch conversations and calculate analytics from them
    const conversationsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${targetAgentId}&page_size=100`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!conversationsResponse.ok) {
      const errorText = await conversationsResponse.text();
      console.error('ElevenLabs API error:', conversationsResponse.status, errorText);
      
      if (conversationsResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            requiresSetup: true, 
            message: 'API Key invalide. Veuillez vérifier votre configuration.' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // If 404, return empty analytics instead of error
      if (conversationsResponse.status === 404) {
        console.log('No conversations found, returning empty analytics');
        return new Response(
          JSON.stringify({
            metrics: {
              total_conversations: 0,
              successful_conversations: 0,
              failed_conversations: 0,
              avg_duration: 0,
              total_duration: 0,
              avg_satisfaction: 0,
              today_conversations: 0,
              success_rate: 0,
            },
            trends: {},
            charts: includeCharts ? {
              conversations_over_time: [],
              satisfaction_trend: [],
              peak_hours: [],
            } : undefined,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`ElevenLabs API error: ${conversationsResponse.status} - ${errorText}`);
    }

    const conversationsData = await conversationsResponse.json();
    const conversations = conversationsData.conversations || [];
    
    console.log(`Retrieved ${conversations.length} conversations for analytics`);

    // Calculate analytics from conversations
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    let totalDuration = 0;
    let todayConversations = 0;
    let successfulConversations = 0;
    let failedConversations = 0;
    const dailyStats: Record<string, number> = {};
    const hourlyStats: Record<number, number> = {};
    
    for (const conv of conversations) {
      // Calculate duration
      const duration = conv.call_duration_secs || conv.duration || 0;
      totalDuration += duration;
      
      // Check if today
      const convDate = new Date(conv.start_time_unix_secs ? conv.start_time_unix_secs * 1000 : conv.created_at);
      if (convDate >= todayStart) {
        todayConversations++;
      }
      
      // Count success/failure
      if (conv.status === 'done' || conv.status === 'completed') {
        successfulConversations++;
      } else if (conv.status === 'failed' || conv.status === 'error') {
        failedConversations++;
      } else {
        // Consider others as successful for now
        successfulConversations++;
      }
      
      // Daily stats for charts
      const dateKey = convDate.toISOString().split('T')[0];
      dailyStats[dateKey] = (dailyStats[dateKey] || 0) + 1;
      
      // Peak hours
      const hour = convDate.getHours();
      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
    }
    
    const totalConversations = conversations.length;
    const avgDuration = totalConversations > 0 ? Math.round(totalDuration / totalConversations) : 0;
    const successRate = totalConversations > 0 ? Math.round((successfulConversations / totalConversations) * 100) : 0;
    
    // Build charts data
    const conversationsOverTime = Object.entries(dailyStats)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 14 days
    
    const peakHours = Object.entries(hourlyStats)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const normalizedData = {
      metrics: {
        total_conversations: totalConversations,
        successful_conversations: successfulConversations,
        failed_conversations: failedConversations,
        avg_duration: avgDuration,
        total_duration: totalDuration,
        avg_satisfaction: 0, // Not available from ElevenLabs directly
        today_conversations: todayConversations,
        success_rate: successRate,
      },
      trends: {
        conversations: {
          direction: 'neutral' as const,
          value: undefined,
        },
        duration: {
          direction: 'neutral' as const,
          value: undefined,
        },
        satisfaction: {
          direction: 'neutral' as const,
          value: undefined,
        },
      },
      realtime: includeRealtime ? {
        active_conversations: 0,
        queue_size: 0,
        system_status: 'operational',
      } : undefined,
      charts: includeCharts ? {
        conversations_over_time: conversationsOverTime,
        satisfaction_trend: [],
        peak_hours: peakHours,
      } : undefined,
    };

    return new Response(
      JSON.stringify(normalizedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analytics error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        requiresSetup: false,
        message: 'Erreur lors de la récupération des analytics. Veuillez réessayer.' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
