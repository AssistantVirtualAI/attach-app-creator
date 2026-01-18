import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      action, 
      agentId, 
      currentPrompt, 
      currentFirstMessage,
      language = 'fr',
      organizationId,
      promptSuggestions = [],
      weaknesses = [],
      recommendations = []
    } = await req.json();

    console.log(`[improve-prompt] Action: ${action}, AgentId: ${agentId}, Language: ${language}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the latest AI advice for this agent to understand context
    let adviceContext = '';
    if (organizationId && agentId) {
      const { data: latestAdvice } = await supabase
        .from('agent_daily_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('agent_id', agentId)
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAdvice) {
        const strengths = Array.isArray(latestAdvice.strengths) ? latestAdvice.strengths : [];
        const weaknessesList = Array.isArray(latestAdvice.weaknesses) ? latestAdvice.weaknesses : [];
        const promptSuggestionsList = latestAdvice.prompt_suggestions || [];
        const kbSuggestions = latestAdvice.kb_suggestions || [];
        
        adviceContext = `
## Recent Conversation Analysis:
- Total conversations analyzed: ${latestAdvice.total_conversations || 0}
- Average satisfaction score: ${latestAdvice.avg_satisfaction || 'N/A'}
- Success rate: ${latestAdvice.success_rate || 'N/A'}%

### Strengths identified:
${strengths.map((s: string) => `- ${s}`).join('\n') || 'None identified'}

### Weaknesses identified:
${weaknessesList.map((w: string) => `- ${w}`).join('\n') || 'None identified'}

### Existing prompt suggestions:
${promptSuggestionsList.map((p: string) => `- ${p}`).join('\n') || 'None available'}

### Knowledge base suggestions:
${kbSuggestions.map((k: string) => `- ${k}`).join('\n') || 'None available'}

### Summary:
${latestAdvice.summary || 'No summary available'}
`;
      }
    }

    // If suggestions/weaknesses/recommendations are passed directly, use them
    if (promptSuggestions.length > 0 || weaknesses.length > 0 || recommendations.length > 0) {
      adviceContext = `
## AI Analysis from Conversation Data:

### Weaknesses identified:
${weaknesses.map((w: string) => `- ${w}`).join('\n') || 'None identified'}

### Prompt Suggestions:
${promptSuggestions.map((p: string) => `- ${p}`).join('\n') || 'None available'}

### Recommendations:
${recommendations.map((r: any) => `- [${r.priority}] ${r.action}: ${r.impact}`).join('\n') || 'None available'}
`;
    }

    if (action === 'analyze_and_suggest') {
      console.log('[improve-prompt] Generating prompt improvement suggestions');

      const systemPrompt = language === 'en' 
        ? `You are an expert AI prompt engineer specializing in conversational AI agents. Your task is to analyze the current prompt and suggest specific improvements based on conversation analysis data.

Be specific, actionable, and provide concrete examples of how to improve the prompt. Focus on:
1. Clarity and specificity of instructions
2. Handling edge cases and difficult scenarios
3. Improving response quality and user satisfaction
4. Adding missing capabilities or guardrails
5. Optimizing tone and communication style

Respond in English.`
        : `Tu es un expert en ingénierie de prompts IA spécialisé dans les agents conversationnels. Ta tâche est d'analyser le prompt actuel et de suggérer des améliorations spécifiques basées sur les données d'analyse des conversations.

Sois spécifique, actionnable et fournis des exemples concrets d'amélioration du prompt. Concentre-toi sur:
1. La clarté et la précision des instructions
2. La gestion des cas limites et des scénarios difficiles
3. L'amélioration de la qualité des réponses et de la satisfaction utilisateur
4. L'ajout de capacités ou de garde-fous manquants
5. L'optimisation du ton et du style de communication

Réponds en français.`;

      const userPrompt = `## Current System Prompt:
${currentPrompt || 'No prompt configured'}

## Current First Message:
${currentFirstMessage || 'No first message configured'}

${adviceContext}

Based on the conversation analysis above, provide:
1. A list of 3-5 specific improvements for the system prompt
2. A suggested improved version of the system prompt
3. A suggested improved version of the first message (if applicable)

Format your response as JSON with this structure:
{
  "improvements": [
    {
      "issue": "description of the issue",
      "suggestion": "specific suggestion to fix it",
      "priority": "high|medium|low"
    }
  ],
  "improvedPrompt": "the full improved system prompt",
  "improvedFirstMessage": "the improved first message",
  "summary": "brief summary of key changes made"
}`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const errorText = await response.text();
        console.error('[improve-prompt] AI gateway error:', response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      let suggestions;
      try {
        suggestions = JSON.parse(content);
      } catch (e) {
        console.error('[improve-prompt] Failed to parse AI response:', content);
        throw new Error('Failed to parse AI suggestions');
      }

      console.log('[improve-prompt] Generated suggestions successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          suggestions,
          hasAdviceContext: !!adviceContext
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'quick_improve') {
      // Quick improvement without full analysis - just improve based on best practices
      console.log('[improve-prompt] Quick prompt improvement');

      const systemPrompt = language === 'en'
        ? `You are an expert prompt engineer. Improve the given prompt to be clearer, more specific, and more effective for a conversational AI agent. Keep the same intent and personality but enhance clarity and handling of edge cases. Respond in English.`
        : `Tu es un expert en ingénierie de prompts. Améliore le prompt donné pour qu'il soit plus clair, plus spécifique et plus efficace pour un agent conversationnel IA. Garde la même intention et personnalité mais améliore la clarté et la gestion des cas limites. Réponds en français.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Improve this prompt:\n\n${currentPrompt}\n\nRespond with only the improved prompt, no explanations.` }
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limits exceeded.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`AI error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const improvedPrompt = aiResponse.choices?.[0]?.message?.content;

      return new Response(
        JSON.stringify({ success: true, improvedPrompt }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('[improve-prompt] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
