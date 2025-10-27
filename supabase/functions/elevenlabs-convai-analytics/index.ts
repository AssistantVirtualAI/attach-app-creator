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
    const { agentId, timeframe = '7days', includeRealtime = false, includeCharts = true } = await req.json();
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get ElevenLabs integration
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

    const apiKey = integration.api_key;
    const targetAgentId = agentId || integration.agent_id;

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
        total_conversations: analyticsData.conversations?.total || 0,
        successful_conversations: analyticsData.conversations?.successful || 0,
        failed_conversations: analyticsData.conversations?.failed || 0,
        avg_conversation_duration: analyticsData.conversations?.duration_stats?.average_seconds || 0,
        total_voice_minutes: analyticsData.usage?.voice_minutes || 0,
        satisfaction_score: analyticsData.performance?.satisfaction_score || 0,
        success_rate: analyticsData.conversations?.total > 0 
          ? ((analyticsData.conversations?.successful || 0) / analyticsData.conversations.total * 100)
          : 0,
      },
      trends: {
        conversations_change: analyticsData.trends?.conversations_change || 0,
        duration_change: analyticsData.trends?.duration_change || 0,
        satisfaction_change: analyticsData.trends?.satisfaction_change || 0,
        success_rate_change: analyticsData.trends?.success_rate_change || 0,
      },
      realtime: includeRealtime ? {
        active_conversations: analyticsData.realtime?.active || 0,
        queue_size: analyticsData.realtime?.queue_size || 0,
        system_status: analyticsData.realtime?.status || 'operational',
      } : undefined,
      charts: includeCharts ? {
        conversations_over_time: analyticsData.charts?.conversations_over_time || [],
        satisfaction_trend: analyticsData.charts?.satisfaction_trend || [],
        peak_hours: analyticsData.charts?.peak_hours || [],
      } : undefined,
      raw: analyticsData, // Keep raw data for debugging
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