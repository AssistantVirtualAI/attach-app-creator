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
    const { days = 7 } = await req.json().catch(() => ({}));

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY') ?? '';

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log(`Generating global advice for organization: ${orgMember.organization_id}`);

    // Get all agents
    const { data: agents } = await supabaseAdmin
      .from('agents')
      .select('id, name, platform, platform_agent_id')
      .eq('organization_id', orgMember.organization_id);

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No agents found',
        agentAdvice: [],
        globalSummary: null 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get conversations from last N days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id, agent_id, title, transcript, sentiment, satisfaction_score, duration, smart_tags, resolution_status, created_at, metadata')
      .eq('organization_id', orgMember.organization_id)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    // Calculate global metrics
    const totalConversations = conversations?.length || 0;
    const avgSatisfaction = conversations && conversations.length > 0
      ? conversations.filter(c => c.satisfaction_score).reduce((sum, c) => sum + Number(c.satisfaction_score), 0) /
        conversations.filter(c => c.satisfaction_score).length || 0
      : 0;
    const avgDuration = conversations && conversations.length > 0
      ? conversations.filter(c => c.duration).reduce((sum, c) => sum + (c.duration || 0), 0) /
        conversations.filter(c => c.duration).length || 0
      : 0;

    // Sentiment distribution
    let positiveCount = 0, neutralCount = 0, negativeCount = 0;
    conversations?.forEach(c => {
      const s = (c.sentiment || '').toLowerCase();
      if (s.includes('positif') || s === 'positive') positiveCount++;
      else if (s.includes('négatif') || s === 'negative') negativeCount++;
      else neutralCount++;
    });

    // Calculate per-agent metrics
    const agentMetrics = agents.map(agent => {
      const agentConvs = conversations?.filter(c => c.agent_id === agent.id) || [];
      const agentSatisfaction = agentConvs.length > 0
        ? agentConvs.filter(c => c.satisfaction_score).reduce((sum, c) => sum + Number(c.satisfaction_score), 0) /
          agentConvs.filter(c => c.satisfaction_score).length || 0
        : 0;
      const agentDuration = agentConvs.length > 0
        ? agentConvs.filter(c => c.duration).reduce((sum, c) => sum + (c.duration || 0), 0) /
          agentConvs.filter(c => c.duration).length || 0
        : 0;

      let positive = 0, neutral = 0, negative = 0;
      agentConvs.forEach(c => {
        const s = (c.sentiment || '').toLowerCase();
        if (s.includes('positif') || s === 'positive') positive++;
        else if (s.includes('négatif') || s === 'negative') negative++;
        else neutral++;
      });

      const allTags: string[] = [];
      agentConvs.forEach(c => {
        if (Array.isArray(c.smart_tags)) allTags.push(...c.smart_tags);
      });

      const tagCounts: Record<string, number> = {};
      allTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      return {
        agentId: agent.id,
        agentName: agent.name,
        platform: agent.platform,
        totalConversations: agentConvs.length,
        avgSatisfaction: agentSatisfaction,
        avgDuration: agentDuration,
        sentiment: { positive, neutral, negative },
        topTags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count })),
      };
    }).sort((a, b) => b.totalConversations - a.totalConversations);

    const bestAgent = agentMetrics.reduce((best, a) => 
      a.avgSatisfaction > best.avgSatisfaction && a.totalConversations > 0 ? a : best, 
      agentMetrics[0]
    );
    const worstAgent = agentMetrics.reduce((worst, a) => 
      a.avgSatisfaction < worst.avgSatisfaction && a.totalConversations > 0 ? a : worst, 
      agentMetrics[0]
    );

    // Generate global AI advice
    let globalAdvice = null;
    if (lovableApiKey && totalConversations > 0) {
      try {
        const prompt = `Tu es un expert en optimisation d'agents IA conversationnels. Analyse ces données de TOUS les agents et génère un rapport consolidé.

PÉRIODE: ${days} jour(s)
NOMBRE D'AGENTS: ${agents.length}

MÉTRIQUES GLOBALES:
- Total conversations: ${totalConversations}
- Satisfaction moyenne: ${avgSatisfaction.toFixed(1)}/10
- Durée moyenne: ${Math.round(avgDuration)}s
- Sentiment global: ${positiveCount} positif, ${neutralCount} neutre, ${negativeCount} négatif

PERFORMANCE PAR AGENT:
${agentMetrics.map(a => `- ${a.agentName}: ${a.totalConversations} conv, ${a.avgSatisfaction.toFixed(1)}/10, ${a.sentiment.positive}+ ${a.sentiment.neutral}= ${a.sentiment.negative}-`).join('\n')}

MEILLEUR AGENT: ${bestAgent?.agentName} (${bestAgent?.avgSatisfaction.toFixed(1)}/10)
AGENT À AMÉLIORER: ${worstAgent?.agentName} (${worstAgent?.avgSatisfaction.toFixed(1)}/10)

Génère un rapport JSON avec cette structure exacte:
{
  "globalSummary": "Résumé global en 3-4 phrases sur la performance de tous les agents",
  "overallHealth": "good|warning|critical",
  "keyInsights": ["Insight clé 1", "Insight clé 2", "Insight clé 3"],
  "globalStrengths": ["Force globale 1", "Force globale 2"],
  "globalWeaknesses": ["Faiblesse globale 1", "Faiblesse globale 2"],
  "priorityActions": [
    {"action": "Action prioritaire 1", "agent": "Tous ou nom agent spécifique", "impact": "high"},
    {"action": "Action prioritaire 2", "agent": "Tous ou nom agent spécifique", "impact": "medium"}
  ],
  "agentRecommendations": {
    "${bestAgent?.agentName}": "Conseil spécifique pour cet agent",
    "${worstAgent?.agentName}": "Conseil spécifique pour cet agent"
  }
}`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Tu es un expert en optimisation d\'agents IA. Réponds uniquement en JSON valide.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            globalAdvice = JSON.parse(jsonMatch[0]);
          }
        } else if (aiResponse.status === 429) {
          console.log('Rate limited');
        } else if (aiResponse.status === 402) {
          console.log('Credits exhausted');
        }
      } catch (aiError) {
        console.error('AI advice generation error:', aiError);
      }
    }

    // Generate default advice if AI failed
    if (!globalAdvice) {
      globalAdvice = {
        globalSummary: `${totalConversations} conversations analysées sur ${agents.length} agents. Satisfaction moyenne de ${avgSatisfaction.toFixed(1)}/10.`,
        overallHealth: avgSatisfaction >= 7 ? 'good' : avgSatisfaction >= 5 ? 'warning' : 'critical',
        keyInsights: [
          `${positiveCount} conversations positives (${((positiveCount / totalConversations) * 100).toFixed(0)}%)`,
          `Durée moyenne de ${Math.round(avgDuration / 60)} minutes`,
          `${agents.length} agents actifs dans la période`
        ],
        globalStrengths: [],
        globalWeaknesses: [],
        priorityActions: [],
        agentRecommendations: {}
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: { days, from: daysAgo.toISOString(), to: new Date().toISOString() },
        globalMetrics: {
          totalConversations,
          avgSatisfaction,
          avgDuration,
          sentiment: { positive: positiveCount, neutral: neutralCount, negative: negativeCount },
          agentCount: agents.length,
          bestAgent: bestAgent ? { name: bestAgent.agentName, satisfaction: bestAgent.avgSatisfaction } : null,
          worstAgent: worstAgent ? { name: worstAgent.agentName, satisfaction: worstAgent.avgSatisfaction } : null,
        },
        agentMetrics,
        globalAdvice,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate global advice error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
