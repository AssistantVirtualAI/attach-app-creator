import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, RefreshCw, BookOpen, FileText, Trash2, Link2, AlertCircle, CheckCircle2, Bot, File, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  useElevenLabsKnowledgeBase, 
  useDeleteKnowledgeBaseItem,
  type ElevenLabsKBItem
} from '@/hooks/useElevenLabsKnowledgeBase';
import { useElevenLabsAgents } from '@/hooks/useElevenLabsAgents';
import { useQueryClient } from '@tanstack/react-query';
import { KnowledgeDocumentViewer } from '@/components/knowledge/KnowledgeDocumentViewer';
import { AddKnowledgeDocumentModal } from '@/components/knowledge/AddKnowledgeDocumentModal';

const KnowledgeBase = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ElevenLabsKBItem | null>(null);

  const queryClient = useQueryClient();

  // Get available ElevenLabs agents
  const { data: agentsData, isLoading: isLoadingAgents } = useElevenLabsAgents();
  const agents = agentsData?.agents || [];
  const fallbackApiKey = agentsData?.fallbackApiKey;

  // Get the selected agent (using internal UUID)
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const apiKey = selectedAgent?.platform_api_key || (selectedAgent?.config as any)?.api_key || fallbackApiKey;
  const platformAgentId = selectedAgent?.platform_agent_id;

  // Fetch knowledge base for selected agent - pass internal UUID, function will look up platform_agent_id
  const { 
    data: kbData, 
    isLoading: isLoadingKB, 
    error: kbError,
    refetch 
  } = useElevenLabsKnowledgeBase(selectedAgentId, apiKey);

  const deleteMutation = useDeleteKnowledgeBaseItem();

  const items = kbData?.knowledge_base?.items || [];
  const totalDocs = kbData?.knowledge_base?.all_documents_count || 0;

  // Filter items
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter(item => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const handleViewDocument = (item: ElevenLabsKBItem) => {
    setSelectedDocument(item);
    setViewerOpen(true);
  };

  const handleDeleteItem = async (item: ElevenLabsKBItem) => {
    if (!selectedAgentId) return;
    if (!confirm(`Supprimer "${item.name}" ?`)) return;

    await deleteMutation.mutateAsync({
      agentId: selectedAgentId,
      apiKey: apiKey || undefined,
      documentId: item.id
    });
  };

  const handleRefresh = () => {
    if (selectedAgentId) {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-knowledge-base', selectedAgentId] });
      refetch();
    }
  };

  // Auto-select first agent if none selected (use internal ID, not platform_agent_id)
  if (!selectedAgentId && agents.length > 0 && !isLoadingAgents) {
    setSelectedAgentId(agents[0].id);
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'url': return <Link2 className="w-4 h-4" />;
      case 'file': 
      case 'document': return <File className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Base de Connaissances</h1>
          <p className="text-muted-foreground text-lg">
            Gérez les documents de votre agent IA ElevenLabs
          </p>
        </div>

        {/* Agent Selector */}
        <Card className="mb-6 bg-card/50 border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Sélectionner un agent ElevenLabs</Label>
                <Select 
                  value={selectedAgentId || ''} 
                  onValueChange={setSelectedAgentId}
                  disabled={isLoadingAgents}
                >
                  <SelectTrigger className="w-full sm:w-80 bg-background border-border">
                    <SelectValue placeholder={isLoadingAgents ? "Chargement..." : "Sélectionner un agent"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border">
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-primary" />
                          <span>{agent.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({agent.platform_agent_id.slice(0, 8)}...)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Connection Status */}
              {selectedAgentId && (
                <div className="flex items-center gap-2">
                  {apiKey ? (
                    <Badge className="bg-success/20 text-success border-success/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Connecté
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      API Key manquante
                    </Badge>
                  )}
                  {totalDocs > items.length && (
                    <span className="text-sm text-muted-foreground">
                      {items.length} liés / {totalDocs} total
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions Bar */}
        {selectedAgentId && apiKey && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans la base de connaissances..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={isLoadingKB}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingKB ? 'animate-spin' : ''}`} />
                Rafraîchir
              </Button>

              <Button 
                className="bg-primary hover:bg-primary/90"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        )}

        {/* No Agent Selected State */}
        {!selectedAgentId && !isLoadingAgents && (
          <Card className="p-12 text-center border-border">
            <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Aucun agent sélectionné</h3>
            <p className="text-muted-foreground mb-4">
              {agents.length === 0 
                ? 'Aucun agent ElevenLabs configuré. Créez un agent avec une API key ElevenLabs.'
                : 'Sélectionnez un agent pour voir sa base de connaissances.'}
            </p>
          </Card>
        )}

        {/* No API Key State */}
        {selectedAgentId && !apiKey && (
          <Card className="p-12 text-center border-border">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-warning" />
            <h3 className="text-lg font-semibold mb-2">API Key manquante</h3>
            <p className="text-muted-foreground mb-4">
              Cet agent n'a pas d'API Key ElevenLabs configurée.
              Veuillez ajouter une API Key dans les paramètres de l'agent.
            </p>
          </Card>
        )}

        {/* Loading State */}
        {isLoadingKB && selectedAgentId && apiKey && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-muted-foreground">Chargement de la base de connaissances...</p>
          </div>
        )}

        {/* Error State */}
        {kbError && selectedAgentId && apiKey && (
          <Card className="p-12 text-center border-destructive">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Erreur de chargement</h3>
            <p className="text-muted-foreground mb-4">
              {(kbError as Error).message || 'Une erreur est survenue'}
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </Card>
        )}

        {/* Knowledge Base Items */}
        {!isLoadingKB && !kbError && selectedAgentId && apiKey && (
          <>
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item, index) => (
                  <motion.div
                    key={item.id || item.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="bg-card border-border hover:border-primary/50 transition-all h-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              {getItemIcon(item.type)}
                            </div>
                            <CardTitle className="text-base truncate">
                              {item.name}
                            </CardTitle>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {item.type}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {item.content && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {item.content.substring(0, 150)}...
                          </p>
                        )}

                        {item.url && (
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Link2 className="w-3 h-3" />
                            {item.url.substring(0, 40)}...
                          </a>
                        )}

                        {item.metadata?.category && (
                          <Badge variant="secondary" className="text-xs">
                            {item.metadata.category}
                          </Badge>
                        )}

                        <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDocument(item)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item)}
                            disabled={deleteMutation.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center border-border">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Base de connaissances vide</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm 
                    ? 'Aucun document trouvé avec cette recherche'
                    : 'Ajoutez des documents pour enrichir votre agent'}
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un document
                </Button>
              </Card>
            )}
          </>
        )}

        {/* Stats Footer */}
        {selectedAgentId && apiKey && items.length > 0 && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {items.length} document{items.length > 1 ? 's' : ''} dans la base de connaissances
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      <KnowledgeDocumentViewer 
        document={selectedDocument} 
        open={viewerOpen} 
        onOpenChange={setViewerOpen} 
      />

      {/* Add Document Modal */}
      {selectedAgentId && (
        <AddKnowledgeDocumentModal
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          agentId={selectedAgentId}
          apiKey={apiKey || undefined}
        />
      )}
    </AppLayout>
  );
};

export default KnowledgeBase;
