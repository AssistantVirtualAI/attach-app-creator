import { useState } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Search, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

const PortalKnowledge = () => {
  const { session, canEditKnowledge } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const canEdit = canEditKnowledge();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-green to-success flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Base de connaissances</h1>
            <p className="text-muted-foreground">{session?.agentName}</p>
          </div>
        </div>
        {!canEdit && (
          <Badge variant="secondary" className="gap-1">
            <Eye className="h-3 w-3" />
            Lecture seule
          </Badge>
        )}
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </ScrollArea>
    </motion.div>
  );
};

export default PortalKnowledge;
