import { useState, useEffect } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalAgentConfig, usePortalUpdatePrompt } from '@/hooks/usePortalElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileCode, MessageSquare, Eye, Globe, Key, Copy, Save, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const PortalPrompt = () => {
  const { session, canEditPrompt, hasEditAccess } = usePortal();
  const { data: agentConfig, isLoading } = usePortalAgentConfig();
  const updatePrompt = usePortalUpdatePrompt();

  const canEdit = canEditPrompt() || hasEditAccess();

  const [systemPrompt, setSystemPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (agentConfig) {
      const prompt = agentConfig.conversation_config?.agent?.prompt?.prompt || 
                     agentConfig.agent?.prompt?.prompt || '';
      const first = agentConfig.conversation_config?.agent?.first_message || 
                    agentConfig.agent?.first_message || '';
      setSystemPrompt(prompt);
      setFirstMessage(first);
    }
  }, [agentConfig]);

  const handleSave = async () => {
    try {
      await updatePrompt.mutateAsync({ systemPrompt, firstMessage });
      toast.success('Prompt mis à jour avec succès');
      setHasChanges(false);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handlePromptChange = (value: string) => {
    setSystemPrompt(value);
    setHasChanges(true);
  };

  const handleFirstMessageChange = (value: string) => {
    setFirstMessage(value);
    setHasChanges(true);
  };

  const endpoints = [
    { name: 'Widget Embed', url: `${window.location.origin}/iframe/${session?.agentId}` },
    { name: 'Prototype', url: `${window.location.origin}/prototype/${session?.agentId}` },
    { name: 'Agent ID (Supabase)', url: session?.agentId || '' },
    { name: 'Agent ID (ElevenLabs)', url: session?.platformAgentId || '' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
            <FileCode className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prompt & Endpoints</h1>
            <p className="text-muted-foreground">{session?.agentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!canEdit && <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />Lecture seule</Badge>}
          {canEdit && hasChanges && (
            <Button 
              onClick={handleSave} 
              disabled={updatePrompt.isPending}
              className="gap-2"
            >
              {updatePrompt.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Sauvegarder
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !agentConfig && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Configuration non disponible</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Vérifiez que l'agent ElevenLabs est correctement configuré.
            </p>
          </CardContent>
        </Card>
      )}

      {agentConfig && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-primary" />
                  System Prompt
                </CardTitle>
              </CardHeader>
              <CardContent>
                {canEdit ? (
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    className="min-h-[300px] bg-muted/30 border-border/50 font-mono text-sm"
                    placeholder="Entrez le prompt système..."
                  />
                ) : (
                  <div className="min-h-[300px] p-4 rounded-lg bg-muted/30 border border-border/50 font-mono text-sm whitespace-pre-wrap">
                    {systemPrompt || 'Aucun prompt configuré'}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Premier Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                {canEdit ? (
                  <Textarea
                    value={firstMessage}
                    onChange={(e) => handleFirstMessageChange(e.target.value)}
                    className="min-h-[300px] bg-muted/30 border-border/50"
                    placeholder="Entrez le premier message de l'agent..."
                  />
                ) : (
                  <div className="min-h-[300px] p-4 rounded-lg bg-muted/30 border border-border/50 whitespace-pre-wrap">
                    {firstMessage || 'Aucun message configuré'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Endpoints API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {endpoints.filter(e => e.url).map((endpoint) => (
                <div key={endpoint.name} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{endpoint.name}</span>
                  </div>
                  <code className="text-sm truncate max-w-[400px] text-muted-foreground">{endpoint.url}</code>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { 
                      navigator.clipboard.writeText(endpoint.url); 
                      toast.success('Copié'); 
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
};

export default PortalPrompt;
