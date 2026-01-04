import { useState } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Search, FileText, Plus, Calendar, Tag, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const mockDocuments = [
  { id: 1, title: 'Guide de démarrage', category: 'Documentation', updatedAt: new Date(), tags: ['guide', 'onboarding'] },
  { id: 2, title: 'FAQ Produit', category: 'Support', updatedAt: new Date(Date.now() - 86400000), tags: ['faq', 'produit'] },
  { id: 3, title: 'Politique de retour', category: 'Légal', updatedAt: new Date(Date.now() - 172800000), tags: ['retour', 'politique'] },
  { id: 4, title: 'Tarification', category: 'Commercial', updatedAt: new Date(Date.now() - 259200000), tags: ['prix', 'offres'] },
  { id: 5, title: 'Intégrations API', category: 'Technique', updatedAt: new Date(Date.now() - 345600000), tags: ['api', 'dev'] },
  { id: 6, title: 'Conditions générales', category: 'Légal', updatedAt: new Date(Date.now() - 432000000), tags: ['cgv', 'légal'] },
];

const categories = ['Tous', 'Documentation', 'Support', 'Légal', 'Commercial', 'Technique'];

const categoryColors: Record<string, string> = {
  'Documentation': 'primary',
  'Support': 'success',
  'Légal': 'warning',
  'Commercial': 'secondary',
  'Technique': 'destructive',
};

const PortalKnowledge = () => {
  const { session, canEditKnowledge } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const canEdit = canEditKnowledge();

  const filteredDocuments = mockDocuments.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'Tous' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
              <Button className="gap-2 bg-gradient-to-r from-primary to-purple-500">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Categories */}
        <Card className="lg:col-span-1 bg-card/50 backdrop-blur-sm border-border/30 h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Catégories</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-1">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'secondary' : 'ghost'}
                  className={`w-full justify-start h-9 ${
                    selectedCategory === category ? 'bg-primary/10 text-primary' : ''
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                  {category !== 'Tous' && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {mockDocuments.filter(d => d.category === category).length}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-card/50 backdrop-blur-sm border-border/30 hover:border-primary/30 transition-all group cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <GlowBadge variant={categoryColors[doc.category] as any || 'secondary'} className="text-xs">
                          {doc.category}
                        </GlowBadge>
                      </div>
                      
                      <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Calendar className="h-3 w-3" />
                        {format(doc.updatedAt, 'dd MMM yyyy', { locale: fr })}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {doc.tags.map((tag) => (
                          <span 
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-muted/50 text-xs text-muted-foreground flex items-center gap-1"
                          >
                            <Tag className="h-2.5 w-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-4 gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Voir le document
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </motion.div>
  );
};

export default PortalKnowledge;
