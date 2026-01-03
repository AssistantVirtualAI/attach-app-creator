import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: orgMember } = await serviceClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: 'No organization found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organizationId = orgMember.organization_id;

    // Get date ranges
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch insights from last 30 days
    const { data: insights, error: insightsError } = await serviceClient
      .from('agent_insights')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('analyzed_at', thirtyDaysAgo)
      .order('analyzed_at', { ascending: false });

    if (insightsError) {
      console.error('Error fetching insights:', insightsError);
      throw insightsError;
    }

    // Fetch total conversations count
    const { count: totalConversations } = await serviceClient
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', thirtyDaysAgo);

    const allInsights = insights || [];
    const recentInsights = allInsights.filter(i => 
      new Date(i.analyzed_at || '').getTime() >= new Date(sevenDaysAgo).getTime()
    );

    // Calculate metrics
    const calcMetrics = (data: typeof allInsights) => {
      if (data.length === 0) {
        return {
          avgSatisfaction: 0,
          sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
          count: 0
        };
      }

      const avgSatisfaction = data.reduce((sum, i) => 
        sum + (Number(i.satisfaction_score) || 0), 0
      ) / data.length;

      const sentimentBreakdown = {
        positive: data.filter(i => i.overall_sentiment === 'positive').length,
        neutral: data.filter(i => i.overall_sentiment === 'neutral').length,
        negative: data.filter(i => i.overall_sentiment === 'negative').length,
      };

      return { avgSatisfaction, sentimentBreakdown, count: data.length };
    };

    const metrics7d = calcMetrics(recentInsights);
    const metrics30d = calcMetrics(allInsights);

    // Aggregate smart tags
    const tagCounts: Record<string, number> = {};
    allInsights.forEach(insight => {
      const tags = (insight.smart_tags as string[]) || [];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    // Aggregate improvements by category
    const improvementCounts: Record<string, number> = {};
    const topImprovements: Array<{ category: string; suggestion: string; count: number }> = [];
    const improvementMap: Record<string, { suggestion: string; count: number }> = {};

    allInsights.forEach(insight => {
      const improvements = (insight.improvements as any[]) || [];
      improvements.forEach(imp => {
        if (imp.category) {
          improvementCounts[imp.category] = (improvementCounts[imp.category] || 0) + 1;
          
          const key = `${imp.category}:${(imp.suggestion || '').substring(0, 50)}`;
          if (!improvementMap[key]) {
            improvementMap[key] = { suggestion: imp.suggestion || '', count: 0 };
          }
          improvementMap[key].count++;
        }
      });
    });

    const sortedImprovements = Object.entries(improvementMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([key, value]) => ({
        category: key.split(':')[0],
        suggestion: value.suggestion,
        count: value.count
      }));

    // Coverage rate
    const coverageRate = totalConversations ? 
      Math.round((allInsights.length / totalConversations) * 100) : 0;

    const response = {
      period7d: {
        avgSatisfaction: Math.round(metrics7d.avgSatisfaction * 10) / 10,
        sentimentBreakdown: metrics7d.sentimentBreakdown,
        analyzedCount: metrics7d.count
      },
      period30d: {
        avgSatisfaction: Math.round(metrics30d.avgSatisfaction * 10) / 10,
        sentimentBreakdown: metrics30d.sentimentBreakdown,
        analyzedCount: metrics30d.count
      },
      topTags,
      topImprovements: sortedImprovements,
      improvementsByCategory: improvementCounts,
      coverageRate,
      totalConversations: totalConversations || 0,
      lastAnalyzedAt: allInsights[0]?.analyzed_at || null
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[dashboard-insights] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
