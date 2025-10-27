import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, RefreshCw, BookOpen, Tag, Edit, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { KnowledgeBaseEditor } from '@/components/knowledge/KnowledgeBaseEditor';
import { 
  useKnowledgeBase, 
  useKnowledgeBaseCategories,
  useCreateKnowledgeBaseItem,
  useUpdateKnowledgeBaseItem,
  useDeleteKnowledgeBaseItem,
  useSyncKnowledgeBase,
  type KnowledgeBaseItem
} from '@/hooks/useKnowledgeBase';

const KnowledgeBase = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<KnowledgeBaseItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');

  // Hooks
  const { data: items = [], isLoading } = useKnowledgeBase();
  const { data: categories = [] } = useKnowledgeBaseCategories();
  const createMutation = useCreateKnowledgeBaseItem();
  const updateMutation = useUpdateKnowledgeBaseItem();
  const deleteMutation = useDeleteKnowledgeBaseItem();
  const syncMutation = useSyncKnowledgeBase();

  // Filtrage
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, selectedCategory]);

  const handleSave = (itemData: any) => {
    if (itemData.id) {
      updateMutation.mutate(itemData);
    } else {
      createMutation.mutate(itemData);
    }
    setIsEditing(false);
    setSelectedItem(null);
    setActiveTab('browse');
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  const unsyncedCount = items.filter(item => !item.is_synced).length;

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Base de Connaissances</h1>
            <p className="text-muted-foreground text-lg">
              Gérez le contenu de votre agent IA avec synchronisation ElevenLabs
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {unsyncedCount > 0 && (
              <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">
                {unsyncedCount} non synchronisé{unsyncedCount > 1 ? 's' : ''}
              </Badge>
            )}
            
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending || unsyncedCount === 0}
              className="bg-gradient-to-r from-purple-neon to-cyan-electric hover:from-purple-neon/80 hover:to-cyan-electric/80"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Synchronisation...' : 'Synchroniser'}
            </Button>
            
            <Button
              onClick={() => {
                setSelectedItem(null);
                setIsEditing(true);
                setActiveTab('edit');
              }}
              variant="outline"
              className="border-purple-neon/30 hover:border-purple-neon"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Article
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-black/40 border border-purple-neon/20">
            <TabsTrigger value="browse" className="data-[state=active]:bg-purple-neon/20">
              <BookOpen className="w-4 h-4 mr-2" />
              Parcourir ({items.length})
            </TabsTrigger>
            <TabsTrigger value="edit" className="data-[state=active]:bg-purple-neon/20">
              {isEditing ? 'Éditer' : 'Créer'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-6">
            {/* Filtres */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-black/40 border-purple-neon/30"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48 bg-black/40 border-purple-neon/30">
                  <SelectValue placeholder="Toutes catégories" />
                </SelectTrigger>
                <SelectContent className="bg-black border-purple-neon/30">
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grille d'articles */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-purple-neon border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <Card 
                      className="bg-black/40 border border-purple-neon/30 hover:border-purple-neon/60 cursor-pointer transition-all h-full"
                      onClick={() => setSelectedItem(item)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg text-purple-neon line-clamp-2 flex-1">
                            {item.title}
                          </CardTitle>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="border-cyan-electric/30 text-cyan-electric text-xs">
                              {item.category}
                            </Badge>
                            {item.is_synced && (
                              <Badge className="bg-success/20 text-success border-success/30 text-xs">
                                Synced
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {item.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
                        </p>
                        
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                            {item.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{item.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-purple-neon/10">
                          <span>Utilisé {item.usage_count} fois</span>
                          <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center border-purple-neon/30">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Aucun article trouvé</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedCategory !== 'all' 
                    ? 'Essayez de modifier vos filtres'
                    : 'Créez votre premier article'}
                </p>
                <Button
                  onClick={() => {
                    setIsEditing(true);
                    setActiveTab('edit');
                  }}
                  className="bg-gradient-to-r from-purple-neon to-cyan-electric"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un article
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="edit">
            <KnowledgeBaseEditor
              item={selectedItem || undefined}
              onSave={handleSave}
              onCancel={() => {
                setIsEditing(false);
                setSelectedItem(null);
                setActiveTab('browse');
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Modal de détail */}
        {selectedItem && !isEditing && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-black/90 border border-purple-neon/30 rounded-lg max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-purple-neon/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-purple-neon mb-2">{selectedItem.title}</h3>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="border-cyan-electric/30">
                        {selectedItem.category}
                      </Badge>
                      {selectedItem.is_synced && (
                        <Badge className="bg-success/20 text-success border-success/30">
                          Synchronisé
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        Utilisé {selectedItem.usage_count} fois
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItem(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div 
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedItem.content }}
                />
                
                {selectedItem.tags.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-purple-neon/20">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.tags.map(tag => (
                        <Badge key={tag} variant="secondary">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-purple-neon/20 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Créé le {new Date(selectedItem.created_at).toLocaleDateString()} • 
                  Modifié le {new Date(selectedItem.updated_at).toLocaleDateString()}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(true);
                      setActiveTab('edit');
                    }}
                    className="border-purple-neon/30 hover:border-purple-neon"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Éditer
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
                        deleteMutation.mutate(selectedItem.id);
                        setSelectedItem(null);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default KnowledgeBase;
