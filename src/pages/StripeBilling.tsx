import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, AlertTriangle, Play } from 'lucide-react';

export default function StripeBilling() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Facturation par Stripe
          </h1>
          <p className="text-muted-foreground">
            Gérez vos paiements et facturations avec Stripe
          </p>
        </div>

        <Tabs defaultValue="connect" className="space-y-6">
          <TabsList>
            <TabsTrigger value="connect">Connectez-vous à Stripe</TabsTrigger>
            <TabsTrigger value="tutorial">Tutoriel</TabsTrigger>
          </TabsList>

          <TabsContent value="connect" className="space-y-6">
            <Alert className="bg-yellow-500/10 border-yellow-500/50">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <AlertDescription className="text-yellow-500">
                Fonctionnalité premium - Disponible sur les plans Pro et Enterprise
              </AlertDescription>
            </Alert>

            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-8 h-8 text-primary" />
                  <div>
                    <CardTitle>Intégration Stripe</CardTitle>
                    <CardDescription>
                      Connectez votre compte Stripe pour accepter les paiements
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  L'intégration Stripe vous permet de :
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Accepter les paiements par carte bancaire</li>
                  <li>Gérer les abonnements récurrents</li>
                  <li>Émettre des factures automatiques</li>
                  <li>Suivre vos revenus en temps réel</li>
                </ul>

                <div className="pt-4">
                  <Button size="lg" className="gap-2">
                    <CreditCard className="w-5 h-5" />
                    Connecter Stripe
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/50">
              <CardHeader>
                <CardTitle>Débloquez plus de fonctionnalités</CardTitle>
                <CardDescription>
                  Passez à un plan supérieur pour accéder à l'intégration Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="lg">
                  Voir les plans disponibles
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tutorial" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Guide d'intégration Stripe</CardTitle>
                <CardDescription>
                  Suivez ce tutoriel pour configurer Stripe dans votre application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-card rounded-lg flex items-center justify-center border">
                  <div className="text-center space-y-4">
                    <Play className="w-16 h-16 text-primary mx-auto" />
                    <p className="text-muted-foreground">
                      Tutoriel vidéo Stripe
                    </p>
                    <Button variant="outline">
                      Regarder sur YouTube
                    </Button>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Étapes d'intégration :</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Créez un compte Stripe (ou connectez-vous)</li>
                    <li>Récupérez vos clés API dans le dashboard Stripe</li>
                    <li>Configurez vos webhooks pour les événements</li>
                    <li>Testez l'intégration en mode test</li>
                    <li>Passez en mode production</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
