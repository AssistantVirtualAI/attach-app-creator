import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, FileText, Shield, Scale } from "lucide-react";
import { Link } from "react-router-dom";

const Legal = () => {
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 max-w-4xl space-y-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">Mentions Légales</h1>
          <p className="text-muted-foreground text-lg">
            Informations légales et conditions d'utilisation
          </p>
        </div>

        {/* Disclaimer */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <CardTitle className="text-amber-500">Disclaimer</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Cette application est une <strong>recréation fonctionnelle</strong> développée 
              à des fins d'apprentissage et de démonstration. Elle s'inspire de concepts 
              existants dans l'industrie des plateformes SaaS de gestion d'agents IA conversationnels.
            </p>
            <p>
              Ce projet ne copie pas le code source d'autres applications et implémente 
              toutes les fonctionnalités de manière <strong>indépendante et originale</strong>.
            </p>
            <p>
              Les logos, marques et éléments visuels utilisés sont soit originaux, 
              soit proviennent de sources libres de droits.
            </p>
          </CardContent>
        </Card>

        {/* Mentions Légales */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <CardTitle>Informations Légales</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Éditeur</h4>
              <p>AVA Statistics - Plateforme SaaS White-Label</p>
              <p>Application hébergée sur Lovable Cloud</p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold text-foreground mb-2">Hébergement</h4>
              <p>Lovable Cloud (Supabase Infrastructure)</p>
              <p>Données hébergées dans l'Union Européenne</p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold text-foreground mb-2">Contact</h4>
              <p>Email : support@avastatistics.com</p>
            </div>
          </CardContent>
        </Card>

        {/* CGU */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Scale className="w-6 h-6 text-primary" />
              <CardTitle>Conditions Générales d'Utilisation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">1. Objet</h4>
              <p>
                Les présentes conditions générales régissent l'utilisation de la plateforme 
                AVA Statistics, destinée à la gestion d'agents IA conversationnels.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">2. Accès au service</h4>
              <p>
                L'accès à la plateforme nécessite la création d'un compte utilisateur. 
                L'utilisateur s'engage à fournir des informations exactes et à maintenir 
                la confidentialité de ses identifiants.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">3. Propriété intellectuelle</h4>
              <p>
                L'ensemble des éléments de la plateforme (code, design, contenu) sont protégés 
                par le droit d'auteur. Toute reproduction non autorisée est interdite.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">4. Responsabilités</h4>
              <p>
                L'utilisateur est responsable de l'utilisation qu'il fait de la plateforme 
                et des contenus qu'il génère via les agents IA.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">5. Données personnelles</h4>
              <p>
                Le traitement des données personnelles est conforme au RGPD. 
                Consultez notre{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Politique de Confidentialité
                </Link>{" "}
                pour plus d'informations.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Protection des Données */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <CardTitle>Protection des Données</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Nous prenons la protection de vos données très au sérieux. Notre plateforme 
              est conforme aux réglementations RGPD et peut être configurée pour la 
              conformité HIPAA (add-on).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <h5 className="font-semibold text-foreground mb-1">Chiffrement au repos</h5>
                <p className="text-sm">AES-256 via Supabase</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <h5 className="font-semibold text-foreground mb-1">Chiffrement en transit</h5>
                <p className="text-sm">TLS 1.3 via HTTPS</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <h5 className="font-semibold text-foreground mb-1">Logs d'audit</h5>
                <p className="text-sm">Traçabilité complète (HIPAA)</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <h5 className="font-semibold text-foreground mb-1">Droit à l'oubli</h5>
                <p className="text-sm">Suppression sur demande</p>
              </div>
            </div>
            <p className="mt-4">
              Pour exercer vos droits (accès, rectification, suppression), contactez-nous 
              à <span className="text-primary">privacy@avastatistics.com</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Legal;
