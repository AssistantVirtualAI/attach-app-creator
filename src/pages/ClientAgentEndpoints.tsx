import { useParams } from 'react-router-dom';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { ElevenLabsEndpointsCard } from '@/components/elevenlabs/ElevenLabsEndpointsCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

const ClientAgentEndpoints = () => {
  const { clientId, agentId } = useParams();
  const { apiKey, agentId: elevenlabsAgentId, agentName } = useClientAgentAccess(clientId, agentId);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copié');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const widgetUrl = elevenlabsAgentId 
    ? `${window.location.origin}/iframe/${agentId}` 
    : null;
  
  const prototypeUrl = elevenlabsAgentId 
    ? `${window.location.origin}/prototype/${agentId}` 
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Endpoints & Intégration</h1>
        <p className="text-muted-foreground">Informations techniques pour {agentName}</p>
      </div>

      {/* Agent IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Identifiants Agent
          </CardTitle>
          <CardDescription>
            Identifiants uniques pour intégrer cet agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Agent ID (Interne)</p>
              <code className="text-xs text-muted-foreground">{agentId || 'N/A'}</code>
            </div>
            {agentId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(agentId, 'internalId')}
              >
                {copiedField === 'internalId' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Agent ID (ElevenLabs)</p>
              <code className="text-xs text-muted-foreground">{elevenlabsAgentId || 'N/A'}</code>
            </div>
            {elevenlabsAgentId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(elevenlabsAgentId, 'elevenLabsId')}
              >
                {copiedField === 'elevenLabsId' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {widgetUrl && (
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Widget Embed URL</p>
                <code className="text-xs text-muted-foreground truncate block max-w-md">{widgetUrl}</code>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(widgetUrl, 'widget')}
              >
                {copiedField === 'widget' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {prototypeUrl && (
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Prototype URL</p>
                <code className="text-xs text-muted-foreground truncate block max-w-md">{prototypeUrl}</code>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(prototypeUrl, 'prototype')}
              >
                {copiedField === 'prototype' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <ElevenLabsEndpointsCard 
        agentId={elevenlabsAgentId || undefined}
        apiKey={apiKey || undefined}
      />
    </div>
  );
};

export default ClientAgentEndpoints;
