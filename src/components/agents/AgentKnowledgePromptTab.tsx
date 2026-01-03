import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Save, 
  RefreshCw, 
  BookOpen, 
  MessageSquare,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  FileText,
  Plus,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AgentSettings } from '@/hooks/useAgentSettings';
import { PromptTemplatesSection } from './PromptTemplatesSection';

interface AgentKnowledgePromptTabProps {
  agent: AgentSettings;
}

export function AgentKnowledgePromptTab({ agent }: AgentKnowledgePromptTabProps) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbTitle, setKbTitle] = useState('');
  const [kbCategory, setKbCategory] = useState('Général');
  const [hasChanges, setHasChanges] = useState(false);

  const platformAgentId = (agent.config as Record<string, any>)?.agent_id || agent.platform_agent_id;

  // Récupérer la configuration de l'agent depuis ElevenLabs
  const { data: agentConfig, isLoading: isLoadingConfig, error: configError } = useQuery({
    queryKey: ['elevenlabs-agent-config', agent.id, platformAgentId],
    queryFn: async () => {
      if (!platformAgentId || agent.platform !== 'elevenlabs') {
        return null;
      }

      console.log('[AgentKnowledgePromptTab] Fetching config for agent:', platformAgentId);

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'get',
          agentId: platformAgentId
        }
      });

      if (error) {
        console.error('[AgentKnowledgePromptTab] Error fetching config:', error);
        throw error;
      }
      
      console.log('[AgentKnowledgePromptTab] Config received:', data);
      return data;
    },
    enabled: !!platformAgentId && agent.platform === 'elevenlabs',
    retry: 1,
  });

  // Initialiser les champs avec les valeurs récupérées
  useEffect(() => {
    if (agentConfig?.agent) {
      const agentData = agentConfig.agent;
      const conversationConfig = agentData.conversation_config || {};
      const agentConf = conversationConfig.agent || {};
      
      const newPrompt = agentConf.prompt?.prompt || '';
      const newFirstMessage = agentConf.first_message || '';
      
      setPrompt(newPrompt);
      setFirstMessage(newFirstMessage);
      setHasChanges(false);
    }
  }, [agentConfig]);

  // Récupérer la base de connaissances
  const { data: knowledgeBase, isLoading: isLoadingKB } = useQuery({
    queryKey: ['elevenlabs-knowledge-base', agent.id, platformAgentId],
    queryFn: async () => {
      if (!platformAgentId || agent.platform !== 'elevenlabs') {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'get',
          agentId: platformAgentId
        }
      });

      if (error) {
        console.error('[AgentKnowledgePromptTab] Error fetching KB:', error);
        throw error;
      }
      
      console.log('[AgentKnowledgePromptTab] KB received:', data);
      return data;
    },
    enabled: !!platformAgentId && agent.platform === 'elevenlabs',
    retry: 1,
  });

  // Mutation pour mettre à jour le prompt
  const updatePrompt = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_prompt',
          agentId: platformAgentId,
          prompt,
          firstMessage
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Prompt mis à jour et synchronisé avec ElevenLabs');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-agent-config', agent.id] });
    },
    onError: (error: any) => {
      console.error('[AgentKnowledgePromptTab] Update prompt error:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour du prompt');
    }
  });

  // Mutation pour ajouter du contenu à la base de connaissances
  const addKnowledgeBase = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-knowledge-base', {
        body: { 
          action: 'add',
          agentId: platformAgentId,
          title: kbTitle,
          content: kbContent,
          category: kbCategory
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Contenu ajouté à la base de connaissances');
      setKbTitle('');
      setKbContent('');
      setKbCategory('Général');
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', agent.id] });
    },
    onError: (error: any) => {
      console.error('[AgentKnowledgePromptTab] Add KB error:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout');
    }
  });

  // Mutation pour synchroniser la KB depuis ElevenLabs vers la base locale
  const syncKnowledgeBase = useMutation({
    mutationFn: async () => {
      // Fetch KB from ElevenLabs and save to local DB
      const kbItems = knowledgeBase?.knowledge_base?.items || [];
      
      if (kbItems.length === 0) {
        throw new Error('Aucun document à synchroniser');
      }

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Get organization
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      // Insert/update local KB items
      for (const item of kbItems) {
        const { error } = await supabase
          .from('knowledge_base_items')
          .upsert({
            user_id: user.id,
            organization_id: orgMember?.organization_id,
            title: item.name || item.title || 'Document sans titre',
            content: item.content || 'Contenu non disponible',
            category: item.metadata?.category || item.category || 'Général',
            elevenlabs_id: item.id,
            is_synced: true,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'elevenlabs_id',
            ignoreDuplicates: false
          });
        
        if (error) console.error('[AgentKnowledgePromptTab] Sync error for item:', error);
      }

      return { synced: kbItems.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} documents synchronisés depuis ElevenLabs`);
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', agent.id] });
    },
    onError: (error: any) => {
      console.error('[AgentKnowledgePromptTab] Sync KB error:', error);
      toast.error(error.message || 'Erreur lors de la synchronisation');
    }
  });

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setHasChanges(true);
  };

  const handleFirstMessageChange = (value: string) => {
    setFirstMessage(value);
    setHasChanges(true);
  };

  if (agent.platform !== 'elevenlabs') {
    return (
      <Card className="glass-card">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            La synchronisation Knowledge Base & Prompt est disponible uniquement pour les agents ElevenLabs.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Pour les autres plateformes, configurez directement dans leur interface.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!platformAgentId) {
    return (
      <Card className="glass-card">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            Veuillez configurer l'ID de l'agent ElevenLabs dans l'onglet Config.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            L'ID de l'agent se trouve dans votre dashboard ElevenLabs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      <PromptTemplatesSection 
        agentId={agent.id} 
        platformAgentId={platformAgentId}
        onApplied={() => queryClient.invalidateQueries({ queryKey: ['elevenlabs-agent-config', agent.id] })}
      />
      {/* Status Banner */}
      {configError ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Erreur de connexion à ElevenLabs</p>
            <p className="text-sm text-muted-foreground">Vérifiez la clé API et l'ID de l'agent dans la configuration.</p>
          </div>
        </div>
      ) : agentConfig?.agent && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <div>
            <p className="font-medium text-green-600 dark:text-green-400">Connecté à ElevenLabs</p>
            <p className="text-sm text-muted-foreground">Agent: {agentConfig.agent.name || platformAgentId}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="prompt" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="prompt" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Prompt & Premier Message
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Base de Connaissances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompt" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Configuration du Prompt
                {hasChanges && (
                  <Badge variant="outline" className="ml-2 text-yellow-500 border-yellow-500">
                    Non sauvegardé
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Modifiez le prompt système et le premier message de l'agent. 
                Les modifications sont synchronisées avec ElevenLabs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Chargement de la configuration...</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="system-prompt">Prompt Système</Label>
                    <Textarea
                      id="system-prompt"
                      value={prompt}
                      onChange={(e) => handlePromptChange(e.target.value)}
                      placeholder="Vous êtes un assistant virtuel professionnel..."
                      className="min-h-[250px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Instructions générales pour le comportement de l'agent. Ce texte définit la personnalité et les règles de réponse.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="first-message">Premier Message</Label>
                    <Textarea
                      id="first-message"
                      value={firstMessage}
                      onChange={(e) => handleFirstMessageChange(e.target.value)}
                      placeholder="Bonjour ! Comment puis-je vous aider aujourd'hui ?"
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Message d'accueil affiché/prononcé au début de chaque conversation.
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['elevenlabs-agent-config', agent.id] })}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Rafraîchir
                    </Button>
                    <Button
                      onClick={() => updatePrompt.mutate()}
                      disabled={updatePrompt.isPending || !hasChanges}
                    >
                      {updatePrompt.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Sauvegarder & Sync
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          {/* Contenu existant de la KB */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Base de Connaissances
                  </CardTitle>
                  <CardDescription>
                    Documents et informations que l'agent utilise pour répondre aux questions.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncKnowledgeBase.mutate()}
                  disabled={syncKnowledgeBase.isPending}
                >
                  {syncKnowledgeBase.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Sync depuis ElevenLabs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingKB ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Chargement de la base de connaissances...</span>
                </div>
              ) : (
                <>
                  {/* Liste des documents existants */}
                  <div className="space-y-2">
                    <Label>Documents existants ({knowledgeBase?.knowledge_base?.items?.length || 0})</Label>
                    <ScrollArea className="h-48 border rounded-lg p-2">
                      {knowledgeBase?.knowledge_base?.items?.length > 0 ? (
                        <div className="space-y-2">
                          {knowledgeBase.knowledge_base.items.map((item: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <span className="font-medium">{item.name || item.title || `Document ${index + 1}`}</span>
                                  {item.type && (
                                    <span className="text-xs text-muted-foreground ml-2">({item.type})</span>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline">{item.metadata?.category || item.category || 'Général'}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <BookOpen className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-sm">Aucun document dans la base de connaissances</p>
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Formulaire d'ajout */}
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Ajouter du contenu
                    </Label>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="kb-title">Titre</Label>
                        <Input
                          id="kb-title"
                          value={kbTitle}
                          onChange={(e) => setKbTitle(e.target.value)}
                          placeholder="FAQ Produit, Guide d'utilisation..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kb-category">Catégorie</Label>
                        <Input
                          id="kb-category"
                          value={kbCategory}
                          onChange={(e) => setKbCategory(e.target.value)}
                          placeholder="Général, Produit, Support..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kb-content">Contenu</Label>
                      <Textarea
                        id="kb-content"
                        value={kbContent}
                        onChange={(e) => setKbContent(e.target.value)}
                        placeholder="Entrez le contenu que l'agent doit connaître. Vous pouvez inclure des FAQ, des guides, des informations produit..."
                        className="min-h-[200px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ce contenu sera utilisé par l'agent pour répondre aux questions des utilisateurs.
                      </p>
                    </div>

                    <div className="flex justify-between items-center">
                      <Button
                        variant="outline"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', agent.id] })}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Rafraîchir
                      </Button>
                      <Button
                        onClick={() => addKnowledgeBase.mutate()}
                        disabled={addKnowledgeBase.isPending || !kbTitle || !kbContent}
                      >
                        {addKnowledgeBase.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4 mr-2" />
                        )}
                        Ajouter & Sync
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
