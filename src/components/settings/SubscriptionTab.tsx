import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, CreditCard, ExternalLink } from 'lucide-react';
import { useBillingConfig, PLANS } from '@/hooks/useBillingConfig';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { cn } from '@/lib/utils';

export function SubscriptionTab() {
  const { billingConfig, currentPlan, isLoading } = useBillingConfig();
  const { createCheckoutSession, openCustomerPortal, isLoading: isActionLoading } = useStripeSubscription();
  const [isAnnual, setIsAnnual] = useState(false);

  const getPrice = (monthlyPrice: number) => {
    if (isAnnual) {
      return Math.round(monthlyPrice * 12 * 0.8); // 20% discount
    }
    return monthlyPrice;
  };

  const getPriceLabel = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 'Gratuit';
    if (isAnnual) {
      return `${getPrice(monthlyPrice)}€/an`;
    }
    return `${monthlyPrice}€/mois`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted/50 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Plan actuel</CardTitle>
                <CardDescription>Votre abonnement actif</CardDescription>
              </div>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              {currentPlan.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-2xl font-bold">{currentPlan.price === 0 ? 'Gratuit' : `${currentPlan.price}€/mois`}</p>
              {billingConfig?.subscription_ends_at && (
                <p className="text-sm text-muted-foreground">
                  Renouvellement le {new Date(billingConfig.subscription_ends_at).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
            {billingConfig?.stripe_customer_id && (
              <Button variant="outline" onClick={openCustomerPortal} disabled={isActionLoading}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Gérer l'abonnement
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4 py-4">
        <Label className={cn(!isAnnual && 'font-bold')}>Mensuel</Label>
        <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
        <Label className={cn(isAnnual && 'font-bold')}>
          Annuel
          <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-500">
            -20%
          </Badge>
        </Label>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const isCurrentPlan = plan.id === currentPlan.id;
          const isPopular = plan.popular;

          return (
            <Card
              key={plan.id}
              className={cn(
                'glass-card relative',
                isPopular && 'border-primary ring-2 ring-primary/20',
                isCurrentPlan && 'bg-primary/5'
              )}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  Populaire
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">
                  {getPriceLabel(plan.price)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <Button className="w-full" disabled>
                    Plan actuel
                  </Button>
                ) : plan.priceId ? (
                  <Button
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={() => createCheckoutSession(plan.priceId!)}
                    disabled={isActionLoading}
                  >
                    {plan.price > currentPlan.price ? 'Upgrader' : 'Choisir'}
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    Plan gratuit
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Billing Info Link */}
      {billingConfig?.stripe_customer_id && (
        <div className="text-center">
          <Button variant="link" onClick={openCustomerPortal} disabled={isActionLoading}>
            Modifier les informations de facturation et voir les factures
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
