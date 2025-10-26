import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const KnowledgeBase = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const entries = [
    {
      id: '1',
      title: 'Guide de démarrage',
      content: 'Voici comment démarrer avec notre plateforme...',
      category: 'Tutoriel',
      tags: ['Débutant', 'Setup'],
      synced: true,
    },
    {
      id: '2',
      title: 'FAQ Facturation',
      content: 'Réponses aux questions fréquentes sur la facturation...',
      category: 'FAQ',
      tags: ['Facturation', 'Paiement'],
      synced: true,
    },
    {
      id: '3',
      title: 'Résolution de problèmes',
      content: 'Solutions aux problèmes courants...',
      category: 'Support',
      tags: ['Problème', 'Solution'],
      synced: false,
    },
  ];

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Base de Connaissances</h1>
            <p className="text-muted-foreground text-lg">
              Gérez le contenu de votre agent IA
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-primary to-accent">
                <Plus className="w-4 h-4" />
                Nouvelle Entrée
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card max-w-2xl">
              <DialogHeader>
                <DialogTitle>Créer une nouvelle entrée</DialogTitle>
                <DialogDescription>
                  Ajoutez du contenu à votre base de connaissances
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input id="title" placeholder="Titre de l'entrée" className="bg-background/50" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie</Label>
                  <Input id="category" placeholder="FAQ, Tutoriel, Support..." className="bg-background/50" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Contenu</Label>
                  <Textarea
                    id="content"
                    placeholder="Contenu de l'entrée..."
                    rows={10}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (séparés par des virgules)</Label>
                  <Input id="tags" placeholder="tag1, tag2, tag3" className="bg-background/50" />
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1 bg-gradient-to-r from-primary to-accent">
                    Créer l'entrée
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans la base de connaissances..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass-card"
          />
        </div>

        {/* Entries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entries.map((entry) => (
            <Card key={entry.id} className="glass-card hover:neon-border transition-all duration-200">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      {entry.title}
                    </CardTitle>
                    <CardDescription>{entry.category}</CardDescription>
                  </div>
                  {entry.synced && (
                    <Badge className="bg-success/20 text-success border-success/30">
                      Synced
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {entry.content}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {entry.tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1 gap-2">
                    <Edit className="w-4 h-4" />
                    Modifier
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-2 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default KnowledgeBase;