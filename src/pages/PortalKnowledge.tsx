import { useState } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalKnowledgeBase, usePortalAddKnowledgeDocument, usePortalDeleteKnowledgeDocument } from '@/hooks/usePortalElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BookOpen, Search, FileText, Plus, Calendar, Trash2, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const PortalKnowledge = () => {
  const { session, canEditKnowledge, hasEditAccess } = usePortal();
  const { data: kbData, isLoading } = usePortalKnowledgeBase();
  const addDocument = usePortalAddKnowledgeDocument();
  const deleteDocument = usePortalDeleteKnowledgeDocument();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocContent, setNewDocContent] = useState('');

  const canEdit = canEditKnowledge() || hasEditAccess();
  const documents = kbData?.documents || [];

  const filteredDocuments = documents.filter((doc: any) => 
    doc.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddDocument = async () => {
    if (!newDocName.trim() || !newDocContent.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      await addDocument.mutateAsync({ name: newDocName, content: newDocContent });
      toast.success('Document ajouté avec succès');
      setIsAddModalOpen(false);
      setNewDocName('');
      setNewDocContent('');
    } catch (error) {
      toast.error('Erreur lors de l\'ajout du document');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await deleteDocument.mutateAsync(documentId);
      toast.success('Document supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <PortalPageHeader
        icon={BookOpen}
        title="Base de connaissances"
        description={session?.agentName}
        gradient="green-cyan"
        actions={
          <>
            {!canEdit && (
              <GlowBadge variant="secondary">Lecture seule</GlowBadge>
            )}
            {canEdit && (
              <Button 
                className="gap-2 bg-gradient-to-r from-primary to-purple-500"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            )}
          </>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && documents.length === 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun document</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              La base de connaissances est vide. Ajoutez des documents pour enrichir les réponses de l'agent.
            </p>
            {canEdit && (
              <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un document
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {documents.length > 0 && (
        <div className="space-y-4">
          {/* Search */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/30">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher dans la base de connaissances..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-10 bg-muted/30 border-border/50 h-11" 
                />
              </div>
            </CardContent>
          </Card>

          {/* Documents Grid */}
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc: any, index: number) => (
                <motion.div
                  key={doc.id || doc.document_id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-card/50 backdrop-blur-sm border-border/30 hover:border-primary/30 transition-all group h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <GlowBadge variant="secondary" className="text-xs">
                          {doc.type || 'text'}
                        </GlowBadge>
                      </div>
                      
                      <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors truncate">
                        {doc.name || doc.title || 'Sans titre'}
                      </h3>
                      
                      {doc.created_at && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: fr })}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Voir
                        </Button>
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteDocument(doc.id || doc.document_id)}
                            disabled={deleteDocument.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Add Document Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom du document</label>
              <Input
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="Ex: FAQ Produit"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contenu</label>
              <Textarea
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                placeholder="Entrez le contenu du document..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleAddDocument} 
              disabled={addDocument.isPending}
              className="gap-2"
            >
              {addDocument.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default PortalKnowledge;
