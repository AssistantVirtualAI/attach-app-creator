import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, CheckCircle, XCircle, Play, Link2, 
  Receipt, Wallet, AlertCircle, ExternalLink, Calendar
} from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useBillingConfig } from '@/hooks/useBillingConfig';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { PricingCards } from '@/components/billing/PricingCards';
import { SubscriptionStatus } from '@/components/billing/SubscriptionStatus';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Invoice {
  id: string;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

export default function StripeBilling() {
  const [searchParams] = useSearchParams();
  const { selectedOrg } = useOrganization();
  const { billingConfig, currentPlan, isLoading } = useBillingConfig();
  const { createCheckoutSession, openCustomerPortal, refreshSubscription, isLoading: isActionLoading } = useStripeSubscription();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);

  const isStripeConnected = !!billingConfig?.stripe_customer_id;

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Paiement réussi ! Votre abonnement a été mis à jour.');
      refreshSubscription();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Paiement annulé.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (isStripeConnected) {
      fetchInvoices();
      fetchPaymentMethods();
    }
  }, [isStripeConnected, billingConfig?.stripe_customer_id]);

  const fetchInvoices = async () => {
    if (!billingConfig?.stripe_customer_id) return;
    setLoadingInvoices(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-invoices', {
        body: { customerId: billingConfig.stripe_customer_id }
      });
      if (error) throw error;
      setInvoices(data?.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      // Mock data for demo
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchPaymentMethods = async () => {
    if (!billingConfig?.stripe_customer_id) return;
    setLoadingPaymentMethods(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment-methods', {
        body: { customerId: billingConfig.stripe_customer_id }
      });
      if (error) throw error;
      setPaymentMethods(data?.paymentMethods || []);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      // Mock data for demo
      setPaymentMethods([]);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const handleConnectStripe = async () => {
    // Redirect to first plan checkout to connect Stripe
    await createCheckoutSession('starter');
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

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
          <Alert className="mb-6 bg-green-500/10 border-green-500/50">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <AlertDescription className="text-green-500">
              Votre paiement a été traité avec succès !
            </AlertDescription>
          </Alert>
        )}

        {searchParams.get('canceled') === 'true' && (
          <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/50">
            <XCircle className="w-4 h-4 text-yellow-500" />
            <AlertDescription className="text-yellow-500">
              Le paiement a été annulé.
            </AlertDescription>
          </Alert>
        )}

        {/* Connect to Stripe CTA */}
        {!isStripeConnected && !isLoading && (
          <Card className="mb-6 border-primary/50 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/20">
                    <Link2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Connectez-vous à Stripe</h3>
                    <p className="text-muted-foreground text-sm">
                      Souscrivez à un plan pour activer les fonctionnalités premium
                    </p>
                  </div>
                </div>
                <Button onClick={handleConnectStripe} disabled={isActionLoading}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Commencer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="subscription" className="space-y-6">
          <TabsList>
            <TabsTrigger value="subscription">Abonnement</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="payment-methods">Moyens de paiement</TabsTrigger>
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

          <TabsContent value="history" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Receipt className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Historique des paiements</CardTitle>
                    <CardDescription>
                      Consultez vos factures et paiements passés
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!isStripeConnected ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Connectez-vous à Stripe pour voir votre historique de paiements
                    </p>
                  </div>
                ) : loadingInvoices ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-8">
                    <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucune facture pour le moment</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div 
                        key={invoice.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-muted rounded-lg">
                            <Receipt className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {formatCurrency(invoice.amount_paid, invoice.currency)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(invoice.created * 1000), 'dd MMMM yyyy', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                            {invoice.status === 'paid' ? 'Payée' : invoice.status}
                          </Badge>
                          {invoice.hosted_invoice_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(invoice.hosted_invoice_url!, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {isStripeConnected && (
                  <div className="mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={openCustomerPortal}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Voir toutes les factures sur Stripe
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-methods" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Wallet className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Moyens de paiement</CardTitle>
                    <CardDescription>
                      Gérez vos cartes et méthodes de paiement
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!isStripeConnected ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Connectez-vous à Stripe pour gérer vos moyens de paiement
                    </p>
                  </div>
                ) : loadingPaymentMethods ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Aucun moyen de paiement enregistré</p>
                    <Button variant="outline" onClick={openCustomerPortal}>
                      Ajouter une carte
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.map((method) => (
                      <div 
                        key={method.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-muted rounded-lg">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {method.brand.toUpperCase()} •••• {method.last4}
                              {method.is_default && (
                                <Badge variant="secondary" className="text-xs">Par défaut</Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Expire {method.exp_month.toString().padStart(2, '0')}/{method.exp_year}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {isStripeConnected && (
                  <div className="mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={openCustomerPortal}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Gérer les moyens de paiement
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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