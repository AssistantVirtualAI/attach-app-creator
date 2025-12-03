import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Settings, Trash2 } from 'lucide-react';
import { PlatformBadge } from './PlatformBadge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Agent {
  id: string;
  name: string;
  platform: string;
  config: any;
  created_at: string;
  organization_id: string;
  client_id?: string | null;
  client?: { id: string; name: string } | null;
}

interface AgentsTableProps {
  agents: Agent[];
  onRefetch: () => void;
}

export function AgentsTable({ agents, onRefetch }: AgentsTableProps) {
  const handleDelete = async (agentId: string) => {
    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId);

      if (error) throw error;

      toast.success('Agent supprimé avec succès');
      onRefetch();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Plateforme</TableHead>
            <TableHead>Client assigné</TableHead>
            <TableHead>Agent ID</TableHead>
            <TableHead>Date de création</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.id}>
              <TableCell className="font-medium">{agent.name}</TableCell>
              <TableCell>
                <PlatformBadge platform={agent.platform} />
              </TableCell>
              <TableCell>
                {agent.client ? (
                  <span className="text-foreground">{agent.client.name}</span>
                ) : (
                  <span className="text-muted-foreground">Non assigné</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {agent.config?.agent_id || 'N/A'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(agent.created_at), 'dd MMM yyyy', { locale: fr })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer l'agent ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. L'agent "{agent.name}" sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(agent.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
