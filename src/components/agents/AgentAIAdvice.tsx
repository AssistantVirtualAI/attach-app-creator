import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Lightbulb,
  Target,
  MessageSquare,
  BookOpen,
  TrendingUp,
  Clock,
  Zap
} from 'lucide-react';
import { useLatestAgentAdvice, useGenerateAgentAdvice, AgentDailyReport } from '@/hooks/useAgentAdvice';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AgentAIAdviceProps {
  agentId: string;
  agentName: string;
}

const priorityColors = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const effortImpactBadge = (effort: string, impact: string) => {
  if (impact === 'high' && effort === 'low') return 'bg-green-500/20 text-green-400';
  if (impact === 'high' && effort === 'medium') return 'bg-blue-500/20 text-blue-400';
  if (impact === 'high' && effort === 'high') return 'bg-purple-500/20 text-purple-400';
  if (impact === 'medium') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-muted text-muted-foreground';
};

export function AgentAIAdvice({ agentId, agentName }: AgentAIAdviceProps) {
  const [days, setDays] = useState<number>(1);
  const { data: advice, isLoading } = useLatestAgentAdvice(agentId);
  const { mutate: generateAdvice, isPending: isGenerating } = useGenerateAgentAdvice();

  const handleGenerate = () => {
    generateAdvice({ agentId, days });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Conseils IA pour {agentName}
          </h3>
          <p className="text-sm text-muted-foreground">
            Analyse automatique des conversations et recommandations d'optimisation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">24 heures</SelectItem>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Générer conseils
          </Button>
        </div>
      </div>

      {!advice ? (
        <Card className="glass-card">
          <CardContent className="pt-6 text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun rapport disponible</p>
            <p className="text-sm text-muted-foreground mb-4">
              Cliquez sur "Générer conseils" pour analyser les conversations récentes
            </p>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? 'Analyse en cours...' : 'Générer le premier rapport'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Card */}
          <Card className="glass-card border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Résumé
                </CardTitle>
                <div className="text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {formatDistanceToNow(new Date(advice.generated_at), { addSuffix: true, locale: fr })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{advice.summary}</p>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold">{advice.total_conversations}</p>
                  <p className="text-xs text-muted-foreground">Conversations</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{advice.avg_satisfaction?.toFixed(1) || '—'}</p>
                  <p className="text-xs text-muted-foreground">Satisfaction</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{advice.success_rate?.toFixed(0) || '—'}%</p>
                  <p className="text-xs text-muted-foreground">Résolution</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{advice.avg_duration_seconds ? Math.round(advice.avg_duration_seconds / 60) : '—'}m</p>
                  <p className="text-xs text-muted-foreground">Durée moy.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strengths & Weaknesses */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-green-500">
                  <CheckCircle className="h-5 w-5" />
                  Points forts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {advice.strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {advice.strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun point fort identifié</p>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-yellow-500">
                  <AlertTriangle className="h-5 w-5" />
                  Points à améliorer
                </CardTitle>
              </CardHeader>
              <CardContent>
                {advice.weaknesses.length > 0 ? (
                  <ul className="space-y-2">
                    {advice.weaknesses.map((weakness, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun point faible identifié</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Priority Actions */}
          {advice.priority_actions.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Actions prioritaires
                </CardTitle>
                <CardDescription>Triées par impact/effort</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {advice.priority_actions.map((action, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-primary">#{i + 1}</span>
                        <span className="text-sm">{action.action}</span>
                      </div>
                      <Badge className={effortImpactBadge(action.effort, action.impact)}>
                        {action.impact === 'high' ? 'Impact fort' : action.impact === 'medium' ? 'Impact moyen' : 'Impact faible'}
                        {' / '}
                        {action.effort === 'low' ? 'Effort faible' : action.effort === 'medium' ? 'Effort moyen' : 'Effort élevé'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {advice.recommendations.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Recommandations détaillées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {advice.recommendations.map((rec, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={priorityColors[rec.priority]}>
                          {rec.priority === 'high' ? 'Priorité haute' : rec.priority === 'medium' ? 'Priorité moyenne' : 'Priorité basse'}
                        </Badge>
                        <Badge variant="outline">{rec.category}</Badge>
                      </div>
                      <p className="font-medium mb-1">{rec.action}</p>
                      <p className="text-sm text-muted-foreground">{rec.impact}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prompt & KB Suggestions */}
          <div className="grid gap-4 md:grid-cols-2">
            {advice.prompt_suggestions.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Suggestions de prompt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {advice.prompt_suggestions.map((suggestion, i) => (
                      <li key={i} className="text-sm p-2 rounded bg-muted/50">
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {advice.kb_suggestions.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Suggestions Knowledge Base
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {advice.kb_suggestions.map((suggestion, i) => (
                      <li key={i} className="text-sm p-2 rounded bg-muted/50">
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
