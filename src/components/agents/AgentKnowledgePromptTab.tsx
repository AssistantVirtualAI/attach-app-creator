import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Save, 
  RefreshCw, 
  BookOpen, 
  MessageSquare,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AgentSettings } from '@/hooks/useAgentSettings';

interface AgentKnowledgePromptTabProps {
  agent: AgentSettings;
}

export function AgentKnowledgePromptTab({ agent }: AgentKnowledgePromptTabProps) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbTitle, setKbTitle] = useState('');

  const platformAgentId = (agent.config as Record<string, any>)?.agent_id || agent.platform_agent_id;

  // Récupérer la configuration de l'agent depuis ElevenLabs
  const { data: agentConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['elevenlabs-agent-config', agent.id],
    queryFn: async () => {
      if (!platformAgentId || agent.platform !== 'elevenlabs') {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'get',
          agentId: platformAgentId
        }
      });

      if (error) throw error;
      
      // Initialiser les champs avec les valeurs récupérées
      if (data?.agent) {
        setPrompt(data.agent.conversation_config?.agent?.prompt?.prompt || '');
        setFirstMessage(data.agent.conversation_config?.agent?.first_message || '');
      }
      
      return data;
    },
    enabled: !!platformAgentId && agent.platform === 'elevenlabs',
  });

  // Récupérer la base de connaissances
  const { data: knowledgeBase, isLoading: isLoadingKB } = useQuery({
    queryKey: ['elevenlabs-knowledge-base', agent.id],
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

      if (error) throw error;
      return data;
    },
    enabled: !!platformAgentId && agent.platform === 'elevenlabs',
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
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-agent-config', agent.id] });
    },
    onError: (error: any) => {
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
          content: kbContent
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Contenu ajouté à la base de connaissances');
      setKbTitle('');
      setKbContent('');
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', agent.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de l\'ajout');
    }
  });

  if (agent.platform !== 'elevenlabs') {
    return (
      <Card className="glass-card">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            La synchronisation Knowledge Base & Prompt est disponible uniquement pour les agents ElevenLabs.
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
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
              </CardTitle>
              <CardDescription>
                Modifiez le prompt système et le premier message de l'agent. 
                Les modifications sont synchronisées automatiquement avec ElevenLabs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="system-prompt">Prompt Système</Label>
                    <Textarea
                      id="system-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Vous êtes un assistant virtuel professionnel..."
                      className="min-h-[200px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Instructions générales pour le comportement de l'agent
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="first-message">Premier Message</Label>
                    <Textarea
                      id="first-message"
                      value={firstMessage}
                      onChange={(e) => setFirstMessage(e.target.value)}
                      placeholder="Bonjour ! Comment puis-je vous aider aujourd'hui ?"
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Message d'accueil affiché au début de chaque conversation
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['elevenlabs-agent-config', agent.id] })}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Rafraîchir
                    </Button>
                    <Button
                      onClick={() => updatePrompt.mutate()}
                      disabled={updatePrompt.isPending}
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
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Base de Connaissances
              </CardTitle>
              <CardDescription>
                Ajoutez des documents et informations que l'agent peut utiliser pour répondre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingKB ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Liste des documents existants */}
                  {knowledgeBase?.knowledge_base?.items?.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <Label>Documents existants</Label>
                      <div className="grid gap-2">
                        {knowledgeBase.knowledge_base.items.map((item: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="font-medium">{item.title || `Document ${index + 1}`}</span>
                            </div>
                            <Badge variant="outline">{item.category || 'Général'}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Formulaire d'ajout */}
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-base font-semibold">Ajouter du contenu</Label>
                    
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
                      <Label htmlFor="kb-content">Contenu</Label>
                      <Textarea
                        id="kb-content"
                        value={kbContent}
                        onChange={(e) => setKbContent(e.target.value)}
                        placeholder="Entrez le contenu que l'agent doit connaître..."
                        className="min-h-[200px]"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
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
