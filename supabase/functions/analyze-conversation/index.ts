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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { conversationId } = await req.json();
    
    console.log(`Analyzing conversation ${conversationId}`);

    // Récupérer la conversation depuis la DB
    const { data: conversation, error: convError } = await supabaseClient
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      console.error('Conversation not found:', convError);
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Préparer le transcript pour l'analyse
    const transcriptText = conversation.transcript || 
      (conversation.user_messages || []).map((m: any, i: number) => 
        `${i % 2 === 0 ? 'Client' : 'Agent'}: ${m}`
      ).join('\n');

    if (!transcriptText) {
      return new Response(JSON.stringify({ 
        error: 'No transcript available',
        analysis: getDefaultAnalysis()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Appeler Lovable AI pour analyser
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

    const analysisPrompt = `Analyze this conversation transcript and provide a structured analysis in JSON format.

Conversation Transcript:
${transcriptText.substring(0, 4000)} // Limiter pour éviter les tokens excessifs

Required JSON structure:
{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": 0.0 to 1.0,
  "topics": ["topic1", "topic2", "topic3"],
  "intentions": ["intention1", "intention2"],
  "actionItems": ["action1", "action2"],
  "callMetrics": {
    "talkTime": percentage (0-100),
    "silenceTime": percentage (0-100),
    "interruptionCount": number,
    "wordsPerMinute": number
  },
  "summary": "Brief summary of the conversation in French"
}

Respond ONLY with valid JSON, no additional text.`;

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
            content: 'You are an AI assistant specialized in analyzing customer service conversations. Always respond with valid JSON only.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.3,
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
      // Extraire le JSON s'il est entouré de texte
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : getDefaultAnalysis();
    } catch (e) {
      console.error('Failed to parse AI response:', e, analysisText);
      analysis = getDefaultAnalysis();
    }

    // Mettre à jour la conversation avec l'analyse
    const { error: updateError } = await supabaseClient
      .from('conversations')
      .update({ 
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
    sentiment: 'neutral',
    confidence: 0.5,
    topics: ['conversation'],
    intentions: ['demande d\'information'],
    actionItems: [],
    callMetrics: {
      talkTime: 50,
      silenceTime: 10,
      interruptionCount: 0,
      wordsPerMinute: 120
    },
    summary: 'Analyse non disponible'
  };
}
