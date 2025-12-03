import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Code, Frame, Link } from 'lucide-react';
import { toast } from 'sonner';
import { AgentSettings } from '@/hooks/useAgentSettings';

interface AgentEmbedTabProps {
  agent: AgentSettings;
}

export const AgentEmbedTab = ({ agent }: AgentEmbedTabProps) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  
  const baseUrl = window.location.origin;
  const prototypeUrl = `${baseUrl}/prototype/${agent.id}`;
  
  const themeConfig = (agent.theme_config || {}) as Record<string, string>;
  
  const popupCode = `<!-- AVA Statistics Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/widget.js';
    script.async = true;
    script.onload = function() {
      AVAWidget.init({
        agentId: '${agent.id}',
        platform: '${agent.platform}',
        platformAgentId: '${agent.platform_agent_id || ''}',
        position: 'bottom-right',
        theme: {
          primaryColor: '${themeConfig.primaryColor || '#8B5CF6'}',
          textColor: '${themeConfig.textColor || '#ffffff'}',
          borderRadius: '${themeConfig.borderRadius || '8'}px'
        }
      });
    };
    document.head.appendChild(script);
  })();
</script>`;

  const iframeCode = `<!-- AVA Statistics Embedded Agent -->
<iframe
  src="${prototypeUrl}?embed=true"
  width="400"
  height="600"
  frameborder="0"
  allow="microphone; camera"
  style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);"
></iframe>`;

  const directLink = prototypeUrl;

  const copyToClipboard = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    toast.success('Code copié !');
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Code d'intégration
          </CardTitle>
          <CardDescription>
            Choisissez la méthode d'intégration adaptée à votre site
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="popup" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="popup" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Popup Widget
              </TabsTrigger>
              <TabsTrigger value="iframe" className="flex items-center gap-2">
                <Frame className="h-4 w-4" />
                iFrame
              </TabsTrigger>
              <TabsTrigger value="link" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Lien direct
              </TabsTrigger>
            </TabsList>

            <TabsContent value="popup" className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{popupCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(popupCode, 'popup')}
                >
                  {copiedTab === 'popup' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Ajoutez ce code avant la balise <code>&lt;/body&gt;</code> de votre site.
                Le widget apparaîtra en bas à droite de la page.
              </p>
            </TabsContent>

            <TabsContent value="iframe" className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{iframeCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(iframeCode, 'iframe')}
                >
                  {copiedTab === 'iframe' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Intégrez l'agent directement dans votre page via un iframe.
                Modifiez les dimensions selon vos besoins.
              </p>
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{directLink}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(directLink, 'link')}
                >
                  {copiedTab === 'link' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Partagez ce lien directement pour accéder à l'agent en pleine page.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration actuelle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Agent ID</p>
              <code className="bg-muted px-2 py-1 rounded text-xs">{agent.id}</code>
            </div>
            <div>
              <p className="text-muted-foreground">Plateforme</p>
              <p className="font-medium">{agent.platform}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Couleur primaire</p>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: themeConfig.primaryColor || '#8B5CF6' }}
                />
                <code className="text-xs">{themeConfig.primaryColor || '#8B5CF6'}</code>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Layout</p>
              <p className="font-medium">{agent.widget_layout || 'Original'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
