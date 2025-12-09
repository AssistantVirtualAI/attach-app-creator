import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useFAQGeneration } from '@/hooks/useFAQGeneration';
import { useCustomKPIs } from '@/hooks/useCustomKPIs';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { FeatureGate } from '@/components/billing/FeatureGate';
import { 
  FileQuestion, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp,
  Calculator,
  Plus,
  Save,
  Target,
  BarChart3,
  MessageSquareWarning
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';

const AgentReports = () => {
  const { selectedOrg } = useOrganization();
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const { faqs, misunderstoodQueries, conversationsAnalyzed, isLoading, isGenerating, regenerateFAQs } = useFAQGeneration(
    selectedAgent !== 'all' ? selectedAgent : undefined
  );
  const { kpis, kpiValues, isCalculating, saveKPI } = useCustomKPIs();
  const { canAccessFeature } = useFeatureAccess();

  // Fetch agents for filter
  const { data: agents } = useQuery({
    queryKey: ['agents-list', selectedOrg?.id],
    queryFn: async () => {
      if (!selectedOrg?.id) return [];
      const { data } = await supabase
        .from('agents')
        .select('id, name')
        .eq('organization_id', selectedOrg.id);
      return data || [];
    },
    enabled: !!selectedOrg?.id
  });

  const categoryColors: Record<string, string> = {
    'Produits': 'bg-blue-500/20 text-blue-400',
    'Services': 'bg-purple-500/20 text-purple-400',
    'Support': 'bg-red-500/20 text-red-400',
    'Facturation': 'bg-green-500/20 text-green-400',
    'Compte': 'bg-yellow-500/20 text-yellow-400',
    'Livraison': 'bg-cyan-500/20 text-cyan-400',
    'Général': 'bg-gray-500/20 text-gray-400'
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Rapports Agents</h1>
            <p className="text-muted-foreground">
              Analyse NLP et génération automatique de FAQs
            </p>
          </div>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tous les agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les agents</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="faq" className="space-y-6">
          <TabsList>
            <TabsTrigger value="faq" className="gap-2">
              <FileQuestion className="h-4 w-4" />
              FAQs Générées
            </TabsTrigger>
            <TabsTrigger value="misunderstood" className="gap-2">
              <MessageSquareWarning className="h-4 w-4" />
              Requêtes Incomprises
            </TabsTrigger>
            <TabsTrigger value="kpis" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              KPIs Personnalisés
            </TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileQuestion className="h-5 w-5" />
                      FAQs Générées Automatiquement
                    </CardTitle>
                    <CardDescription>
                      {conversationsAnalyzed} conversations analysées
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={regenerateFAQs} 
                    disabled={isGenerating}
                    variant="outline"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                    Régénérer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : faqs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune FAQ générée pour le moment</p>
                    <p className="text-sm">Les FAQs seront générées à partir de vos conversations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {faqs.map((faq, index) => (
                      <div 
                        key={index} 
                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={categoryColors[faq.category] || categoryColors['Général']}>
                                {faq.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {faq.frequency}x mentionné
                              </Badge>
                            </div>
                            <h4 className="font-medium mb-2">{faq.question}</h4>
                            <p className="text-sm text-muted-foreground">{faq.answer}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Misunderstood Queries Tab */}
          <TabsContent value="misunderstood" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Requêtes Incomprises
                </CardTitle>
                <CardDescription>
                  Conversations avec sentiment négatif ou faible satisfaction
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : misunderstoodQueries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquareWarning className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune requête incomprise détectée</p>
                    <p className="text-sm">Les agents semblent bien répondre aux questions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {misunderstoodQueries.map((query, index) => (
                      <div 
                        key={index} 
                        className="border border-yellow-500/30 rounded-lg p-4 bg-yellow-500/5"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="destructive" className="text-xs">
                            {query.sentiment || 'négatif'}
                          </Badge>
                          {query.keywords?.map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm">{query.transcript_excerpt}...</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Custom KPIs Tab */}
          <TabsContent value="kpis" className="space-y-6">
            <FeatureGate feature="custom_kpis" showOverlay>
              <div className="grid gap-6 md:grid-cols-3">
                {kpis.map((kpi) => (
                  <Card key={kpi.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        {kpi.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {kpi.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isCalculating ? (
                        <Skeleton className="h-8 w-20" />
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">
                            {kpiValues[kpi.id] || '—'}
                          </span>
                          <span className="text-muted-foreground text-sm">{kpi.unit}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted/50 p-1 rounded">
                        {kpi.formula}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Créer un KPI Personnalisé
                  </CardTitle>
                  <CardDescription>
                    Définissez vos propres métriques avec des formules personnalisées
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nom du KPI</label>
                      <Input placeholder="Ex: Taux de résolution premier contact" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Unité</label>
                      <Input placeholder="Ex: %, sec, /5" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Description</label>
                      <Input placeholder="Description de ce que mesure ce KPI" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Formule</label>
                      <Textarea 
                        placeholder="Ex: COUNT(resolution_status='resolved' AND first_contact=true) / COUNT(*) * 100"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Fonctions disponibles: COUNT, SUM, AVG, MIN, MAX, RATIO
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Objectif (optionnel)</label>
                      <Input type="number" placeholder="Ex: 80" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter le KPI
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AgentReports;
