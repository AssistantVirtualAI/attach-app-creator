import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bot, Plus, Unlink, Settings, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlatformBadge } from '@/components/agents/PlatformBadge';

interface ClientAgentsTabProps {
  assignedAgents: any[];
  availableAgents: any[];
  onAssign: (agentId: string) => void;
  onUnassign: (agentId: string) => void;
}

export const ClientAgentsTab = ({ 
  assignedAgents, 
  availableAgents, 
  onAssign, 
  onUnassign 
}: ClientAgentsTabProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleAssign = (agentId: string) => {
    onAssign(agentId);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agents assignés ({assignedAgents?.length || 0})
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Affecter un agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Affecter un agent</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {availableAgents && availableAgents.length > 0 ? (
                  <div className="space-y-2">
                    {availableAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Bot className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{agent.name}</p>
                            <PlatformBadge platform={agent.platform} />
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleAssign(agent.id)}>
                          Affecter
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Aucun agent disponible
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {assignedAgents && assignedAgents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Plateforme</TableHead>
                  <TableHead>Agent ID</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        {agent.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PlatformBadge platform={agent.platform} />
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {agent.platform_agent_id || '-'}
                      </code>
                    </TableCell>
                    <TableCell>
                      {new Date(agent.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/agent-settings/${agent.id}`)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onUnassign(agent.id)}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun agent assigné à ce client</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cliquez sur "Affecter un agent" pour commencer
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
