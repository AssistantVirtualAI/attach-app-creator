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

  // Mutation pour générer l'analyse
  const generateAnalysis = useMutation({
    mutationFn: async (params: AnalyzeConversationParams) => {
      const { data, error } = await supabase.functions.invoke('analyze-conversation', {
        body: params
      });

      if (error) throw error;
      return data.analysis as EnhancedConversationAnalysis;
    },
    onSuccess: (data) => {
      toast.success('Analyse générée avec succès');
      // Invalider les caches
      queryClient.invalidateQueries({ queryKey: ['agent-insight', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
    },
    onError: (error) => {
      console.error('Analysis error:', error);
      toast.error('Erreur lors de l\'analyse');
    }
  });

  // Construire l'analyse à partir de l'insight existant
  const analysis: EnhancedConversationAnalysis | null = existingInsight ? {
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
  } : null;

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
