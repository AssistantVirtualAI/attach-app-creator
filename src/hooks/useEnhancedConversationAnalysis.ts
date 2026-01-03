import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SentimentPoint {
  time_percent: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  reason: string;
}

export interface Improvement {
  category: 'tone' | 'response_speed' | 'knowledge' | 'clarity' | 'problem_solving' | 'handoff';
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  example?: string;
  recommended_action?: string;
}

export interface EnhancedConversationAnalysis {
  satisfaction_score: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  sentiment_timeline: SentimentPoint[];
  topics: string[];
  intentions: string[];
  actionItems: string[];
  callMetrics: {
    talkTime: number;
    silenceTime: number;
    interruptionCount: number;
    wordsPerMinute: number;
  };
  summary: string;
  improvements: Improvement[];
}

interface AnalyzeConversationParams {
  conversationId: string;
  agentId?: string;
  organizationId?: string;
  transcript?: string;
}

export const useEnhancedConversationAnalysis = (conversationId: string) => {
  const queryClient = useQueryClient();

  // Récupérer l'analyse existante depuis agent_insights
  const { data: existingInsight, isLoading: isLoadingInsight } = useQuery({
    queryKey: ['agent-insight', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_insights')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching insight:', error);
        return null;
      }
      return data;
    },
    enabled: !!conversationId,
  });

  // Récupérer la conversation pour le fallback
  const { data: conversation } = useQuery({
    queryKey: ['conversation-for-analysis', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('satisfaction_score, sentiment, metadata, agent_id, organization_id')
        .eq('id', conversationId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching conversation:', error);
        return null;
      }
      return data;
    },
    enabled: !!conversationId,
  });

  // Mutation pour générer l'analyse
  const generateAnalysis = useMutation({
    mutationFn: async (params: AnalyzeConversationParams) => {
      // Auto-include agentId and organizationId from conversation if not provided
      const enrichedParams = {
        ...params,
        agentId: params.agentId || conversation?.agent_id,
        organizationId: params.organizationId || conversation?.organization_id,
      };
      
      const { data, error } = await supabase.functions.invoke('analyze-conversation', {
        body: enrichedParams
      });

      if (error) throw error;
      return data.analysis as EnhancedConversationAnalysis;
    },
    onSuccess: () => {
      toast.success('Analyse générée avec succès');
      queryClient.invalidateQueries({ queryKey: ['agent-insight', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-for-analysis', conversationId] });
    },
    onError: (error: any) => {
      console.error('Analysis error:', error);
      if (error.message?.includes('429')) {
        toast.error('Limite de requêtes atteinte, réessayez plus tard');
      } else if (error.message?.includes('402')) {
        toast.error('Crédits IA épuisés');
      } else {
        toast.error('Erreur lors de l\'analyse');
      }
    }
  });

  // Build analysis from best available source
  let analysis: EnhancedConversationAnalysis | null = null;
  
  // Priority 1: agent_insights
  if (existingInsight) {
    analysis = {
      satisfaction_score: Number(existingInsight.satisfaction_score) || 5.0,
      sentiment: (existingInsight.overall_sentiment as 'positive' | 'negative' | 'neutral') || 'neutral',
      confidence: 0.8,
      sentiment_timeline: (existingInsight.sentiment_timeline as unknown as SentimentPoint[]) || [],
      topics: [],
      intentions: [],
      actionItems: [],
      callMetrics: {
        talkTime: 50,
        silenceTime: 10,
        interruptionCount: 0,
        wordsPerMinute: 120
      },
      summary: '',
      improvements: (existingInsight.improvements as unknown as Improvement[]) || []
    };
  }
  // Priority 2: conversation.metadata.aiAnalysis
  else if (conversation?.metadata && (conversation.metadata as any)?.aiAnalysis) {
    const aiAnalysis = (conversation.metadata as any).aiAnalysis;
    analysis = {
      satisfaction_score: aiAnalysis.satisfaction_score || conversation.satisfaction_score || 5.0,
      sentiment: aiAnalysis.sentiment || conversation.sentiment || 'neutral',
      confidence: aiAnalysis.confidence || 0.7,
      sentiment_timeline: aiAnalysis.sentiment_timeline || [],
      topics: aiAnalysis.topics || [],
      intentions: aiAnalysis.intentions || [],
      actionItems: aiAnalysis.actionItems || [],
      callMetrics: aiAnalysis.callMetrics || {
        talkTime: 50,
        silenceTime: 10,
        interruptionCount: 0,
        wordsPerMinute: 120
      },
      summary: aiAnalysis.summary || '',
      improvements: aiAnalysis.improvements || []
    };
  }
  // Priority 3: conversation base fields
  else if (conversation?.satisfaction_score || conversation?.sentiment) {
    analysis = {
      satisfaction_score: Number(conversation.satisfaction_score) || 5.0,
      sentiment: (conversation.sentiment as 'positive' | 'negative' | 'neutral') || 'neutral',
      confidence: 0.5,
      sentiment_timeline: [],
      topics: [],
      intentions: [],
      actionItems: [],
      callMetrics: {
        talkTime: 50,
        silenceTime: 10,
        interruptionCount: 0,
        wordsPerMinute: 120
      },
      summary: '',
      improvements: []
    };
  }

  return {
    analysis,
    isLoading: isLoadingInsight,
    isAnalyzing: generateAnalysis.isPending,
    generateAnalysis: (params: Omit<AnalyzeConversationParams, 'conversationId'>) => 
      generateAnalysis.mutate({ conversationId, ...params }),
    error: generateAnalysis.error,
  };
};

// Hook pour récupérer les insights agrégés d'un agent
export const useAgentInsights = (agentId: string | null) => {
  return useQuery({
    queryKey: ['agent-insights', agentId],
    queryFn: async () => {
      if (!agentId) return null;

      const { data, error } = await supabase
        .from('agent_insights')
        .select('*')
        .eq('agent_id', agentId)
        .order('analyzed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;

      // Calculer les statistiques agrégées
      const insights = data || [];
      const totalConversations = insights.length;
      
      if (totalConversations === 0) {
        return {
          insights: [],
          stats: {
            averageSatisfaction: 0,
            totalConversations: 0,
            improvementsByCategory: {},
            topImprovements: []
          }
        };
      }

      const totalSatisfaction = insights.reduce((sum, i) => 
        sum + (Number(i.satisfaction_score) || 0), 0
      );
      const averageSatisfaction = totalSatisfaction / totalConversations;

      // Agréger les améliorations par catégorie
      const improvementsByCategory: Record<string, number> = {};
      const allImprovements: Improvement[] = [];

      insights.forEach(insight => {
        const improvements = (insight.improvements as unknown as Improvement[]) || [];
        improvements.forEach(imp => {
          improvementsByCategory[imp.category] = (improvementsByCategory[imp.category] || 0) + 1;
          allImprovements.push(imp);
        });
      });

      // Top améliorations les plus fréquentes
      const improvementCount: Record<string, { improvement: Improvement; count: number }> = {};
      allImprovements.forEach(imp => {
        const key = `${imp.category}:${imp.suggestion.substring(0, 50)}`;
        if (!improvementCount[key]) {
          improvementCount[key] = { improvement: imp, count: 0 };
        }
        improvementCount[key].count++;
      });

      const topImprovements = Object.values(improvementCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(item => ({ ...item.improvement, count: item.count }));

      return {
        insights,
        stats: {
          averageSatisfaction,
          totalConversations,
          improvementsByCategory,
          topImprovements
        }
      };
    },
    enabled: !!agentId,
  });
};
