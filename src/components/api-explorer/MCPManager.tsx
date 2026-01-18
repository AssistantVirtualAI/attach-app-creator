import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Server, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Wrench,
  ExternalLink,
  RefreshCw,
  Shield,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { useAllAgents } from '@/hooks/useAllAgents';
import { useAgentMCPServers, MCPServerInput, MCPTool } from '@/hooks/useAgentMCPServers';

interface MCPManagerProps {
  defaultAgentId?: string;
}

export const MCPManager = ({ defaultAgentId }: MCPManagerProps) => {
  const { language } = useLanguage();
  const { data: agentsData, isLoading: loadingAgents } = useAllAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgentId || '');
  const { mcpServers, isLoading, addMCPServer, updateMCPServer, deleteMCPServer, toggleMCPServer, testConnection, listTools } = useAgentMCPServers(selectedAgentId);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  const [formData, setFormData] = useState<MCPServerInput>({
    name: '',
    description: '',
    server_url: '',
    server_type: 'http',
    auth_type: 'none',
    auth_config: {},
    tools_enabled: [],
  });

  const handleAddServer = async () => {
    await addMCPServer.mutateAsync(formData);
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      server_url: '',
      server_type: 'http',
      auth_type: 'none',
      auth_config: {},
      tools_enabled: [],
    });
  };

  const handleTestConnection = async (serverId: string) => {
    setTestingConnection(serverId);
    const result = await testConnection(serverId);
    setConnectionResults(prev => ({ ...prev, [serverId]: result }));
    setTestingConnection(null);
  };

  const handleViewTools = async (serverId: string) => {
    setSelectedServerId(serverId);
    setLoadingTools(true);
    setShowToolsModal(true);
    const fetchedTools = await listTools(serverId);
    setTools(fetchedTools);
    setLoadingTools(false);
  };

  const texts = {
    title: language === 'fr' ? 'Configuration MCP' : 'MCP Configuration',
    description: language === 'fr' 
      ? 'Gérez les serveurs MCP par agent'
      : 'Manage MCP servers per agent',
    selectAgent: language === 'fr' ? 'Sélectionner un agent' : 'Select an agent',
    addServer: language === 'fr' ? 'Ajouter Serveur MCP' : 'Add MCP Server',
    noServers: language === 'fr' ? 'Aucun serveur MCP configuré' : 'No MCP servers configured',
    noAgent: language === 'fr' ? 'Sélectionnez un agent pour voir les serveurs MCP' : 'Select an agent to view MCP servers',
    serverName: language === 'fr' ? 'Nom du serveur' : 'Server Name',
    serverUrl: language === 'fr' ? 'URL du serveur' : 'Server URL',
    serverType: language === 'fr' ? 'Type' : 'Type',
    authType: language === 'fr' ? 'Authentification' : 'Authentication',
    testConnection: language === 'fr' ? 'Tester' : 'Test',
    viewTools: language === 'fr' ? 'Voir outils' : 'View Tools',
    connected: language === 'fr' ? 'Connecté' : 'Connected',
    failed: language === 'fr' ? 'Échec' : 'Failed',
    toolsEnabled: language === 'fr' ? 'outils activés' : 'tools enabled',
    availableTools: language === 'fr' ? 'Outils disponibles' : 'Available Tools',
    noToolsFound: language === 'fr' ? 'Aucun outil trouvé' : 'No tools found',
    authNone: language === 'fr' ? 'Aucune' : 'None',
    authBearer: language === 'fr' ? 'Bearer Token' : 'Bearer Token',
    authApiKey: language === 'fr' ? 'Clé API' : 'API Key',
    authBasic: language === 'fr' ? 'Basic Auth' : 'Basic Auth',
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
          <Button onClick={() => setShowAddModal(true)} className="mt-6 gap-2">
            <Plus className="h-4 w-4" />
            {texts.addServer}
          </Button>
        )}
      </div>

      {/* No Agent Selected */}
      {!selectedAgentId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{texts.noAgent}</p>
          </CardContent>
        </Card>
      )}

      {/* No Servers */}
      {selectedAgentId && !isLoading && mcpServers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">{texts.noServers}</h4>
            <Button onClick={() => setShowAddModal(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              {texts.addServer}
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

      {/* Server List */}
      <div className="grid gap-4">
        {mcpServers.map((server) => (
          <Card key={server.id} className={!server.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${server.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Server className={`h-5 w-5 ${server.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {server.name}
                      <Badge variant={server.is_active ? 'default' : 'secondary'}>
                        {server.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {connectionResults[server.id] && (
                        connectionResults[server.id].success ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {texts.connected}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            {texts.failed}
                          </Badge>
                        )
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {server.description || server.server_url}
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={server.is_active}
                  onCheckedChange={(checked) => toggleMCPServer.mutate({ id: server.id, is_active: checked })}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline">{server.server_type.toUpperCase()}</Badge>
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  {server.auth_type}
                </Badge>
                {server.tools_enabled.length > 0 && (
                  <Badge variant="secondary">
                    {server.tools_enabled.length} {texts.toolsEnabled}
                  </Badge>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection(server.id)}
                  disabled={testingConnection === server.id}
                  className="gap-2"
                >
                  {testingConnection === server.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {texts.testConnection}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewTools(server.id)}
                  className="gap-2"
                >
                  <Wrench className="h-4 w-4" />
                  {texts.viewTools}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(server.server_url, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMCPServer.mutate(server.id)}
                  className="text-destructive hover:text-destructive gap-2 ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Server Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{texts.addServer}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{texts.serverName}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My MCP Server"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{texts.serverUrl}</Label>
              <Input
                value={formData.server_url}
                onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
                placeholder="https://my-mcp-server.com/mcp"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{texts.serverType}</Label>
                <Select
                  value={formData.server_type}
                  onValueChange={(value: 'http' | 'sse' | 'websocket') => setFormData({ ...formData, server_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="sse">SSE</SelectItem>
                    <SelectItem value="websocket">WebSocket</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{texts.authType}</Label>
                <Select
                  value={formData.auth_type}
                  onValueChange={(value: 'none' | 'bearer' | 'api_key' | 'basic') => setFormData({ ...formData, auth_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{texts.authNone}</SelectItem>
                    <SelectItem value="bearer">{texts.authBearer}</SelectItem>
                    <SelectItem value="api_key">{texts.authApiKey}</SelectItem>
                    <SelectItem value="basic">{texts.authBasic}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.auth_type === 'bearer' && (
              <div className="space-y-2">
                <Label>Bearer Token</Label>
                <Input
                  type="password"
                  value={formData.auth_config?.token || ''}
                  onChange={(e) => setFormData({ ...formData, auth_config: { token: e.target.value } })}
                  placeholder="Enter bearer token"
                />
              </div>
            )}

            {formData.auth_type === 'api_key' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Header Name</Label>
                  <Input
                    value={formData.auth_config?.header || 'X-API-Key'}
                    onChange={(e) => setFormData({ ...formData, auth_config: { ...formData.auth_config, header: e.target.value } })}
                    placeholder="X-API-Key"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={formData.auth_config?.key || ''}
                    onChange={(e) => setFormData({ ...formData, auth_config: { ...formData.auth_config, key: e.target.value } })}
                    placeholder="Enter API key"
                  />
                </div>
              </div>
            )}

            {formData.auth_type === 'basic' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={formData.auth_config?.username || ''}
                    onChange={(e) => setFormData({ ...formData, auth_config: { ...formData.auth_config, username: e.target.value } })}
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={formData.auth_config?.password || ''}
                    onChange={(e) => setFormData({ ...formData, auth_config: { ...formData.auth_config, password: e.target.value } })}
                    placeholder="Password"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddServer} 
              disabled={!formData.name || !formData.server_url || addMCPServer.isPending}
            >
              {addMCPServer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {texts.addServer}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tools Modal */}
      <Dialog open={showToolsModal} onOpenChange={setShowToolsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{texts.availableTools}</DialogTitle>
          </DialogHeader>
          
          {loadingTools ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {texts.noToolsFound}
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {tools.map((tool) => (
                  <Card key={tool.name} className="p-4">
                    <div className="flex items-start gap-3">
                      <Wrench className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium font-mono">{tool.name}</h4>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
