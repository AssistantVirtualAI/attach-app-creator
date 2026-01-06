import { useState, useMemo } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import {
  usePortalKnowledgeBase,
  usePortalKnowledgeBaseDocument,
  usePortalAddKnowledgeDocument,
  usePortalDeleteKnowledgeDocument,
  usePortalUpdateKnowledgeDocument,
} from '@/hooks/usePortalElevenLabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen,
  Search,
  FileText,
  Plus,
  Calendar,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Eye,
  Edit,
  Link as LinkIcon,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { PlatformNotSupported } from '@/components/portal/PlatformNotSupported';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const PortalKnowledge = () => {
  const { session } = usePortal();

  // Knowledge base management is currently implemented only for ElevenLabs portal hooks.
  if (session?.platform && session.platform !== 'elevenlabs') {
    return (
      <PlatformNotSupported
        title="Base de connaissances indisponible pour cette plateforme"
        description={`La gestion de la base de connaissances du portail est pour l’instant disponible uniquement pour ElevenLabs. Pour ${String(session.platform).toUpperCase()}, vous pouvez consulter les conversations et les analytics.`}
        primaryCtaHref="/portal/conversations"
      />
    );
  }

  const { data: kbData, isLoading, refetch } = usePortalKnowledgeBase();
  const addDocument = usePortalAddKnowledgeDocument();
  const deleteDocument = usePortalDeleteKnowledgeDocument();
  const updateDocument = usePortalUpdateKnowledgeDocument();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocContent, setNewDocContent] = useState('');

  // View/Edit modal state
  const [viewDocumentId, setViewDocumentId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  const { data: documentData, isLoading: isLoadingDocument } = usePortalKnowledgeBaseDocument(viewDocumentId);

  // Only admins can edit: super_admin, admin role, client principal, or member with admin role
  const isAdmin =
    session?.role === 'super_admin' ||
    session?.role === 'admin' ||
    session?.memberType === 'client' ||
    session?.memberRole === 'admin';
  const canEdit = isAdmin;

  // Read from knowledge_base.items structure
  const items = kbData?.knowledge_base?.items || [];
  const allDocumentsCount = kbData?.knowledge_base?.all_documents_count || items.length;

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((doc: any) => {
      const cat = doc.category || doc.type || 'Général';
      cats.add(cat);
    });
    return Array.from(cats).sort();
  }, [items]);

  const filteredDocuments = items.filter((doc: any) => {
    const docName = doc.name || doc.title || '';
    const docCategory = doc.category || doc.type || 'Général';
    
    // Search filter
    if (searchTerm && !docName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Category filter
    if (categoryFilter !== 'all' && docCategory !== categoryFilter) {
      return false;
    }
    
    return true;
  });

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
    } catch (error: any) {
      if (error.message?.includes('403') || error.message?.includes('Accès refusé')) {
        toast.error('Accès refusé. Seuls les administrateurs peuvent ajouter des documents.');
      } else {
        toast.error('Erreur lors de l\'ajout du document');
      }
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await deleteDocument.mutateAsync(documentId);
      toast.success('Document supprimé');
    } catch (error: any) {
      if (error.message?.includes('403') || error.message?.includes('Accès refusé')) {
        toast.error('Accès refusé. Seuls les administrateurs peuvent supprimer des documents.');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handleOpenView = (docId: string, docName: string) => {
    setViewDocumentId(docId);
    setIsEditMode(false);
    setEditName(docName);
    setEditContent('');
  };

  const handleStartEdit = () => {
    if (documentData?.document) {
      setEditName(documentData.document.name || '');
      setEditContent(documentData.document.content || '');
    }
    setIsEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!viewDocumentId || !editName.trim() || !editContent.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      await updateDocument.mutateAsync({
        documentId: viewDocumentId,
        name: editName,
        content: editContent,
        deleteOld: true,
      });
      toast.success('Document modifié avec succès');
      setViewDocumentId(null);
      setIsEditMode(false);
    } catch (error: any) {
      if (error.message?.includes('403') || error.message?.includes('Accès refusé')) {
        toast.error('Accès refusé. Seuls les administrateurs peuvent modifier des documents.');
      } else {
        toast.error('Erreur lors de la modification');
      }
    }
  };

  const getDocIcon = (type: string) => {
    if (type === 'url' || type === 'link') return <LinkIcon className="h-5 w-5 text-primary" />;
    return <FileText className="h-5 w-5 text-primary" />;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <PortalPageHeader
        icon={BookOpen}
        title="Base de connaissances"
        description={`${session?.agentName} • ${items.length} document(s) liés${allDocumentsCount > items.length ? ` (${allDocumentsCount} total)` : ''}`}
        gradient="green-cyan"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
            </Button>
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
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
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

      {items.length > 0 && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/30">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher dans la base de connaissances..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pl-10 bg-muted/30 border-border/50 h-11" 
                  />
                </div>
                {categories.length > 1 && (
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full md:w-48 bg-muted/30 border-border/50">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les catégories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {filteredDocuments.length} document(s) affiché(s) sur {items.length}
              </p>
            </CardContent>
          </Card>

          {/* Documents Grid */}
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc: any, index: number) => (
                <motion.div
                  key={doc.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-card/50 backdrop-blur-sm border-border/30 hover:border-primary/30 transition-all group h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          {getDocIcon(doc.type)}
                        </div>
                        <GlowBadge variant="secondary" className="text-xs">
                          {doc.type || 'text'}
                        </GlowBadge>
                      </div>
                      
                      <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors truncate">
                        {doc.name || doc.title || 'Sans titre'}
                      </h3>

                      {doc.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {doc.content.substring(0, 100)}...
                        </p>
                      )}
                      
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
                          onClick={() => handleOpenView(doc.id, doc.name || doc.title || '')}
                        >
                          <Eye className="h-3 w-3" />
                          Voir
                        </Button>
                        {doc.url && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => window.open(doc.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteDocument(doc.id)}
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

      {/* View/Edit Document Modal */}
      <Dialog open={!!viewDocumentId} onOpenChange={(open) => { if (!open) { setViewDocumentId(null); setIsEditMode(false); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isEditMode ? 'Modifier le document' : (documentData?.document?.name || 'Document')}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Modifiez le contenu du document' : 'Contenu complet du document'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {isLoadingDocument ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : isEditMode ? (
              <div className="space-y-4 p-1">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom du document</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nom du document"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contenu</label>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Contenu du document..."
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ) : documentData?.document?.content ? (
              <div className="whitespace-pre-wrap text-sm p-4 bg-muted rounded-lg">
                {documentData.document.content}
              </div>
            ) : documentData?.document?.url ? (
              <div className="p-4">
                <p className="text-sm text-muted-foreground mb-2">Document lié à une URL :</p>
                <a 
                  href={documentData.document.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {documentData.document.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : documentData?.document?.content_unavailable_reason ? (
              <div className="p-4 text-center">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {documentData.document.content_unavailable_reason === 'binary_or_not_extractible' 
                    ? 'Ce fichier est binaire ou son contenu ne peut pas être extrait.'
                    : 'Le contenu de ce document n\'est pas disponible.'}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground p-4 text-center">Aucun contenu disponible</p>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2">
            {isEditMode ? (
              <>
                <Button variant="outline" onClick={() => setIsEditMode(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSaveEdit} disabled={updateDocument.isPending} className="gap-2">
                  {updateDocument.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sauvegarder
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setViewDocumentId(null)}>
                  Fermer
                </Button>
                {canEdit && documentData?.document?.type !== 'url' && documentData?.document?.content && (
                  <Button onClick={handleStartEdit} className="gap-2">
                    <Edit className="h-4 w-4" />
                    Modifier
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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