import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Settings, Trash2, MessageSquare, MoreHorizontal, ExternalLink, Bot } from 'lucide-react';
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
import { motion } from 'framer-motion';

interface Agent {
  id: string;
  name: string;
  platform: string;
  platform_agent_id?: string | null;
  config: any;
  created_at: string;
  organization_id: string;
  client_id?: string | null;
  slug?: string | null;
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

  const getAgentSlug = (agent: Agent): string | null => {
    return agent.slug || agent.config?.slug || null;
  };

  const handleOpenPortal = (agent: Agent) => {
    const slug = getAgentSlug(agent);
    if (slug) {
      window.open(`/portal/${slug}`, '_blank');
    }
  };

  return (
    <>
      <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/80">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Agent</TableHead>
              <TableHead className="text-muted-foreground font-medium">Plateforme</TableHead>
              <TableHead className="text-muted-foreground font-medium">Prompt</TableHead>
              <TableHead className="text-muted-foreground font-medium">Client assigné</TableHead>
              <TableHead className="text-muted-foreground font-medium">Agent ID</TableHead>
              <TableHead className="text-muted-foreground font-medium">Date de création</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent, index) => (
              <motion.tr
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-border/40 hover:bg-muted/30 transition-colors group"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg blur opacity-40 group-hover:opacity-60 transition-opacity" />
                      <div className="relative w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <span className="font-medium text-foreground">{agent.name}</span>
                  </div>
                </TableCell>
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
                          className="h-auto p-1 text-left font-normal text-xs text-slate-400 hover:text-purple-300"
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
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded text-foreground font-mono">
                    {agent.config?.agent_id || agent.platform_agent_id || 'N/A'}
                  </code>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(agent.created_at), 'dd MMM yyyy', { locale: fr })}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border z-50">
                      <DropdownMenuItem onClick={() => navigate(`/agent-settings/${agent.id}`)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Paramètres
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenPrompt(agent)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Modifier Prompt
                      </DropdownMenuItem>
                      {getAgentSlug(agent) && (
                        <>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem onClick={() => handleOpenPortal(agent)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ouvrir le portail
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator className="bg-slate-700" />
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
                        <AlertDialogContent className="bg-slate-900 border-slate-700">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Supprimer l'agent ?</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-400">
                              Cette action est irréversible. L'agent "{agent.name}" sera définitivement supprimé.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-slate-700">Annuler</AlertDialogCancel>
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
              </motion.tr>
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
