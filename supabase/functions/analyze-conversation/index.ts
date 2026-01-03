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
      {
        global: {
          headers: { Authorization: authHeader },
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

const { 
      conversationId, 
      externalConversationId,
      agentId: providedAgentId, 
      organizationId: providedOrgId, 
      transcript: externalTranscript,
      platformAgentId
    } = await req.json();
    
    // Support both internal conversationId and external (ElevenLabs) conversationId
    const effectiveConversationId = conversationId || externalConversationId;
    const isExternalConversation = !conversationId && !!externalConversationId;
    
    console.log(`[analyze-conversation] Starting analysis for ${isExternalConversation ? 'external' : 'internal'} conversation ${effectiveConversationId}`);
    console.log(`[analyze-conversation] Provided agentId: ${providedAgentId}, orgId: ${providedOrgId}, platformAgentId: ${platformAgentId}`);

    let conversation: any = null;
    let agentId = providedAgentId;
    let organizationId = providedOrgId;

    // For internal conversations, fetch from database
    if (!isExternalConversation && effectiveConversationId) {
      const { data: convData, error: convError } = await serviceClient
        .from('conversations')
        .select('*')
        .eq('id', effectiveConversationId)
        .single();

      if (convError) {
        console.error('[analyze-conversation] Error fetching conversation:', convError);
      } else {
        conversation = convData;
        console.log('[analyze-conversation] Conversation loaded successfully');
        agentId = agentId || conversation?.agent_id;
        organizationId = organizationId || conversation?.organization_id;
      }
    }

    // If we have a platformAgentId but no agentId, try to find the agent
    if (!agentId && platformAgentId) {
      const { data: agentData } = await serviceClient
        .from('agents')
        .select('id, organization_id')
        .eq('platform_agent_id', platformAgentId)
        .single();
      
      if (agentData) {
        agentId = agentData.id;
        organizationId = organizationId || agentData.organization_id;
        console.log(`[analyze-conversation] Found agent from platformAgentId: ${agentId}`);
      }
    }

    console.log(`[analyze-conversation] Using agentId: ${agentId}, orgId: ${organizationId}`);

    console.log(`[analyze-conversation] Using agentId: ${agentId}, orgId: ${organizationId}`);

    // Build transcript from best available source
    let transcriptText = externalTranscript;
    
    if (!transcriptText && conversation) {
      const meta = conversation.metadata as any;
      
      // Priority 1: metadata.transcript (structured)
      if (meta?.transcript && Array.isArray(meta.transcript)) {
        transcriptText = meta.transcript.map((msg: any) => {
          const role = msg.role === 'agent' ? 'Agent' : 'Client';
          const text = msg.message || msg.text || msg.content || '';
          return `${role}: ${text}`;
        }).join('\n');
        console.log('[analyze-conversation] Using metadata.transcript');
      }
      // Priority 2: user_messages + agent_messages
      else if ((conversation.user_messages?.length || 0) > 0 || (conversation.agent_messages?.length || 0) > 0) {
        const userMsgs = conversation.user_messages || [];
        const agentMsgs = conversation.agent_messages || [];
        const combined: string[] = [];
        const maxLen = Math.max(userMsgs.length, agentMsgs.length);
        
        for (let i = 0; i < maxLen; i++) {
          if (i < agentMsgs.length && agentMsgs[i]) {
            const msg = typeof agentMsgs[i] === 'string' ? agentMsgs[i] : (agentMsgs[i] as any)?.message || '';
            if (msg) combined.push(`Agent: ${msg}`);
          }
          if (i < userMsgs.length && userMsgs[i]) {
            const msg = typeof userMsgs[i] === 'string' ? userMsgs[i] : (userMsgs[i] as any)?.message || '';
            if (msg) combined.push(`Client: ${msg}`);
          }
        }
        transcriptText = combined.join('\n');
        console.log('[analyze-conversation] Using user_messages + agent_messages');
      }
      // Priority 3: transcript string
      else if (conversation.transcript && typeof conversation.transcript === 'string') {
        transcriptText = conversation.transcript;
        console.log('[analyze-conversation] Using transcript string');
      }
    }

    if (!transcriptText) {
      console.log('[analyze-conversation] No transcript available');
      return new Response(JSON.stringify({ 
        error: 'No transcript available',
        analysis: getDefaultAnalysis()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Lovable AI for analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[analyze-conversation] LOVABLE_API_KEY not configured');
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
  "smart_tags": ["tag1", "tag2"],
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

SMART TAGS - Catégorise la conversation avec un ou plusieurs tags parmi:
- "reclamation": Le client exprime une plainte, insatisfaction ou problème
- "demande_info": Le client pose des questions pour obtenir des informations
- "achat": Le client souhaite acheter, connaître les prix ou passer commande
- "support_technique": Problème technique, bug, panne ou installation
- "rendez_vous": Prise de rendez-vous, réservation, disponibilité
- "facturation": Questions sur factures, paiements, remboursements
- "rappel": Le client demande à être rappelé
- "autre": Autre type de conversation

Catégories d'amélioration possibles:
- tone: Ton et empathie de l'agent
- response_speed: Temps de réponse ou réactivité
- knowledge: Lacunes dans les connaissances ou base de données
- clarity: Clarté des explications
- problem_solving: Capacité à résoudre le problème
- handoff: Gestion du transfert vers un humain

Sois précis et constructif. Fournis au moins 1 amélioration si tu identifies des points à améliorer.
Réponds UNIQUEMENT avec du JSON valide, sans texte additionnel.`;

    console.log('[analyze-conversation] Calling Lovable AI...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
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
      console.error('[analyze-conversation] Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded, please try again later',
          analysis: getDefaultAnalysis()
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI credits exhausted, please add funds',
          analysis: getDefaultAnalysis()
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
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
    
    console.log('[analyze-conversation] AI response received, parsing...');

    // Parse AI response
    let analysis;
    try {
      let cleanJson = analysisText;
      cleanJson = cleanJson.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : getDefaultAnalysis();
      
      analysis = {
        ...getDefaultAnalysis(),
        ...analysis,
        satisfaction_score: analysis.satisfaction_score || 5.0,
        sentiment_timeline: analysis.sentiment_timeline || [],
        improvements: analysis.improvements || [],
        smart_tags: analysis.smart_tags || ['autre']
      };
    } catch (e) {
      console.error('[analyze-conversation] Failed to parse AI response:', e);
      analysis = getDefaultAnalysis();
    }

    console.log('[analyze-conversation] Analysis completed:', {
      satisfaction: analysis.satisfaction_score,
      sentiment: analysis.sentiment,
      improvements: analysis.improvements?.length || 0,
      smartTags: analysis.smart_tags
    });

    // Update internal conversation if we have one
    if (!isExternalConversation && effectiveConversationId) {
      const { error: updateError } = await serviceClient
        .from('conversations')
        .update({ 
          satisfaction_score: analysis.satisfaction_score,
          sentiment: analysis.sentiment,
          smart_tags: analysis.smart_tags,
          metadata: {
            ...(conversation?.metadata || {}),
            aiAnalysis: analysis,
            analyzedAt: new Date().toISOString()
          }
        })
        .eq('id', effectiveConversationId);

      if (updateError) {
        console.error('[analyze-conversation] Failed to update conversation:', updateError);
      } else {
        console.log('[analyze-conversation] Conversation updated successfully');
      }
    }

    // Always save to agent_insights when we have agentId and organizationId
    if (agentId && organizationId && effectiveConversationId) {
      console.log('[analyze-conversation] Saving to agent_insights...');
      
      const { error: insightError } = await serviceClient
        .from('agent_insights')
        .upsert({
          agent_id: agentId,
          conversation_id: effectiveConversationId,
          organization_id: organizationId,
          satisfaction_score: analysis.satisfaction_score,
          sentiment_timeline: analysis.sentiment_timeline,
          overall_sentiment: analysis.sentiment,
          improvements: analysis.improvements,
          smart_tags: analysis.smart_tags,
          analyzed_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id'
        });

      if (insightError) {
        console.error('[analyze-conversation] Failed to save agent insights:', insightError);
      } else {
        console.log('[analyze-conversation] Agent insights saved successfully');
      }

      // Send alert for low satisfaction
      if (analysis.satisfaction_score < 5) {
        console.log(`[analyze-conversation] Low satisfaction detected (${analysis.satisfaction_score}), sending alert...`);
        
        const { data: agentData } = await serviceClient
          .from('agents')
          .select('name')
          .eq('id', agentId)
          .single();

        try {
          const alertResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-satisfaction-alert`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                conversationId,
                agentId,
                organizationId,
                satisfactionScore: analysis.satisfaction_score,
                agentName: agentData?.name,
                summary: analysis.summary
              })
            }
          );

          if (alertResponse.ok) {
            console.log('[analyze-conversation] Satisfaction alert sent successfully');
          } else {
            console.error('[analyze-conversation] Failed to send alert:', await alertResponse.text());
          }
        } catch (alertError) {
          console.error('[analyze-conversation] Error sending satisfaction alert:', alertError);
        }
      }
    } else {
      console.log('[analyze-conversation] No agentId/orgId available, skipping agent_insights save');
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-conversation] Error:', error);
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
    smart_tags: ['autre'],
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
