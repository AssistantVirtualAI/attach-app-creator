import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { useClientElevenLabsKnowledgeBase, useClientUpdateKnowledgeBase } from '@/hooks/useClientElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  Plus, 
  Search,
  FileText,
  Tag,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';

const ClientAgentKnowledge = () => {
  const { clientId, agentId } = useParams();
  const { apiKey, agentId: elevenlabsAgentId, agentName, canEdit } = useClientAgentAccess(clientId, agentId);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', content: '', category: '' });

  const { data: knowledgeBase, isLoading } = useClientElevenLabsKnowledgeBase({
    apiKey,
    agentId: elevenlabsAgentId,
  });

  const updateMutation = useClientUpdateKnowledgeBase();

  const items = knowledgeBase?.knowledge_base?.items || [];
  const categories = knowledgeBase?.knowledge_base?.categories || [];

  const filteredItems = items.filter((item: any) => {
    const itemTitle = item.title || item.name || '';
    const itemContent = item.content || '';
    const matchesSearch = 
      itemTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemContent.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddItem = async () => {
    if (!apiKey || !elevenlabsAgentId) return;
    if (!newItem.title || !newItem.content) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    await updateMutation.mutateAsync({
      apiKey,
      agentId: elevenlabsAgentId,
      title: newItem.title,
      content: newItem.content,
      category: newItem.category || 'Général',
    });

    setIsAddModalOpen(false);
    setNewItem({ title: '', content: '', category: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Base de connaissances</h1>
          <p className="text-muted-foreground">Informations disponibles pour {agentName}</p>
        </div>
        {canEdit ? (
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        ) : (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Lecture seule
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((cat: string) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Knowledge Base Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {filteredItems.length} élément{filteredItems.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'Aucun résultat trouvé' 
                  : 'La base de connaissances est vide'
                }
              </p>
              {canEdit && !searchTerm && selectedCategory === 'all' && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter le premier élément
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3 pr-4">
                {filteredItems.map((item: any, index: number) => (
                  <div
                    key={item.id || index}
                    className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium truncate">{item.title || item.name}</h3>
                          {item.category && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {item.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add Item Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter à la base de connaissances</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={newItem.title}
                onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Titre de l'élément"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie</Label>
              <Input
                id="category"
                value={newItem.category}
                onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: FAQ, Produits, Services..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Contenu</Label>
              <Textarea
                id="content"
                value={newItem.content}
                onChange={(e) => setNewItem(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Contenu de l'élément..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddItem} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientAgentKnowledge;
