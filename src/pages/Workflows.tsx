import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { 
  Shield, 
  Zap, 
  Calendar, 
  Mail, 
  MessageSquare, 
  BarChart3, 
  FileText, 
  Users,
  Plus,
  Trash2,
  Settings,
  ExternalLink,
  Search
} from "lucide-react";

interface MarketplaceApp {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  requiresHipaa: boolean;
  features: string[];
}

const marketplaceApps: MarketplaceApp[] = [
  {
    id: "zapier",
    name: "Zapier",
    description: "Connectez vos agents à plus de 5000 applications",
    icon: <Zap className="h-6 w-6" />,
    category: "Automatisation",
    requiresHipaa: false,
    features: ["Webhooks", "Triggers", "Actions automatisées"]
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Planification automatique de rendez-vous",
    icon: <Calendar className="h-6 w-6" />,
    category: "Planification",
    requiresHipaa: false,
    features: ["Réservation en ligne", "Rappels automatiques", "Synchronisation calendrier"]
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Marketing par email automatisé",
    icon: <Mail className="h-6 w-6" />,
    category: "Marketing",
    requiresHipaa: false,
    features: ["Campagnes email", "Segmentation", "Analytics"]
  },
  {
    id: "slack",
    name: "Slack",
    description: "Notifications et alertes en temps réel",
    icon: <MessageSquare className="h-6 w-6" />,
    category: "Communication",
    requiresHipaa: false,
    features: ["Notifications", "Canaux dédiés", "Alertes personnalisées"]
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    description: "Synchronisation CRM automatique",
    icon: <Users className="h-6 w-6" />,
    category: "CRM",
    requiresHipaa: true,
    features: ["Contacts", "Deals", "Notes automatiques"]
  },
  {
    id: "analytics",
    name: "Google Analytics",
    description: "Suivi des performances avancé",
    icon: <BarChart3 className="h-6 w-6" />,
    category: "Analytics",
    requiresHipaa: false,
    features: ["Événements", "Conversions", "Rapports personnalisés"]
  },
  {
    id: "notion",
    name: "Notion",
    description: "Documentation et notes automatiques",
    icon: <FileText className="h-6 w-6" />,
    category: "Productivité",
    requiresHipaa: true,
    features: ["Pages automatiques", "Base de données", "Templates"]
  },
  {
    id: "make",
    name: "Make (Integromat)",
    description: "Automatisations visuelles complexes",
    icon: <Settings className="h-6 w-6" />,
    category: "Automatisation",
    requiresHipaa: false,
    features: ["Scénarios", "Modules", "Filtres avancés"]
  }
];

export default function Workflows() {
  const { selectedOrg } = useOrganization();
  const queryClient = useQueryClient();
  const [hipaaModalOpen, setHipaaModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<MarketplaceApp | null>(null);
  const [hipaaAccepted, setHipaaAccepted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMarketplaceApps = marketplaceApps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { data: installedWorkflows, isLoading } = useQuery({
    queryKey: ['workflows', selectedOrg?.id],
    queryFn: async () => {
      if (!selectedOrg?.id) return [];
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('organization_id', selectedOrg.id)
        .order('installed_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrg?.id
  });

  const { data: organization } = useQuery({
    queryKey: ['organization-hipaa', selectedOrg?.id],
    queryFn: async () => {
      if (!selectedOrg?.id) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('hipaa_enabled')
        .eq('id', selectedOrg.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrg?.id
  });

  const installMutation = useMutation({
    mutationFn: async (app: MarketplaceApp) => {
      if (!selectedOrg?.id) throw new Error("No organization");
      
      const { error } = await supabase
        .from('workflows')
        .insert({
          organization_id: selectedOrg.id,
          app_name: app.id,
          config: { name: app.name, category: app.category },
          is_active: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({ title: "Application installée", description: "L'application a été ajoutée à vos workflows" });
      setHipaaModalOpen(false);
      setSelectedApp(null);
      setHipaaAccepted(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'installer l'application", variant: "destructive" });
    }
  });

  const uninstallMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({ title: "Application désinstallée" });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    }
  });

  const handleInstall = (app: MarketplaceApp) => {
    if (app.requiresHipaa && !organization?.hipaa_enabled) {
      setSelectedApp(app);
      setHipaaModalOpen(true);
    } else {
      installMutation.mutate(app);
    }
  };

  const confirmHipaaInstall = () => {
    if (selectedApp && hipaaAccepted) {
      installMutation.mutate(selectedApp);
    }
  };

  const isInstalled = (appId: string) => {
    return installedWorkflows?.some(w => w.app_name === appId);
  };

  const getAppDetails = (appName: string) => {
    return marketplaceApps.find(a => a.id === appName);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Workflows & Intégrations</h1>
          <p className="text-muted-foreground">
            Connectez vos agents à des applications tierces
          </p>
        </div>

        {/* Installed Workflows */}
        {installedWorkflows && installedWorkflows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Applications installées</CardTitle>
              <CardDescription>
                Gérez vos intégrations actives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {installedWorkflows.map((workflow) => {
                  const app = getAppDetails(workflow.app_name);
                  return (
                    <div
                      key={workflow.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          {app?.icon || <Zap className="h-6 w-6" />}
                        </div>
                        <div>
                          <p className="font-medium">{app?.name || workflow.app_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {app?.category || "Application"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {workflow.is_active ? "Actif" : "Inactif"}
                          </span>
                          <Switch
                            checked={workflow.is_active || false}
                            onCheckedChange={(checked) => 
                              toggleMutation.mutate({ id: workflow.id, isActive: checked })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => uninstallMutation.mutate(workflow.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Marketplace */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Marketplace</CardTitle>
                <CardDescription>
                  Découvrez et installez de nouvelles intégrations
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher des applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMarketplaceApps.map((app) => (
                <Card key={app.id} className="relative overflow-hidden">
                  {app.requiresHipaa && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        HIPAA
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        {app.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{app.name}</p>
                        <p className="text-xs text-muted-foreground">{app.category}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {app.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {app.features.slice(0, 2).map((feature) => (
                        <Badge key={feature} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      className="w-full"
                      variant={isInstalled(app.id) ? "secondary" : "default"}
                      disabled={isInstalled(app.id)}
                      onClick={() => handleInstall(app)}
                    >
                      {isInstalled(app.id) ? (
                        "Installée"
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Installer
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* HIPAA Modal */}
        <Dialog open={hipaaModalOpen} onOpenChange={setHipaaModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Conformité HIPAA requise
              </DialogTitle>
              <DialogDescription>
                L'application {selectedApp?.name} nécessite la conformité HIPAA car elle peut traiter des données de santé protégées.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium">Exigences HIPAA :</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Chiffrement des données en transit et au repos</li>
                  <li>• Journalisation des accès aux données</li>
                  <li>• Contrôles d'accès stricts</li>
                  <li>• Accord de partenariat commercial (BAA)</li>
                </ul>
              </div>
              
              <div className="flex items-start gap-3">
                <Checkbox
                  id="hipaa-accept"
                  checked={hipaaAccepted}
                  onCheckedChange={(checked) => setHipaaAccepted(checked as boolean)}
                />
                <label htmlFor="hipaa-accept" className="text-sm">
                  Je confirme que mon organisation est conforme aux exigences HIPAA et que j'ai l'autorisation d'activer cette intégration.
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setHipaaModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={confirmHipaaInstall} disabled={!hipaaAccepted}>
                Confirmer et installer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
