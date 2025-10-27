import { Button } from '@/components/ui/button';
import { Bot, Plus } from 'lucide-react';

interface EmptyStateProps {
  onCreateAgent: () => void;
}

export function EmptyState({ onCreateAgent }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Bot className="w-16 h-16 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Aucun agent configuré</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Créez votre premier agent IA pour commencer à gérer vos interactions conversationnelles
      </p>
      <Button onClick={onCreateAgent} size="lg">
        <Plus className="mr-2 h-5 w-5" />
        Nouvel agent
      </Button>
    </div>
  );
}
