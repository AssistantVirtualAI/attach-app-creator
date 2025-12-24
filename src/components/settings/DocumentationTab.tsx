import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  ExternalLink, 
  Download, 
  Settings, 
  Code, 
  Zap, 
  CreditCard, 
  Mail, 
  Webhook, 
  Globe,
  HelpCircle,
  MessageCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export const DocumentationTab = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: "Installation",
      description: "Guide de déploiement et configuration initiale",
      icon: Download,
      color: "text-blue-500"
    },
    {
      title: "Intégrations",
      description: "ElevenLabs, Stripe, Email, Webhooks, Domaines",
      icon: Settings,
      color: "text-purple-500"
    },
    {
      title: "API Reference",
      description: "Endpoints, authentification et rate limits",
      icon: Code,
      color: "text-green-500"
    }
  ];

  const quickLinks = [
    {
      title: "ElevenLabs",
      description: "Configuration des agents vocaux",
      icon: Zap,
      href: "/docs#elevenlabs"
    },
    {
      title: "Stripe",
      description: "Paiements et abonnements",
      icon: CreditCard,
      href: "/docs#stripe"
    },
    {
      title: "Email SMTP",
      description: "Templates et configuration",
      icon: Mail,
      href: "/docs#email"
    },
    {
      title: "Webhooks",
      description: "Événements temps réel",
      icon: Webhook,
      href: "/docs#webhooks"
    },
    {
      title: "Domaines",
      description: "Configuration DNS",
      icon: Globe,
      href: "/docs#domains"
    }
  ];

  const helpLinks = [
    {
      title: "FAQ",
      href: "/docs",
      icon: HelpCircle,
      internal: true
    },
    {
      title: "Contenu de Formation",
      href: "/docs?tab=training",
      icon: BookOpen,
      internal: true
    },
    {
      title: "Tutoriels Vidéo",
      href: "/docs?tab=videos",
      icon: ExternalLink,
      internal: true
    }
  ];

  return (
    <div className="space-y-6">
      {/* Main CTA */}
      <Card className="glass-card neon-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Documentation AVA Statistics</CardTitle>
                <CardDescription>Guide complet pour utiliser la plateforme</CardDescription>
              </div>
            </div>
            <Badge variant="secondary">v1.0.0</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => navigate('/docs')} 
            className="w-full sm:w-auto gap-2"
            size="lg"
          >
            <BookOpen className="w-5 h-5" />
            Ouvrir la documentation
            <ExternalLink className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Sections Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="glass-card hover:border-primary/50 transition-all cursor-pointer" onClick={() => navigate('/docs')}>
              <CardContent className="p-6">
                <Icon className={`w-8 h-8 ${section.color} mb-3`} />
                <h4 className="font-semibold mb-1">{section.title}</h4>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Links */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Liens Rapides</CardTitle>
          <CardDescription>Accès direct aux sections les plus consultées</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Button
                  key={link.title}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:border-primary/50"
                  onClick={() => navigate(link.href)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{link.title}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* External Help */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Ressources Externes</CardTitle>
          <CardDescription>Support, communauté et mises à jour</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {helpLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Button
                  key={link.title}
                  variant="secondary"
                  className="gap-2"
                  onClick={() => link.internal ? navigate(link.href) : window.open(link.href, '_blank')}
                >
                  <Icon className="w-4 h-4" />
                  {link.title}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
