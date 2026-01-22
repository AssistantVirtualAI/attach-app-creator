import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform-specific optimization guidelines
const PLATFORM_GUIDELINES = {
  elevenlabs: {
    name: 'ElevenLabs Conversational AI',
    strengths: [
      'Excellent voice quality and natural intonation',
      'Low-latency responses',
      'Multilingual support',
      'Real-time voice activity detection',
    ],
    promptBestPractices: [
      'Keep responses concise (50-150 words) for natural conversation flow',
      'Use simple sentence structures for better TTS rendering',
      'Avoid complex punctuation that may affect speech patterns',
      'Include explicit pause instructions using "..." for natural breaks',
      'Specify emotional tone explicitly (calm, enthusiastic, professional)',
      'Use phonetic spelling for uncommon words or brand names',
    ],
    turnTakingTips: [
      'Design for interruptions - agent should handle being cut off gracefully',
      'Include backchanneling cues like "I understand" or "Got it"',
      'Keep turns short to allow natural conversation rhythm',
    ],
    avoidPatterns: [
      'Long lists (break into conversational segments)',
      'Technical jargon without explanation',
      'Complex nested conditionals',
      'Emoji or special characters in speech',
    ],
  },
  vapi: {
    name: 'Vapi Voice AI',
    strengths: [
      'Advanced function calling capabilities',
      'Sophisticated call routing',
      'Multiple voice provider support',
      'Real-time transcription',
    ],
    promptBestPractices: [
      'Structure prompts for clear function calling triggers',
      'Define explicit handoff conditions to human agents',
      'Use structured data collection patterns',
      'Include confirmation steps for critical actions',
      'Design for multi-turn tool use scenarios',
    ],
    turnTakingTips: [
      'Configure appropriate silence thresholds',
      'Use explicit confirmation for actions',
      'Design fallback responses for unclear inputs',
    ],
    avoidPatterns: [
      'Vague action triggers',
      'Missing error handling instructions',
      'Undefined edge cases for function calls',
    ],
  },
  retell: {
    name: 'Retell AI',
    strengths: [
      'Enterprise-grade reliability',
      'Custom LLM integration',
      'Advanced analytics',
      'Webhook integrations',
    ],
    promptBestPractices: [
      'Optimize for low-latency LLM responses',
      'Include explicit success/failure criteria',
      'Design for analytics tracking (tag conversations)',
      'Structure for A/B testing different approaches',
      'Use consistent terminology for better analysis',
    ],
    turnTakingTips: [
      'Configure response timing for natural flow',
      'Include explicit conversation ending signals',
      'Design for call transfer scenarios',
    ],
    avoidPatterns: [
      'Inconsistent response lengths',
      'Missing conversation closure patterns',
      'Undefined escalation paths',
    ],
  },
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
      platform = 'elevenlabs',
      organizationId,
      promptSuggestions = [],
      weaknesses = [],
      recommendations = [],
      voiceSettings = {},
      turnSettings = {},
    } = await req.json();

    console.log(`[improve-prompt] Action: ${action}, Platform: ${platform}, AgentId: ${agentId}, Language: ${language}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get platform-specific guidelines
    const platformConfig = PLATFORM_GUIDELINES[platform as keyof typeof PLATFORM_GUIDELINES] || PLATFORM_GUIDELINES.elevenlabs;

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

    // Build platform-specific context
    const platformContext = `
## Platform: ${platformConfig.name}

### Platform Strengths:
${platformConfig.strengths.map((s: string) => `- ${s}`).join('\n')}

### Best Practices for ${platformConfig.name}:
${platformConfig.promptBestPractices.map((p: string) => `- ${p}`).join('\n')}

### Turn-Taking Guidelines:
${platformConfig.turnTakingTips.map((t: string) => `- ${t}`).join('\n')}

### Patterns to Avoid:
${platformConfig.avoidPatterns.map((a: string) => `- ${a}`).join('\n')}

### Current Voice Settings:
- Stability: ${voiceSettings.stability ?? 'default'}
- Similarity: ${voiceSettings.similarity_boost ?? 'default'}
- Style: ${voiceSettings.style ?? 'default'}
- Speed: ${voiceSettings.speed ?? 'default'}

### Current Turn Settings:
- Turn timeout: ${turnSettings.turn_timeout ?? 'default'}s
- Silence timeout: ${turnSettings.silence_end_call_timeout ?? 'default'}s
- Eagerness: ${turnSettings.turn_eagerness ?? 'normal'}
`;

    if (action === 'analyze_and_suggest') {
      console.log('[improve-prompt] Generating platform-specific prompt improvement suggestions');

      const systemPrompt = language === 'en' 
        ? `You are an expert AI prompt engineer specializing in ${platformConfig.name} conversational AI agents. Your task is to analyze the current prompt and suggest platform-specific improvements.

Focus on:
1. Clarity and specificity of instructions
2. Platform-specific optimizations for ${platformConfig.name}
3. Voice and speech pattern considerations
4. Turn-taking and conversation flow
5. Handling edge cases appropriately for voice AI
6. Matching the voice settings (stability, style) with prompt tone

Be specific, actionable, and provide concrete examples. Consider the platform's strengths and limitations.

Respond in English.`
        : `Tu es un expert en ingénierie de prompts IA spécialisé dans les agents conversationnels ${platformConfig.name}. Ta tâche est d'analyser le prompt actuel et de suggérer des améliorations spécifiques à la plateforme.

Concentre-toi sur:
1. La clarté et la précision des instructions
2. Les optimisations spécifiques à ${platformConfig.name}
3. Les considérations de voix et patterns de parole
4. Le flux de conversation et les tours de parole
5. La gestion des cas limites appropriée pour l'IA vocale
6. L'adaptation du prompt aux paramètres de voix (stabilité, style)

Sois spécifique, actionnable et fournis des exemples concrets. Prends en compte les forces et limitations de la plateforme.

Réponds en français.`;

      const userPrompt = `## Current System Prompt:
${currentPrompt || 'No prompt configured'}

## Current First Message:
${currentFirstMessage || 'No first message configured'}

${platformContext}

${adviceContext}

Based on the platform capabilities and conversation analysis above, provide:
1. A list of 3-5 specific improvements for the system prompt, optimized for ${platformConfig.name}
2. A suggested improved version of the system prompt that follows ${platformConfig.name} best practices
3. A suggested improved version of the first message optimized for voice
4. Platform-specific recommendations for voice/turn settings if needed

Format your response as JSON with this structure:
{
  "improvements": [
    {
      "category": "clarity|voice_optimization|turn_taking|edge_cases|platform_specific",
      "issue": "description of the issue",
      "suggestion": "specific suggestion to fix it",
      "priority": "high|medium|low"
    }
  ],
  "improvedPrompt": "the full improved system prompt",
  "improvedFirstMessage": "the improved first message (short, natural for voice)",
  "platformRecommendations": {
    "voiceSettings": { "stability": 0.7, "similarity_boost": 0.8 },
    "turnSettings": { "turn_eagerness": "normal" },
    "notes": "explanation of recommended settings"
  },
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

      console.log('[improve-prompt] Generated platform-specific suggestions successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          suggestions,
          platform,
          platformConfig: {
            name: platformConfig.name,
            strengths: platformConfig.strengths,
          },
          hasAdviceContext: !!adviceContext
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'quick_improve') {
      console.log('[improve-prompt] Quick platform-specific prompt improvement');

      const systemPrompt = language === 'en'
        ? `You are an expert prompt engineer for ${platformConfig.name} voice AI. Improve the given prompt following these platform-specific guidelines:
        
${platformConfig.promptBestPractices.map((p: string) => `- ${p}`).join('\n')}

Keep the same intent and personality but optimize for voice AI conversation. Respond in English.`
        : `Tu es un expert en ingénierie de prompts pour ${platformConfig.name} voix IA. Améliore le prompt donné en suivant ces bonnes pratiques spécifiques à la plateforme:

${platformConfig.promptBestPractices.map((p: string) => `- ${p}`).join('\n')}

Garde la même intention et personnalité mais optimise pour la conversation vocale IA. Réponds en français.`;

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
            { role: 'user', content: `Improve this prompt for ${platformConfig.name}:\n\n${currentPrompt}\n\nAlso improve the first message:\n${currentFirstMessage || 'Hello!'}\n\nRespond as JSON: { "improvedPrompt": "...", "improvedFirstMessage": "..." }` }
          ],
          response_format: { type: 'json_object' },
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
      const content = aiResponse.choices?.[0]?.message?.content;

      let result;
      try {
        result = JSON.parse(content);
      } catch (e) {
        result = { improvedPrompt: content, improvedFirstMessage: currentFirstMessage };
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          improvedPrompt: result.improvedPrompt,
          improvedFirstMessage: result.improvedFirstMessage,
          platform 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_platform_guidelines') {
      // Return platform-specific guidelines for UI display
      return new Response(
        JSON.stringify({ 
          success: true, 
          platform,
          guidelines: platformConfig
        }),
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
