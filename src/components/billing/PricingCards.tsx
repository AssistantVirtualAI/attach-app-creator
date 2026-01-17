import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { PLANS, useBillingConfig } from '@/hooks/useBillingConfig';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface PricingCardsProps {
  currentPlanId: string;
  onSelectPlan: (priceId: string) => void;
  isLoading: boolean;
}

export const PricingCards = ({ currentPlanId, onSelectPlan, isLoading }: PricingCardsProps) => {
  const { t, language } = useTranslation();
  const [isAnnual, setIsAnnual] = useState(true);
  const { getAnnualSavings } = useBillingConfig();

  return (
    <div className="space-y-6">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={cn("text-sm", !isAnnual && "font-semibold")}>
          {language === 'fr' ? 'Mensuel' : 'Monthly'}
        </span>
        <Switch
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
        />
        <span className={cn("text-sm", isAnnual && "font-semibold")}>
          {language === 'fr' ? 'Annuel' : 'Annual'}
          <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-600">
            {language === 'fr' ? 'Économisez jusqu\'à 20%' : 'Save up to 20%'}
          </Badge>
        </span>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isUpgrade = PLANS.findIndex(p => p.id === plan.id) > PLANS.findIndex(p => p.id === currentPlanId);
          const price = isAnnual ? plan.priceAnnual : plan.price;
          const priceId = isAnnual ? plan.priceIdAnnual : plan.priceId;
          const savings = getAnnualSavings(plan);

          return (
            <Card 
              key={plan.id} 
              className={cn(
                'relative transition-all hover:scale-[1.02]',
                plan.popular && 'border-primary ring-2 ring-primary/20',
                isCurrent && 'border-green-500 bg-green-500/5'
              )}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {language === 'fr' ? 'Plus populaire' : 'Most Popular'}
                </Badge>
              )}
              {isCurrent && (
                <Badge className="absolute -top-3 right-4 bg-green-500">
                  {language === 'fr' ? 'Plan actuel' : 'Current Plan'}
                </Badge>
              )}

              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  {plan.price === 0 ? (
                    <span className="text-4xl font-bold text-foreground">
                      {language === 'fr' ? 'Gratuit' : 'Free'}
                    </span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground">
                        ${isAnnual ? Math.round(price / 12) : price}
                      </span>
                      <span className="text-muted-foreground">
                        {language === 'fr' ? '/mois' : '/month'}
                      </span>
                      {isAnnual && price > 0 && (
                        <div className="mt-1">
                          <span className="text-xs text-muted-foreground">
                            ${price}{language === 'fr' ? '/an' : '/year'}
                          </span>
                          {savings > 0 && (
                            <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-600/30">
                              {language === 'fr' ? 'Économisez' : 'Save'} ${savings}
                            </Badge>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Client limit info */}
                {plan.clientsIncluded > 0 && (
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <span className="text-2xl font-bold text-primary">{plan.clientsIncluded}</span>
                    <span className="text-sm text-muted-foreground"> {language === 'fr' ? 'clients inclus' : 'clients included'}</span>
                    {plan.additionalClientPrice && (
                      <p className="text-xs text-muted-foreground mt-1">
                        +${plan.additionalClientPrice}/{language === 'fr' ? 'client additionnel' : 'additional client'}
                      </p>
                    )}
                  </div>
                )}

                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full"
                  variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                  disabled={isCurrent || isLoading || !priceId}
                  onClick={() => priceId && onSelectPlan(priceId)}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrent ? (
                    language === 'fr' ? 'Plan actuel' : 'Current Plan'
                  ) : plan.price === 0 ? (
                    language === 'fr' ? 'Plan gratuit' : 'Free Plan'
                  ) : isUpgrade ? (
                    language === 'fr' ? 'Passer à ce plan' : 'Upgrade to this plan'
                  ) : (
                    language === 'fr' ? 'Sélectionner' : 'Select'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};