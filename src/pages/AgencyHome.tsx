import { AppLayout } from "@/components/layout/AppLayout";
import { useOrganization } from "@/context/OrganizationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Globe, 
  ExternalLink, 
  Trash2, 
  AlertCircle,
  BookOpen,
  MessageCircle,
  Youtube,
  PlayCircle,
  Mail,
  Bug,
  Calendar,
  HelpCircle,
  Copy,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";

const AgencyHome = () => {
  const { selectedOrg } = useOrganization();
  const [copiedDomain, setCopiedDomain] = useState(false);
  const navigate = useNavigate();

  const customDomain = selectedOrg?.domain;
  const hasCustomDomain = !!customDomain;

  const handleCopyDomain = () => {
    if (customDomain) {
      navigator.clipboard.writeText(customDomain);
      setCopiedDomain(true);
      toast.success("Domaine copié dans le presse-papier");
      setTimeout(() => setCopiedDomain(false), 2000);
    }
  };

  const handleVisitDomain = () => {
    if (customDomain) {
      window.open(`https://${customDomain}`, '_blank');
    }
  };

  const handleRemoveDomain = () => {
    toast.info("Fonctionnalité de suppression de domaine à venir");
  };

  const resources = [
    {
      title: "Centre de démonstration",
      description: "Découvrez toutes les fonctionnalités de la plateforme",
      icon: PlayCircle,
      href: "#demo",
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "Centre d'aide",
      description: "Documentation et guides d'utilisation",
      icon: BookOpen,
      href: "/docs",
      color: "from-purple-500 to-pink-500",
      internal: true
    },
    {
      title: "Communauté Discord",
      description: "Rejoignez notre communauté d'utilisateurs",
      icon: MessageCircle,
      href: "https://discord.gg/lovable",
      color: "from-indigo-500 to-purple-500"
    },
    {
      title: "Tutoriels vidéo",
      description: "Apprenez avec nos guides vidéo",
      icon: Youtube,
      href: "https://youtube.com/@lovable",
      color: "from-red-500 to-orange-500"
    }
  ];

  const helpOptions = [
    {
      title: "Contacter le support",
      description: "Notre équipe est là pour vous aider",
      icon: Mail,
      action: () => window.open('mailto:support@example.com', '_blank'),
      variant: "default" as const
    },
    {
      title: "Signaler un problème",
      description: "Signalez un bug ou un dysfonctionnement",
      icon: Bug,
      action: () => toast.info("Formulaire de signalement à venir"),
      variant: "outline" as const
    },
    {
      title: "Planifier un appel",
      description: "Réservez un créneau avec notre équipe",
      icon: Calendar,
      action: () => window.open('https://calendly.com', '_blank'),
      variant: "outline" as const
    }
  ];

  return (
    <AppLayout>
      <WelcomeModal />
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-3">Bienvenue, {selectedOrg?.name || 'Agence'}</h2>
          <p className="text-muted-foreground text-lg">
            Gérez votre plateforme et accédez à toutes les ressources
          </p>
        </div>

        {/* Section Domaine Personnalisé */}
        <Card className="glass-card neon-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle>Domaine Personnalisé</CardTitle>
                  <CardDescription>Configurez votre domaine personnalisé</CardDescription>
                </div>
              </div>
              {hasCustomDomain && (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Actif
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasCustomDomain ? (
              <>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <span className="font-mono text-lg flex-1">{customDomain}</span>
                  <Button variant="ghost" size="icon" onClick={handleCopyDomain}>
                    {copiedDomain ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleVisitDomain} className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Visiter
                  </Button>
                  <Button variant="destructive" onClick={handleRemoveDomain} className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Retirer
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Aucun domaine personnalisé configuré
                </p>
                <Button variant="outline" onClick={() => toast.info("Configuration dans Paramètres → Domaines")}>
                  Configurer un domaine
                </Button>
              </div>
            )}

            {/* Notice DNS/Cloudflare */}
            <Alert className="mt-4 border-amber-500/30 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-500">Configuration DNS</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Pour connecter votre domaine, ajoutez un enregistrement A pointant vers <code className="bg-muted px-1 rounded">185.158.133.1</code> et un enregistrement TXT pour la vérification. 
                La propagation DNS peut prendre jusqu'à 72 heures.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Section Ressources */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">Ressources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {resources.map((resource) => {
              const Icon = resource.icon;
              return (
                <Card 
                  key={resource.title} 
                  className="glass-card hover:border-primary/50 transition-all cursor-pointer group"
                  onClick={() => resource.internal ? navigate(resource.href) : window.open(resource.href, '_blank')}
                >
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${resource.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      {resource.title}
                      {resource.internal && <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </h4>
                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Section Aide Supplémentaire */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Besoin d'aide ?</CardTitle>
                <CardDescription>Notre équipe est là pour vous accompagner</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {helpOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.title}
                    variant={option.variant}
                    className="h-auto py-6 flex-col gap-3 hover:border-primary/50"
                    onClick={option.action}
                  >
                    <Icon className="w-8 h-8" />
                    <div className="text-center">
                      <div className="font-semibold">{option.title}</div>
                      <div className="text-xs text-muted-foreground font-normal mt-1">
                        {option.description}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AgencyHome;
