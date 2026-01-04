import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCode, MessageSquare, Eye, Globe, Key, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const PortalPrompt = () => {
  const { session, canEditPrompt } = usePortal();
  const canEdit = canEditPrompt();

  const endpoints = [
    { name: 'Widget Embed', url: `${window.location.origin}/iframe/${session?.agentId}` },
    { name: 'Prototype', url: `${window.location.origin}/prototype/${session?.agentId}` },
    { name: 'Agent ID', url: session?.agentId || '' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sunset-orange to-warning flex items-center justify-center">
            <FileCode className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prompt & Endpoints</h1>
            <p className="text-muted-foreground">{session?.agentName}</p>
          </div>
        </div>
        {!canEdit && <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />Lecture seule</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileCode className="h-5 w-5 text-primary" />System Prompt</CardTitle>
          </CardHeader>
          <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Premier Message</CardTitle>
          </CardHeader>
          <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" />Endpoints API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {endpoints.map((endpoint) => (
            <div key={endpoint.name} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2"><Key className="h-4 w-4" /><span className="font-medium">{endpoint.name}</span></div>
              <code className="text-sm truncate max-w-[300px]">{endpoint.url}</code>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(endpoint.url); toast.success('Copié'); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PortalPrompt;
