import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Link2, Plus, Loader2 } from 'lucide-react';
import { useAddKnowledgeBaseItem, useAddKnowledgeBaseUrl } from '@/hooks/useElevenLabsKnowledgeBase';

interface AddKnowledgeDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  apiKey?: string;
}

const CATEGORIES = [
  'Général',
  'FAQ',
  'Produits',
  'Services',
  'Politiques',
  'Support',
  'Tarifs',
  'Contact',
  'À propos',
];

export function AddKnowledgeDocumentModal({ 
  open, 
  onOpenChange, 
  agentId, 
  apiKey 
}: AddKnowledgeDocumentModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'url'>('text');
  
  // Text form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Général');
  
  // URL form state
  const [url, setUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');

  const addTextMutation = useAddKnowledgeBaseItem();
  const addUrlMutation = useAddKnowledgeBaseUrl();

  const isLoading = addTextMutation.isPending || addUrlMutation.isPending;

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('Général');
    setUrl('');
    setUrlTitle('');
    setActiveTab('text');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleAddText = async () => {
    if (!title || !content) return;

    await addTextMutation.mutateAsync({
      agentId,
      apiKey,
      title,
      content,
      category
    });

    handleClose();
  };

  const handleAddUrl = async () => {
    if (!url) return;

    await addUrlMutation.mutateAsync({
      agentId,
      apiKey,
      url,
      title: urlTitle || undefined
    });

    handleClose();
  };

  const handleSubmit = () => {
    if (activeTab === 'text') {
      handleAddText();
    } else {
      handleAddUrl();
    }
  };

  const canSubmit = activeTab === 'text' 
    ? title.trim() && content.trim()
    : url.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Ajouter un document
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'text' | 'url')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Texte
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: FAQ Produits"
                  className="bg-background"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenu *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Entrez le contenu du document...

Vous pouvez ajouter des informations sur vos produits, services, FAQ, politiques, etc.

L'agent IA utilisera ce contenu pour répondre aux questions des utilisateurs."
                className="min-h-[250px] bg-background font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {content.length} caractères
              </p>
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/documentation"
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Le contenu de la page web sera automatiquement extrait et indexé
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="urlTitle">Titre (optionnel)</Label>
              <Input
                id="urlTitle"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="Titre personnalisé pour ce document"
                className="bg-background"
              />
            </div>

            <div className="p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground">
              <p className="font-medium mb-2">Conseils pour les URLs :</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Utilisez des pages avec du contenu textuel (pas des images)</li>
                <li>Les pages nécessitant une authentification ne fonctionneront pas</li>
                <li>Les PDFs et documents peuvent être importés</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ajout...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
