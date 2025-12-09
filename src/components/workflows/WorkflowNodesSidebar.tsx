import { Phone, PhoneOff, MessageSquare, Calendar, Mail, UserPlus, Bell, Database, Webhook, GitBranch } from 'lucide-react';

interface NodeType {
  type: string;
  subType: string;
  label: string;
  icon: React.ReactNode;
  category: 'trigger' | 'action' | 'condition';
}

const nodeTypes: NodeType[] = [
  // Triggers
  { type: 'trigger', subType: 'call-started', label: 'Appel démarré', icon: <Phone className="h-4 w-4" />, category: 'trigger' },
  { type: 'trigger', subType: 'call-ended', label: 'Appel terminé', icon: <PhoneOff className="h-4 w-4" />, category: 'trigger' },
  { type: 'trigger', subType: 'message-received', label: 'Message reçu', icon: <MessageSquare className="h-4 w-4" />, category: 'trigger' },
  { type: 'trigger', subType: 'appointment-booked', label: 'RDV réservé', icon: <Calendar className="h-4 w-4" />, category: 'trigger' },
  // Actions
  { type: 'action', subType: 'send-email', label: 'Envoyer Email', icon: <Mail className="h-4 w-4" />, category: 'action' },
  { type: 'action', subType: 'send-sms', label: 'Envoyer SMS', icon: <MessageSquare className="h-4 w-4" />, category: 'action' },
  { type: 'action', subType: 'create-lead', label: 'Créer Lead', icon: <UserPlus className="h-4 w-4" />, category: 'action' },
  { type: 'action', subType: 'notify-slack', label: 'Notifier Slack', icon: <Bell className="h-4 w-4" />, category: 'action' },
  { type: 'action', subType: 'update-crm', label: 'Mettre à jour CRM', icon: <Database className="h-4 w-4" />, category: 'action' },
  { type: 'action', subType: 'webhook', label: 'Webhook', icon: <Webhook className="h-4 w-4" />, category: 'action' },
  // Conditions
  { type: 'condition', subType: 'if-else', label: 'Si / Sinon', icon: <GitBranch className="h-4 w-4" />, category: 'condition' },
];

const categoryLabels = {
  trigger: { label: 'Triggers', color: 'bg-green-500' },
  action: { label: 'Actions', color: 'bg-blue-500' },
  condition: { label: 'Conditions', color: 'bg-amber-500' },
};

interface WorkflowNodesSidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: string, subType: string) => void;
}

export function WorkflowNodesSidebar({ onDragStart }: WorkflowNodesSidebarProps) {
  const groupedNodes = nodeTypes.reduce((acc, node) => {
    if (!acc[node.category]) acc[node.category] = [];
    acc[node.category].push(node);
    return acc;
  }, {} as Record<string, NodeType[]>);

  return (
    <div className="w-64 bg-card border-r p-4 overflow-y-auto">
      <h3 className="font-semibold mb-4">Nodes</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Glissez-déposez les éléments sur le canvas
      </p>
      
      {Object.entries(groupedNodes).map(([category, nodes]) => (
        <div key={category} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${categoryLabels[category as keyof typeof categoryLabels].color}`} />
            <span className="text-sm font-medium">
              {categoryLabels[category as keyof typeof categoryLabels].label}
            </span>
          </div>
          <div className="space-y-2">
            {nodes.map((node) => (
              <div
                key={node.subType}
                draggable
                onDragStart={(e) => onDragStart(e, node.type, node.subType)}
                className="flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-accent cursor-grab active:cursor-grabbing transition-colors"
              >
                <div className={`p-1.5 rounded ${categoryLabels[node.category].color} text-white`}>
                  {node.icon}
                </div>
                <span className="text-sm">{node.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
