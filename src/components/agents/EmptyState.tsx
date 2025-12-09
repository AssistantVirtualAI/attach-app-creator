import { Button } from '@/components/ui/button';
import { Bot, Plus, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onCreateAgent: () => void;
  onCreateWithBuilder?: () => void;
}

export function EmptyState({ onCreateAgent, onCreateWithBuilder }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Bot className="w-16 h-16 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Aucun agent configuré</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Créez votre premier agent IA pour commencer à gérer vos interactions conversationnelles
      </p>
      <div className="flex gap-3">
        <Button onClick={onCreateAgent} size="lg" variant="outline">
          <Plus className="mr-2 h-5 w-5" />
          Via intégration
        </Button>
        {onCreateWithBuilder && (
          <Button onClick={onCreateWithBuilder} size="lg">
            <Sparkles className="mr-2 h-5 w-5" />
            Créer avec Builder
          </Button>
        )}
      </div>
    </div>
  );
}
