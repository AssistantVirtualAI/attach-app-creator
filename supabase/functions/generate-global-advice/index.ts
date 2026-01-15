import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bilingual prompt templates
const getSystemPrompt = (language: string) => {
  if (language === 'en') {
    return 'You are an expert in AI agent optimization. Respond only in valid JSON.';
  }
  return 'Tu es un expert en optimisation d\'agents IA. Réponds uniquement en JSON valide.';
};

const getGlobalAnalysisPrompt = (language: string, data: any) => {
  const periodLabel = data.days === 'all' 
    ? (language === 'en' ? 'All time' : 'Tout le temps') 
    : `${data.days} ${language === 'en' ? 'day(s)' : 'jour(s)'}`;

  if (language === 'en') {
    return `You are an expert in AI conversational agent optimization. Analyze this data from ALL agents and generate a consolidated report.

PERIOD: ${periodLabel}
NUMBER OF AGENTS: ${data.agentCount}

GLOBAL METRICS:
- Total conversations: ${data.totalConversations}
- Average satisfaction: ${data.avgSatisfaction.toFixed(1)}/10
- Average duration: ${Math.round(data.avgDuration)}s
- Global sentiment: ${data.positiveCount} positive, ${data.neutralCount} neutral, ${data.negativeCount} negative

PERFORMANCE BY AGENT:
${data.agentPerformance}

BEST AGENT: ${data.bestAgent?.agentName} (${data.bestAgent?.avgSatisfaction.toFixed(1)}/10)
AGENT TO IMPROVE: ${data.worstAgent?.agentName} (${data.worstAgent?.avgSatisfaction.toFixed(1)}/10)

Generate a JSON report with this exact structure:
{
  "globalSummary": "Global summary in 3-4 sentences about all agents performance",
  "overallHealth": "good|warning|critical",
  "keyInsights": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "globalStrengths": ["Global strength 1", "Global strength 2"],
  "globalWeaknesses": ["Global weakness 1", "Global weakness 2"],
  "priorityActions": [
    {"action": "Priority action 1", "agent": "All or specific agent name", "impact": "high"},
    {"action": "Priority action 2", "agent": "All or specific agent name", "impact": "medium"}
  ],
  "agentRecommendations": {
    "${data.bestAgent?.agentName}": "Specific advice for this agent",
    "${data.worstAgent?.agentName}": "Specific advice for this agent"
  }
}`;
  }
  
  return `Tu es un expert en optimisation d'agents IA conversationnels. Analyse ces données de TOUS les agents et génère un rapport consolidé.

PÉRIODE: ${periodLabel}
NOMBRE D'AGENTS: ${data.agentCount}

MÉTRIQUES GLOBALES:
- Total conversations: ${data.totalConversations}
- Satisfaction moyenne: ${data.avgSatisfaction.toFixed(1)}/10
- Durée moyenne: ${Math.round(data.avgDuration)}s
- Sentiment global: ${data.positiveCount} positif, ${data.neutralCount} neutre, ${data.negativeCount} négatif

PERFORMANCE PAR AGENT:
${data.agentPerformance}

MEILLEUR AGENT: ${data.bestAgent?.agentName} (${data.bestAgent?.avgSatisfaction.toFixed(1)}/10)
AGENT À AMÉLIORER: ${data.worstAgent?.agentName} (${data.worstAgent?.avgSatisfaction.toFixed(1)}/10)

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
    "${data.bestAgent?.agentName}": "Conseil spécifique pour cet agent",
    "${data.worstAgent?.agentName}": "Conseil spécifique pour cet agent"
  }
}`;
};

// Fetch all conversations with pagination (no limit)
async function fetchAllOrgConversations(supabaseAdmin: any, organizationId: string, startDate?: Date) {
  const allConversations: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabaseAdmin
      .from('conversations')
      .select('id, agent_id, title, transcript, sentiment, satisfaction_score, duration, smart_tags, resolution_status, created_at, metadata')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching conversations:', error);
      break;
    }

    if (data && data.length > 0) {
      allConversations.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allConversations;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { days = 7, language = 'en' } = await req.json().catch(() => ({}));

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

    console.log(`Generating global advice for organization: ${orgMember.organization_id}, language: ${language}, days: ${days}`);

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

    // Calculate start date (null for "all time")
    let startDate: Date | undefined;
    if (days !== 'all' && days > 0) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // Fetch ALL conversations (no limit)
    const conversations = await fetchAllOrgConversations(supabaseAdmin, orgMember.organization_id, startDate);

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
        const promptData = {
          days,
          agentCount: agents.length,
          totalConversations,
          avgSatisfaction,
          avgDuration,
          positiveCount,
          neutralCount,
          negativeCount,
          agentPerformance: agentMetrics.map(a => 
            `- ${a.agentName}: ${a.totalConversations} conv, ${a.avgSatisfaction.toFixed(1)}/10, ${a.sentiment.positive}+ ${a.sentiment.neutral}= ${a.sentiment.negative}-`
          ).join('\n'),
          bestAgent,
          worstAgent,
        };

        const prompt = getGlobalAnalysisPrompt(language, promptData);

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: getSystemPrompt(language) },
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
      const summaryTemplate = language === 'en'
        ? `${totalConversations} conversations analyzed across ${agents.length} agents. Average satisfaction of ${avgSatisfaction.toFixed(1)}/10.`
        : `${totalConversations} conversations analysées sur ${agents.length} agents. Satisfaction moyenne de ${avgSatisfaction.toFixed(1)}/10.`;

      const insightTemplates = language === 'en' ? [
        `${positiveCount} positive conversations (${((positiveCount / totalConversations) * 100).toFixed(0)}%)`,
        `Average duration of ${Math.round(avgDuration / 60)} minutes`,
        `${agents.length} active agents in the period`
      ] : [
        `${positiveCount} conversations positives (${((positiveCount / totalConversations) * 100).toFixed(0)}%)`,
        `Durée moyenne de ${Math.round(avgDuration / 60)} minutes`,
        `${agents.length} agents actifs dans la période`
      ];

      globalAdvice = {
        globalSummary: summaryTemplate,
        overallHealth: avgSatisfaction >= 7 ? 'good' : avgSatisfaction >= 5 ? 'warning' : 'critical',
        keyInsights: insightTemplates,
        globalStrengths: [],
        globalWeaknesses: [],
        priorityActions: [],
        agentRecommendations: {}
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: { days, from: startDate?.toISOString() || null, to: new Date().toISOString() },
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
