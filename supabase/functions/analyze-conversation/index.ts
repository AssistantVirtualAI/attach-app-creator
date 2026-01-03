import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { conversationId, agentId, organizationId, transcript: externalTranscript } = await req.json();
    
    console.log(`Analyzing conversation ${conversationId}`);

    // Déterminer la source du transcript
    let transcriptText = externalTranscript;
    let conversation = null;

    // Si pas de transcript externe, chercher dans la DB
    if (!transcriptText) {
      const { data: convData, error: convError } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (!convError && convData) {
        conversation = convData;
        transcriptText = convData.transcript || 
          (convData.user_messages || []).map((m: any, i: number) => 
            `${i % 2 === 0 ? 'Client' : 'Agent'}: ${m}`
          ).join('\n');
      }
    }

    if (!transcriptText) {
      return new Response(JSON.stringify({ 
        error: 'No transcript available',
        analysis: getDefaultAnalysis()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Appeler Lovable AI pour analyser avec le nouveau prompt enrichi
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'AI service not configured',
        analysis: getDefaultAnalysis()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const analysisPrompt = `Tu es un expert en analyse de conversations client. Analyse cette conversation et fournis une évaluation complète en JSON.

Transcript de la conversation:
${transcriptText.substring(0, 6000)}

Fournis une analyse JSON avec cette structure EXACTE:
{
  "satisfaction_score": <nombre de 1.0 à 10.0 - évalue la satisfaction globale du client>,
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": <0.0 à 1.0>,
  "sentiment_timeline": [
    {"time_percent": 0, "sentiment": "neutral", "reason": "Début de conversation"},
    {"time_percent": 50, "sentiment": "positive" | "negative" | "neutral", "reason": "Explication courte"},
    {"time_percent": 100, "sentiment": "positive" | "negative" | "neutral", "reason": "Fin de conversation"}
  ],
  "topics": ["sujet1", "sujet2"],
  "intentions": ["intention1", "intention2"],
  "actionItems": ["action1", "action2"],
  "callMetrics": {
    "talkTime": <pourcentage 0-100>,
    "silenceTime": <pourcentage 0-100>,
    "interruptionCount": <nombre>,
    "wordsPerMinute": <nombre estimé>
  },
  "summary": "Résumé bref de la conversation en français (max 2 phrases)",
  "improvements": [
    {
      "category": "tone" | "response_speed" | "knowledge" | "clarity" | "problem_solving" | "handoff",
      "priority": "high" | "medium" | "low",
      "suggestion": "Description de l'amélioration suggérée",
      "example": "Exemple concret tiré de la conversation qui illustre le problème",
      "recommended_action": "Action spécifique à mettre en place"
    }
  ]
}

Catégories d'amélioration possibles:
- tone: Ton et empathie de l'agent
- response_speed: Temps de réponse ou réactivité
- knowledge: Lacunes dans les connaissances ou base de données
- clarity: Clarté des explications
- problem_solving: Capacité à résoudre le problème
- handoff: Gestion du transfert vers un humain

Sois précis et constructif. Fournis au moins 1 amélioration si tu identifies des points à améliorer.
Réponds UNIQUEMENT avec du JSON valide, sans texte additionnel.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un expert en analyse de conversations service client. Tu fournis des analyses précises et des recommandations actionnables. Réponds toujours en JSON valide uniquement.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'AI analysis failed',
        analysis: getDefaultAnalysis()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices[0]?.message?.content || '{}';
    
    // Parser le JSON de la réponse IA
    let analysis;
    try {
      // Extraire le JSON s'il est entouré de texte ou de markdown
      let cleanJson = analysisText;
      // Retirer les blocs de code markdown
      cleanJson = cleanJson.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : getDefaultAnalysis();
      
      // S'assurer que tous les champs existent
      analysis = {
        ...getDefaultAnalysis(),
        ...analysis,
        satisfaction_score: analysis.satisfaction_score || 5.0,
        sentiment_timeline: analysis.sentiment_timeline || [],
        improvements: analysis.improvements || []
      };
    } catch (e) {
      console.error('Failed to parse AI response:', e, analysisText);
      analysis = getDefaultAnalysis();
    }

    console.log('Analysis completed:', {
      satisfaction: analysis.satisfaction_score,
      sentiment: analysis.sentiment,
      improvements: analysis.improvements?.length || 0
    });

    // Mettre à jour la conversation avec l'analyse si elle existe en DB
    if (conversation) {
      const { error: updateError } = await supabaseClient
        .from('conversations')
        .update({ 
          satisfaction_score: analysis.satisfaction_score,
          sentiment: analysis.sentiment,
          metadata: {
            ...conversation.metadata,
            aiAnalysis: analysis,
            analyzedAt: new Date().toISOString()
          }
        })
        .eq('id', conversationId);

      if (updateError) {
        console.error('Failed to update conversation:', updateError);
      }
    }

    // Sauvegarder les insights dans agent_insights si agentId et organizationId fournis
    if (agentId && organizationId) {
      try {
        const { error: insightError } = await serviceClient
          .from('agent_insights')
          .upsert({
            agent_id: agentId,
            conversation_id: conversationId,
            organization_id: organizationId,
            satisfaction_score: analysis.satisfaction_score,
            sentiment_timeline: analysis.sentiment_timeline,
            overall_sentiment: analysis.sentiment,
            improvements: analysis.improvements,
            analyzed_at: new Date().toISOString()
          }, {
            onConflict: 'conversation_id'
          });

        if (insightError) {
          console.error('Failed to save agent insights:', insightError);
        } else {
          console.log('Agent insights saved successfully');
        }
      } catch (e) {
        console.error('Error saving agent insights:', e);
      }
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-conversation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      analysis: getDefaultAnalysis()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getDefaultAnalysis() {
  return {
    satisfaction_score: 5.0,
    sentiment: 'neutral',
    confidence: 0.5,
    sentiment_timeline: [
      { time_percent: 0, sentiment: 'neutral', reason: 'Début' },
      { time_percent: 100, sentiment: 'neutral', reason: 'Fin' }
    ],
    topics: ['conversation'],
    intentions: ['demande d\'information'],
    actionItems: [],
    callMetrics: {
      talkTime: 50,
      silenceTime: 10,
      interruptionCount: 0,
      wordsPerMinute: 120
    },
    summary: 'Analyse non disponible',
    improvements: []
  };
}
