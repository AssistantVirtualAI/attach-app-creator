import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, CheckCircle, XCircle, Play } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useBillingConfig } from '@/hooks/useBillingConfig';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { PricingCards } from '@/components/billing/PricingCards';
import { SubscriptionStatus } from '@/components/billing/SubscriptionStatus';

export default function StripeBilling() {
  const [searchParams] = useSearchParams();
  const { billingConfig, currentPlan, isLoading } = useBillingConfig();
  const { createCheckoutSession, openCustomerPortal, refreshSubscription, isLoading: isActionLoading } = useStripeSubscription();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Paiement réussi ! Votre abonnement a été mis à jour.');
      refreshSubscription();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Paiement annulé.');
    }
  }, [searchParams]);

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Facturation
          </h1>
          <p className="text-muted-foreground">
            Gérez votre abonnement et vos paiements
          </p>
        </div>

        {searchParams.get('success') === 'true' && (
          <Alert className="mb-6 bg-success/10 border-success/50">
            <CheckCircle className="w-4 h-4 text-success" />
            <AlertDescription className="text-success">
              Votre paiement a été traité avec succès !
            </AlertDescription>
          </Alert>
        )}

        {searchParams.get('canceled') === 'true' && (
          <Alert className="mb-6 bg-warning/10 border-warning/50">
            <XCircle className="w-4 h-4 text-warning" />
            <AlertDescription className="text-warning">
              Le paiement a été annulé.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="subscription" className="space-y-6">
          <TabsList>
            <TabsTrigger value="subscription">Abonnement</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="tutorial">Tutoriel</TabsTrigger>
          </TabsList>

          <TabsContent value="subscription" className="space-y-6">
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <SubscriptionStatus
                billingConfig={billingConfig}
                currentPlanName={currentPlan.name}
                onManageSubscription={openCustomerPortal}
                isLoading={isActionLoading}
              />
            )}
          </TabsContent>

          <TabsContent value="plans" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Choisissez votre plan</h2>
              <p className="text-muted-foreground">
                Sélectionnez le plan qui correspond à vos besoins
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-[400px]" />
                ))}
              </div>
            ) : (
              <PricingCards
                currentPlanId={billingConfig?.plan_tier || 'free'}
                onSelectPlan={createCheckoutSession}
                isLoading={isActionLoading}
              />
            )}
          </TabsContent>

          <TabsContent value="tutorial" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Guide de facturation</CardTitle>
                <CardDescription>
                  Découvrez comment gérer votre abonnement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-card rounded-lg flex items-center justify-center border">
                  <div className="text-center space-y-4">
                    <Play className="w-16 h-16 text-primary mx-auto" />
                    <p className="text-muted-foreground">
                      Tutoriel vidéo - Gestion de l'abonnement
                    </p>
                    <Button variant="outline">
                      Regarder sur YouTube
                    </Button>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <h3 className="font-semibold text-lg">FAQ Facturation</h3>
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="font-medium">Comment changer de plan ?</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Allez dans l'onglet "Plans" et sélectionnez le nouveau plan souhaité. 
                        Le changement sera effectif immédiatement.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="font-medium">Comment annuler mon abonnement ?</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cliquez sur "Gérer l'abonnement" pour accéder au portail client Stripe 
                        où vous pourrez annuler votre abonnement.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="font-medium">Quand serai-je facturé ?</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        La facturation est mensuelle, à la date anniversaire de votre abonnement.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
