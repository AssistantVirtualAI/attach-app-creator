import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Palette, Users, Plug, Webhook, CreditCard, BarChart3, Languages, Shield, FileText } from 'lucide-react';
import { AgencyTab } from '@/components/settings/AgencyTab';
import { WhiteLabelTab } from '@/components/settings/WhiteLabelTab';
import { MembersTab } from '@/components/settings/MembersTab';
import { IntegrationsTab } from '@/components/settings/IntegrationsTab';
import { WebhooksTab } from '@/components/settings/WebhooksTab';
import { SubscriptionTab } from '@/components/settings/SubscriptionTab';
import { UsageTab } from '@/components/settings/UsageTab';
import { TranslationTab } from '@/components/settings/TranslationTab';
import { PrivacyTab } from '@/components/settings/PrivacyTab';
import { AuditLogsTab } from '@/components/settings/AuditLogsTab';
import { SecurityStatus } from '@/components/settings/SecurityStatus';

const Settings = () => {
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Paramètres</h1>
          <p className="text-muted-foreground text-lg">
            Gérez votre organisation et vos préférences
          </p>
        </div>

        <Tabs defaultValue="agency" className="space-y-6">
          <TabsList className="glass-card flex-wrap h-auto gap-1 p-2">
            <TabsTrigger value="agency" className="gap-2">
              <Building className="w-4 h-4" />
              <span className="hidden sm:inline">Agence</span>
            </TabsTrigger>
            <TabsTrigger value="whitelabel" className="gap-2">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Marque blanche</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Membres</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="w-4 h-4" />
              <span className="hidden sm:inline">Intégrations</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="w-4 h-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Abonnement</span>
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Usage</span>
            </TabsTrigger>
            <TabsTrigger value="translation" className="gap-2">
              <Languages className="w-4 h-4" />
              <span className="hidden sm:inline">Traduction</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Confidentialité</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agency"><AgencyTab /></TabsContent>
          <TabsContent value="whitelabel"><WhiteLabelTab /></TabsContent>
          <TabsContent value="members"><MembersTab /></TabsContent>
          <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
          <TabsContent value="webhooks"><WebhooksTab /></TabsContent>
          <TabsContent value="subscription"><SubscriptionTab /></TabsContent>
          <TabsContent value="usage"><UsageTab /></TabsContent>
          <TabsContent value="translation"><TranslationTab /></TabsContent>
          <TabsContent value="privacy">
            <div className="space-y-6">
              <SecurityStatus />
              <PrivacyTab />
            </div>
          </TabsContent>
          <TabsContent value="audit"><AuditLogsTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;