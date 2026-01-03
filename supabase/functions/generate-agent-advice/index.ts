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
    const { agentId, days = 1 } = await req.json();

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

    // Get agent info
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('id, name, platform, platform_agent_id, config')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating advice for agent: ${agent.name}`);

    // Get recent conversations
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id, title, transcript, sentiment, satisfaction_score, duration, smart_tags, resolution_status, created_at, metadata')
      .eq('agent_id', agentId)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Get recent insights
    const { data: insights } = await supabaseAdmin
      .from('agent_insights')
      .select('satisfaction_score, overall_sentiment, improvements, smart_tags')
      .eq('agent_id', agentId)
      .gte('created_at', daysAgo.toISOString())
      .limit(50);

    // Calculate basic metrics
    const totalConversations = conversations?.length || 0;
    const avgSatisfaction = conversations && conversations.length > 0
      ? conversations.filter(c => c.satisfaction_score).reduce((sum, c) => sum + Number(c.satisfaction_score), 0) / 
        conversations.filter(c => c.satisfaction_score).length
      : 0;
    const avgDuration = conversations && conversations.length > 0
      ? conversations.filter(c => c.duration).reduce((sum, c) => sum + (c.duration || 0), 0) / 
        conversations.filter(c => c.duration).length
      : 0;
    const resolvedCount = conversations?.filter(c => c.resolution_status === 'resolved').length || 0;
    const successRate = totalConversations > 0 ? (resolvedCount / totalConversations) * 100 : 0;

    // Collect all improvements and tags
    const allImprovements: string[] = [];
    const allTags: string[] = [];
    
    insights?.forEach(i => {
      if (Array.isArray(i.improvements)) {
        i.improvements.forEach((imp: any) => {
          if (typeof imp === 'string') allImprovements.push(imp);
          else if (imp?.suggestion) allImprovements.push(imp.suggestion);
        });
      }
      if (Array.isArray(i.smart_tags)) {
        allTags.push(...i.smart_tags);
      }
    });

    conversations?.forEach(c => {
      if (Array.isArray(c.smart_tags)) {
        allTags.push(...c.smart_tags);
      }
    });

    // Count frequencies
    const improvementCounts: Record<string, number> = {};
    allImprovements.forEach(imp => {
      improvementCounts[imp] = (improvementCounts[imp] || 0) + 1;
    });

    const tagCounts: Record<string, number> = {};
    allTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    // Sentiment distribution
    let positiveCount = 0, neutralCount = 0, negativeCount = 0;
    conversations?.forEach(c => {
      const s = (c.sentiment || '').toLowerCase();
      if (s.includes('positif') || s === 'positive') positiveCount++;
      else if (s.includes('négatif') || s === 'negative') negativeCount++;
      else neutralCount++;
    });

    // Prepare conversation summaries for AI analysis
    const conversationSummaries = conversations?.slice(0, 20).map(c => ({
      sentiment: c.sentiment,
      satisfaction: c.satisfaction_score,
      duration: c.duration,
      tags: c.smart_tags,
      resolution: c.resolution_status,
      summary: (c.metadata as any)?.summary || (c.metadata as any)?.aiAnalysis?.summary || null
    })) || [];

    // Generate AI advice
    let aiAdvice = null;
    if (lovableApiKey && totalConversations > 0) {
      try {
        const prompt = `Tu es un expert en optimisation d'agents IA conversationnels. Analyse ces données et génère un rapport structuré.

AGENT: ${agent.name}
PÉRIODE: ${days} jour(s)

MÉTRIQUES:
- Conversations: ${totalConversations}
- Satisfaction moyenne: ${avgSatisfaction.toFixed(1)}/10
- Durée moyenne: ${Math.round(avgDuration)}s
- Taux de résolution: ${successRate.toFixed(0)}%
- Sentiment: ${positiveCount} positif, ${neutralCount} neutre, ${negativeCount} négatif

TAGS FRÉQUENTS: ${Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, c]) => `${t} (${c})`).join(', ') || 'Aucun'}

AMÉLIORATIONS DÉJÀ IDENTIFIÉES: ${Object.entries(improvementCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([i, c]) => `${i} (${c}x)`).join('; ') || 'Aucune'}

ÉCHANTILLON DE CONVERSATIONS:
${JSON.stringify(conversationSummaries, null, 2)}

Génère un rapport JSON avec cette structure exacte:
{
  "summary": "Résumé en 2-3 phrases",
  "strengths": ["Force 1", "Force 2", "Force 3"],
  "weaknesses": ["Faiblesse 1", "Faiblesse 2"],
  "recommendations": [
    {"priority": "high", "category": "prompt", "action": "Action concrète", "impact": "Impact attendu"},
    {"priority": "medium", "category": "knowledge", "action": "Action concrète", "impact": "Impact attendu"}
  ],
  "prompt_suggestions": ["Suggestion modification prompt 1"],
  "kb_suggestions": ["Ajouter documentation sur X"],
  "priority_actions": [
    {"action": "Action prioritaire 1", "effort": "low", "impact": "high"},
    {"action": "Action prioritaire 2", "effort": "medium", "impact": "high"}
  ]
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
          
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiAdvice = JSON.parse(jsonMatch[0]);
          }
        } else if (aiResponse.status === 429) {
          console.log('Rate limited, using default advice');
        } else if (aiResponse.status === 402) {
          console.log('Credits exhausted, using default advice');
        }
      } catch (aiError) {
        console.error('AI advice generation error:', aiError);
      }
    }

    // Create report data
    const reportData = {
      agent_id: agentId,
      organization_id: orgMember.organization_id,
      report_date: new Date().toISOString().split('T')[0],
      total_conversations: totalConversations,
      avg_satisfaction: avgSatisfaction || null,
      avg_duration_seconds: Math.round(avgDuration) || null,
      success_rate: successRate || null,
      summary: aiAdvice?.summary || `${totalConversations} conversations analysées. Satisfaction moyenne: ${avgSatisfaction.toFixed(1)}/10.`,
      strengths: aiAdvice?.strengths || [],
      weaknesses: aiAdvice?.weaknesses || [],
      recommendations: aiAdvice?.recommendations || [],
      prompt_suggestions: aiAdvice?.prompt_suggestions || [],
      kb_suggestions: aiAdvice?.kb_suggestions || [],
      priority_actions: aiAdvice?.priority_actions || [],
      conversations_analyzed: totalConversations,
      generated_at: new Date().toISOString(),
    };

    // Upsert report
    const { data: savedReport, error: saveError } = await supabaseAdmin
      .from('agent_daily_reports')
      .upsert(reportData, { onConflict: 'agent_id,report_date' })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving report:', saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        report: savedReport || reportData,
        metrics: {
          totalConversations,
          avgSatisfaction,
          avgDuration,
          successRate,
          sentimentDistribution: { positive: positiveCount, neutral: neutralCount, negative: negativeCount },
          topTags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
          topImprovements: Object.entries(improvementCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate advice error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
