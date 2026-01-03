import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Settings, Trash2, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlatformBadge } from './PlatformBadge';
import { QuickPromptModal } from './QuickPromptModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Agent {
  id: string;
  name: string;
  platform: string;
  platform_agent_id?: string | null;
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
  const navigate = useNavigate();
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  
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

  const handleOpenPrompt = (agent: Agent) => {
    setSelectedAgent(agent);
    setPromptModalOpen(true);
  };

  const getPromptSnippet = (config: any) => {
    const prompt = config?.system_prompt || config?.prompt || '';
    if (!prompt) return null;
    return prompt.length > 60 ? prompt.substring(0, 60) + '...' : prompt;
  };

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Plateforme</TableHead>
              <TableHead>Prompt</TableHead>
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
                <TableCell className="max-w-[200px]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-left font-normal text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenPrompt(agent)}
                        >
                          {getPromptSnippet(agent.config) || (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Configurer
                            </span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cliquez pour modifier le prompt</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  {agent.client ? (
                    <span className="text-foreground">{agent.client.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Non assigné</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {agent.config?.agent_id || agent.platform_agent_id || 'N/A'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(agent.created_at), 'dd MMM yyyy', { locale: fr })}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/agent-settings/${agent.id}`)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Paramètres
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenPrompt(agent)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Modifier Prompt
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem 
                            onSelect={(e) => e.preventDefault()}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedAgent && (
        <QuickPromptModal
          open={promptModalOpen}
          onOpenChange={setPromptModalOpen}
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          platform={selectedAgent.platform}
          platformAgentId={selectedAgent.config?.agent_id || selectedAgent.platform_agent_id}
        />
      )}
    </>
  );
}
