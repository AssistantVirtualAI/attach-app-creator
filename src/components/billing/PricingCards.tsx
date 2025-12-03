import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { PLANS } from '@/hooks/useBillingConfig';
import { cn } from '@/lib/utils';

interface PricingCardsProps {
  currentPlanId: string;
  onSelectPlan: (priceId: string) => void;
  isLoading: boolean;
}

export const PricingCards = ({ currentPlanId, onSelectPlan, isLoading }: PricingCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {PLANS.map((plan) => {
        const isCurrent = plan.id === currentPlanId;
        const isUpgrade = PLANS.findIndex(p => p.id === plan.id) > PLANS.findIndex(p => p.id === currentPlanId);

        return (
          <Card 
            key={plan.id} 
            className={cn(
              'glass-card relative transition-all hover:scale-[1.02]',
              plan.popular && 'border-primary ring-2 ring-primary/20',
              isCurrent && 'border-success'
            )}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                Populaire
              </Badge>
            )}
            {isCurrent && (
              <Badge className="absolute -top-3 right-4 bg-success">
                Plan actuel
              </Badge>
            )}

            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>
                <span className="text-4xl font-bold text-foreground">{plan.price}€</span>
                <span className="text-muted-foreground">/mois</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full"
                variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                disabled={isCurrent || isLoading || !plan.priceId}
                onClick={() => plan.priceId && onSelectPlan(plan.priceId)}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  'Plan actuel'
                ) : isUpgrade ? (
                  'Upgrade'
                ) : (
                  'Sélectionner'
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
