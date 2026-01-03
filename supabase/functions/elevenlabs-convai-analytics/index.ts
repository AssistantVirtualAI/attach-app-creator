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

    // Call ElevenLabs ConvAI Analytics API
    console.log(`Fetching analytics for agent ${targetAgentId}`);
    
    const analyticsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${targetAgentId}/analytics`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!analyticsResponse.ok) {
      const errorText = await analyticsResponse.text();
      console.error('ElevenLabs API error:', analyticsResponse.status, errorText);
      
      if (analyticsResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            requiresSetup: true, 
            message: 'API Key invalide. Veuillez vérifier votre configuration.' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`ElevenLabs API error: ${analyticsResponse.status} - ${errorText}`);
    }

    const analyticsData = await analyticsResponse.json();

    // Normalize data for frontend
    const normalizedData = {
      metrics: {
        total_conversations: analyticsData.conversations?.total || analyticsData.total_conversations || 0,
        successful_conversations: analyticsData.conversations?.successful || 0,
        failed_conversations: analyticsData.conversations?.failed || 0,
        avg_duration: analyticsData.conversations?.duration_stats?.average_seconds || analyticsData.avg_duration || 0,
        total_duration: analyticsData.usage?.total_seconds || analyticsData.total_duration || 0,
        avg_satisfaction: analyticsData.performance?.satisfaction_score || analyticsData.avg_satisfaction || 0,
        today_conversations: analyticsData.today?.conversations || 0,
        success_rate: analyticsData.conversations?.total > 0 
          ? ((analyticsData.conversations?.successful || 0) / analyticsData.conversations.total * 100)
          : 0,
      },
      trends: {
        conversations: {
          direction: analyticsData.trends?.conversations_change > 0 ? 'up' : analyticsData.trends?.conversations_change < 0 ? 'down' : 'neutral',
          value: analyticsData.trends?.conversations_change ? `${Math.abs(analyticsData.trends.conversations_change)}%` : undefined,
        },
        duration: {
          direction: analyticsData.trends?.duration_change > 0 ? 'up' : analyticsData.trends?.duration_change < 0 ? 'down' : 'neutral',
          value: analyticsData.trends?.duration_change ? `${Math.abs(analyticsData.trends.duration_change)}%` : undefined,
        },
        satisfaction: {
          direction: analyticsData.trends?.satisfaction_change > 0 ? 'up' : analyticsData.trends?.satisfaction_change < 0 ? 'down' : 'neutral',
          value: analyticsData.trends?.satisfaction_change ? `${Math.abs(analyticsData.trends.satisfaction_change)}%` : undefined,
        },
      },
      realtime: includeRealtime ? {
        active_conversations: analyticsData.realtime?.active || 0,
        queue_size: analyticsData.realtime?.queue_size || 0,
        system_status: analyticsData.realtime?.status || 'operational',
      } : undefined,
      charts: includeCharts ? {
        conversations_over_time: analyticsData.charts?.conversations_over_time || analyticsData.daily_stats || [],
        satisfaction_trend: analyticsData.charts?.satisfaction_trend || [],
        peak_hours: analyticsData.charts?.peak_hours || [],
      } : undefined,
      raw: analyticsData,
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
