import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Wrench, Globe, Webhook, Server } from 'lucide-react';
import { EndpointExplorer } from '@/components/api-explorer/EndpointExplorer';
import { MCPServerTester } from '@/components/api-explorer/MCPServerTester';
import { WebhookManager } from '@/components/api-explorer/WebhookManager';
import { MCPManager } from '@/components/api-explorer/MCPManager';
import { useLanguage } from '@/context/LanguageContext';

const ApiExplorer = () => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('endpoints');

  const texts = {
    title: language === 'fr' ? 'Explorateur API' : 'API Explorer',
    description: language === 'fr' 
      ? 'Testez les endpoints, gérez les webhooks et configurez les serveurs MCP'
      : 'Test API endpoints, manage webhooks, and configure MCP servers',
    endpoints: language === 'fr' ? 'Endpoints API' : 'API Endpoints',
    webhooks: language === 'fr' ? 'Webhooks' : 'Webhooks',
    mcpConfig: language === 'fr' ? 'Config MCP' : 'MCP Config',
    mcpTester: language === 'fr' ? 'Testeur MCP' : 'MCP Tester',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6" />
          {texts.title}
        </h1>
        <p className="text-muted-foreground mt-1">{texts.description}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            {texts.endpoints}
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            {texts.webhooks}
          </TabsTrigger>
          <TabsTrigger value="mcp-config" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            {texts.mcpConfig}
          </TabsTrigger>
          <TabsTrigger value="mcp-tester" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            {texts.mcpTester}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="mt-4">
          <EndpointExplorer />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          <WebhookManager />
        </TabsContent>

        <TabsContent value="mcp-config" className="mt-4">
          <MCPManager />
        </TabsContent>

        <TabsContent value="mcp-tester" className="mt-4">
          <MCPServerTester />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiExplorer;
