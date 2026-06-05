import { Button } from '@/components/ui/button';
import { Bot, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface EmptyStateProps {
  onCreateAgent: () => void;
  onCreateWithBuilder?: () => void;
}

export function EmptyState({ onCreateAgent, onCreateWithBuilder }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Bot className="w-16 h-16 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{t('agents.empty.title')}</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        {t('agents.empty.description')}
      </p>
      <div className="flex gap-3">
        <Button onClick={onCreateAgent} size="lg" variant="outline">
          <Plus className="mr-2 h-5 w-5" />
          {t('agents.viaIntegration')}
        </Button>
        {onCreateWithBuilder && (
          <Button onClick={onCreateWithBuilder} size="lg">
            <Sparkles className="mr-2 h-5 w-5" />
            {t('agents.createWithBuilder')}
          </Button>
        )}
      </div>
    </div>
  );
}
