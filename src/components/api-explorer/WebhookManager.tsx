import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Loader2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { useAllAgents } from '@/hooks/useAllAgents';
import { useAgentPlatformWebhooks, PLATFORM_WEBHOOK_EVENTS, PlatformWebhookInput } from '@/hooks/useAgentPlatformWebhooks';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface WebhookManagerProps {
  defaultAgentId?: string;
}

export const WebhookManager = ({ defaultAgentId }: WebhookManagerProps) => {
  const { language } = useLanguage();
  const { data: agentsData, isLoading: loadingAgents } = useAllAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgentId || '');
  const { webhooks, isLoading, addWebhook, updateWebhook, deleteWebhook, toggleWebhook, generateWebhookUrl, refetch } = useAgentPlatformWebhooks(selectedAgentId);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fetchingPlatformWebhooks, setFetchingPlatformWebhooks] = useState(false);
  const [platformWebhooks, setPlatformWebhooks] = useState<Record<string, unknown> | null>(null);
  
  const [formData, setFormData] = useState<PlatformWebhookInput>({
    platform: 'elevenlabs',
    webhook_url: '',
    webhook_secret: '',
    events: [],
  });

  const selectedAgent = agentsData?.agents.find(a => a.id === selectedAgentId);
  const availableEvents = PLATFORM_WEBHOOK_EVENTS[formData.platform] || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(language === 'fr' ? 'Copié' : 'Copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddWebhook = async () => {
    await addWebhook.mutateAsync(formData);
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      platform: 'elevenlabs',
      webhook_url: '',
      webhook_secret: '',
      events: [],
    });
  };

  const toggleEvent = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId) 
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  };

  const fetchPlatformWebhooks = async () => {
    if (!selectedAgent) return;
    
    setFetchingPlatformWebhooks(true);
    try {
      // Get agent details with API key
      const { data: agent } = await supabase
        .from('agents')
        .select('platform_api_key, platform_agent_id')
        .eq('id', selectedAgentId)
        .single();

      if (!agent?.platform_api_key) {
        toast.error(language === 'fr' ? 'Clé API non configurée' : 'API key not configured');
        return;
      }

      // Fetch webhooks from platform based on agent's platform
      const functionMap: Record<string, string> = {
        elevenlabs: 'elevenlabs-convai-agent-config',
        vapi: 'vapi-proxy',
        retell: 'retell-proxy',
      };

      const { data, error } = await supabase.functions.invoke(functionMap[selectedAgent.platform] || 'connector-proxy', {
        body: {
          action: 'get',
          apiKey: agent.platform_api_key,
          agentId: agent.platform_agent_id,
        },
      });

      if (error) throw error;
      
      // Extract webhook config from platform response
      const webhookConfig = data?.webhook_config || data?.webhooks || data?.agent?.webhook || null;
      setPlatformWebhooks(webhookConfig);
      
      toast.success(language === 'fr' ? 'Webhooks récupérés' : 'Webhooks fetched from platform');
    } catch (error) {
      console.error('Error fetching platform webhooks:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la récupération' : 'Failed to fetch webhooks');
    } finally {
      setFetchingPlatformWebhooks(false);
    }
  };

  const texts = {
    title: language === 'fr' ? 'Gestion des Webhooks' : 'Webhook Management',
    description: language === 'fr' 
      ? 'Configurez les webhooks pour chaque agent et plateforme'
      : 'Configure webhooks for each agent and platform',
    selectAgent: language === 'fr' ? 'Sélectionner un agent' : 'Select an agent',
    addWebhook: language === 'fr' ? 'Ajouter Webhook' : 'Add Webhook',
    platform: language === 'fr' ? 'Plateforme' : 'Platform',
    webhookUrl: language === 'fr' ? 'URL Webhook' : 'Webhook URL',
    webhookSecret: language === 'fr' ? 'Secret' : 'Secret',
    events: language === 'fr' ? 'Événements' : 'Events',
    yourWebhookUrl: language === 'fr' ? 'Votre URL Webhook' : 'Your Webhook URL',
    fetchFromPlatform: language === 'fr' ? 'Récupérer de la plateforme' : 'Fetch from Platform',
    noWebhooks: language === 'fr' ? 'Aucun webhook configuré' : 'No webhooks configured',
    noAgent: language === 'fr' ? 'Sélectionnez un agent pour voir les webhooks' : 'Select an agent to view webhooks',
    lastTriggered: language === 'fr' ? 'Dernier déclenchement' : 'Last triggered',
    errors: language === 'fr' ? 'Erreurs' : 'Errors',
    platformConfig: language === 'fr' ? 'Configuration Plateforme' : 'Platform Configuration',
  };

  if (loadingAgents) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent Selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label>{texts.selectAgent}</Label>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={texts.selectAgent} />
            </SelectTrigger>
            <SelectContent>
              {agentsData?.agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <span>{agent.name}</span>
                    <Badge variant="outline" className="text-xs">{agent.platform}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {selectedAgentId && (
          <>
            <Button onClick={() => setShowAddModal(true)} className="mt-6 gap-2">
              <Plus className="h-4 w-4" />
              {texts.addWebhook}
            </Button>
            <Button 
              variant="outline" 
              onClick={fetchPlatformWebhooks}
              disabled={fetchingPlatformWebhooks}
              className="mt-6 gap-2"
            >
              {fetchingPlatformWebhooks ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {texts.fetchFromPlatform}
            </Button>
          </>
        )}
      </div>

      {/* Generated Webhook URL */}
      {selectedAgentId && selectedAgent && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{texts.yourWebhookUrl}</CardTitle>
            <CardDescription>
              {language === 'fr' 
                ? 'Utilisez cette URL dans la configuration de votre plateforme' 
                : 'Use this URL in your platform configuration'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted p-3 rounded-md overflow-x-auto">
                {generateWebhookUrl(selectedAgent.platform)}
              </code>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleCopy(generateWebhookUrl(selectedAgent.platform), 'gen-url')}
              >
                {copiedId === 'gen-url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Webhooks (fetched) */}
      {platformWebhooks && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              {texts.platformConfig}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <pre className="text-xs font-mono">
                {JSON.stringify(platformWebhooks, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* No Agent Selected */}
      {!selectedAgentId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{texts.noAgent}</p>
          </CardContent>
        </Card>
      )}

      {/* Webhooks List */}
      {selectedAgentId && !isLoading && webhooks.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">{texts.noWebhooks}</h4>
            <Button onClick={() => setShowAddModal(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              {texts.addWebhook}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && selectedAgentId && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      <div className="grid gap-4">
        {webhooks.map((webhook) => (
          <Card key={webhook.id} className={!webhook.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${webhook.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Webhook className={`h-5 w-5 ${webhook.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {webhook.platform.charAt(0).toUpperCase() + webhook.platform.slice(1)}
                      <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {webhook.error_count > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {webhook.error_count} {texts.errors}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1 font-mono text-xs truncate max-w-md">
                      {webhook.webhook_url}
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={webhook.is_active}
                  onCheckedChange={(checked) => toggleWebhook.mutate({ id: webhook.id, is_active: checked })}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {webhook.events.map((event) => (
                  <Badge key={event} variant="outline" className="text-xs">
                    {event}
                  </Badge>
                ))}
              </div>
              
              {webhook.last_triggered_at && (
                <p className="text-xs text-muted-foreground mb-3">
                  {texts.lastTriggered}: {new Date(webhook.last_triggered_at).toLocaleString()}
                </p>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(webhook.webhook_url, webhook.id)}
                  className="gap-2"
                >
                  {copiedId === webhook.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy URL
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteWebhook.mutate(webhook.id)}
                  className="text-destructive hover:text-destructive gap-2 ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Webhook Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{texts.addWebhook}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{texts.platform}</Label>
              <Select
                value={formData.platform}
                onValueChange={(value: 'elevenlabs' | 'vapi' | 'retell') => 
                  setFormData({ ...formData, platform: value, events: [] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  <SelectItem value="vapi">Vapi</SelectItem>
                  <SelectItem value="retell">Retell AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{texts.webhookUrl}</Label>
              <Input
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                placeholder="https://your-server.com/webhook"
              />
            </div>

            <div className="space-y-2">
              <Label>{texts.webhookSecret} (optional)</Label>
              <Input
                type="password"
                value={formData.webhook_secret || ''}
                onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                placeholder="Secret for signature verification"
              />
            </div>

            <div className="space-y-2">
              <Label>{texts.events}</Label>
              <ScrollArea className="h-[200px] border rounded-md p-3">
                <div className="space-y-2">
                  {availableEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <Checkbox
                        id={event.id}
                        checked={formData.events.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                      />
                      <div className="grid gap-1 leading-none">
                        <label htmlFor={event.id} className="text-sm font-medium cursor-pointer">
                          {event.name}
                        </label>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddWebhook} 
              disabled={!formData.webhook_url || formData.events.length === 0 || addWebhook.isPending}
            >
              {addWebhook.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {texts.addWebhook}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
