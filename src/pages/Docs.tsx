import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, 
  Download, 
  Settings, 
  Key, 
  Webhook, 
  Shield, 
  Code, 
  Terminal,
  Zap,
  Users,
  CreditCard,
  Mail,
  Globe,
  FileText,
  Search,
  X,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";

const Docs = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("installation");

  // Search content mapping for filtering
  const searchableContent = useMemo(() => ({
    installation: [
      "installation", "guide", "prérequis", "node", "bun", "lovable", "stripe", "elevenlabs",
      "cloner", "repository", "npm", "variables", "environnement", "supabase", "smtp", "sentry",
      "démarrer", "serveur", "développement", "build", "production", "base de données", "postgresql",
      "migrations", "tables", "organizations", "clients", "agents", "conversations"
    ],
    integrations: [
      "elevenlabs", "agents vocaux", "api", "widget", "popup", "iframe", "transcription",
      "stripe", "paiements", "abonnements", "checkout", "webhook", "portal", "plans",
      "email", "smtp", "templates", "welcome", "password", "invitation", "2fa",
      "webhooks", "événements", "payload", "signature", "domaine", "dns", "cname"
    ],
    api: [
      "api", "authentification", "clé", "bearer", "token", "scopes", "endpoints",
      "conversations", "agents", "clients", "analytics", "webhooks", "rate limit"
    ]
  }), []);

  // Filter sections based on search
  const matchedSections = useMemo(() => {
    if (!searchQuery.trim()) return ["installation", "integrations", "api"];
    
    const query = searchQuery.toLowerCase();
    return Object.entries(searchableContent)
      .filter(([_, keywords]) => keywords.some(k => k.includes(query)))
      .map(([section]) => section);
  }, [searchQuery, searchableContent]);

  const hasResults = matchedSections.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-12 px-4">
        {/* Header with back link */}
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold">Documentation AVA Statistics</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Guide complet pour installer, configurer et utiliser la plateforme white-label SaaS pour agents vocaux IA
          </p>
          <Badge variant="secondary" className="mt-4">v1.0.0</Badge>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher dans la documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {hasResults 
                ? `${matchedSections.length} section(s) trouvée(s)` 
                : "Aucun résultat trouvé"}
            </p>
          )}
        </div>

        {/* Section Filters */}
        {searchQuery && hasResults && (
          <div className="flex justify-center gap-2 mb-6">
            {matchedSections.map((section) => (
              <Badge 
                key={section} 
                variant={activeTab === section ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setActiveTab(section)}
              >
                {section === "installation" && "Installation"}
                {section === "integrations" && "Intégrations"}
                {section === "api" && "API Reference"}
              </Badge>
            ))}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger 
              value="installation" 
              className="gap-2"
              disabled={searchQuery && !matchedSections.includes("installation")}
            >
              <Download className="h-4 w-4" />
              Installation
            </TabsTrigger>
            <TabsTrigger 
              value="integrations" 
              className="gap-2"
              disabled={searchQuery && !matchedSections.includes("integrations")}
            >
              <Settings className="h-4 w-4" />
              Intégrations
            </TabsTrigger>
            <TabsTrigger 
              value="api" 
              className="gap-2"
              disabled={searchQuery && !matchedSections.includes("api")}
            >
              <Code className="h-4 w-4" />
              API Reference
            </TabsTrigger>
          </TabsList>

          {/* Installation Tab */}
          <TabsContent value="installation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Guide d'Installation
                </CardTitle>
                <CardDescription>
                  Suivez ces étapes pour déployer votre instance AVA Statistics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Prerequisites */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Prérequis</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Node.js 18+ ou Bun</li>
                    <li>Compte Lovable (pour déploiement Cloud)</li>
                    <li>Compte Stripe (pour les paiements)</li>
                    <li>Clé API ElevenLabs (pour les agents vocaux)</li>
                  </ul>
                </div>

                <Separator />

                {/* Clone & Install */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">1. Cloner le Repository</h3>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <code>git clone https://github.com/your-org/ava-statistics.git</code><br />
                    <code>cd ava-statistics</code><br />
                    <code>npm install</code>
                  </div>
                </div>

                <Separator />

                {/* Environment Variables */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">2. Variables d'Environnement</h3>
                  <p className="text-muted-foreground mb-4">
                    Les variables sont gérées automatiquement par Lovable Cloud. Pour un déploiement local, créez un fichier <code className="bg-muted px-1 rounded">.env</code> :
                  </p>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto space-y-1">
                    <code># Supabase (auto-configuré par Lovable Cloud)</code><br />
                    <code>VITE_SUPABASE_URL=https://your-project.supabase.co</code><br />
                    <code>VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key</code><br /><br />
                    <code># Stripe</code><br />
                    <code>STRIPE_SECRET_KEY=sk_live_...</code><br />
                    <code>STRIPE_WEBHOOK_SECRET=whsec_...</code><br /><br />
                    <code># Email (SMTP)</code><br />
                    <code>SMTP_HOST=smtp.example.com</code><br />
                    <code>SMTP_PORT=587</code><br />
                    <code>SMTP_USER=your-email</code><br />
                    <code>SMTP_PASSWORD=your-password</code><br />
                    <code>EMAIL_FROM=noreply@example.com</code><br /><br />
                    <code># Monitoring (optionnel)</code><br />
                    <code>VITE_SENTRY_DSN=https://...</code>
                  </div>
                </div>

                <Separator />

                {/* Development Server */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">3. Démarrer le Serveur de Développement</h3>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                    <code>npm run dev</code>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    L'application sera accessible sur <code className="bg-muted px-1 rounded">http://localhost:5173</code>
                  </p>
                </div>

                <Separator />

                {/* Production Build */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">4. Build Production</h3>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                    <code>npm run build</code><br />
                    <code>npm run preview</code>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database Setup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Configuration Base de Données
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Lovable Cloud gère automatiquement la base de données PostgreSQL avec Supabase. 
                  Les migrations sont appliquées automatiquement lors du déploiement.
                </p>
                <div>
                  <h4 className="font-medium mb-2">Tables Principales</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {["organizations", "clients", "agents", "conversations", "billing_config", "user_roles", "webhook_endpoints", "audit_logs"].map((table) => (
                      <Badge key={table} variant="outline">{table}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            {/* ElevenLabs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  ElevenLabs - Agents Vocaux
                </CardTitle>
                <CardDescription>
                  Intégration avec ElevenLabs Conversational AI pour les agents vocaux
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Configuration</h4>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Créez un compte sur <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">elevenlabs.io</a></li>
                    <li>Générez une clé API dans les paramètres développeur</li>
                    <li>Créez un agent conversationnel dans la console ElevenLabs</li>
                    <li>Copiez l'ID de l'agent</li>
                    <li>Dans AVA Statistics : Intégrations → ElevenLabs → Ajouter</li>
                    <li>Entrez la clé API et l'ID de l'agent</li>
                  </ol>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Fonctionnalités</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Widget popup et iframe intégrables</li>
                    <li>Transcription en temps réel</li>
                    <li>Historique des conversations</li>
                    <li>Analyse de sentiment automatique</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Stripe */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                  Stripe - Paiements
                </CardTitle>
                <CardDescription>
                  Gestion des abonnements et paiements via Stripe
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Configuration</h4>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Créez un compte sur <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">stripe.com</a></li>
                    <li>Récupérez votre clé secrète (Developers → API Keys)</li>
                    <li>Configurez le webhook endpoint : <code className="bg-muted px-1 rounded">/functions/v1/stripe-webhook</code></li>
                    <li>Ajoutez les secrets dans Lovable Cloud</li>
                  </ol>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Plans Disponibles</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <h5 className="font-semibold">Starter</h5>
                      <p className="text-2xl font-bold">$1,200<span className="text-sm font-normal">/an</span></p>
                      <p className="text-muted-foreground text-sm">3 clients inclus</p>
                    </div>
                    <div className="border rounded-lg p-4 border-primary">
                      <h5 className="font-semibold">Growth</h5>
                      <p className="text-2xl font-bold">$3,000<span className="text-sm font-normal">/an</span></p>
                      <p className="text-muted-foreground text-sm">5 clients inclus</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h5 className="font-semibold">Ultimate</h5>
                      <p className="text-2xl font-bold">$6,000<span className="text-sm font-normal">/an</span></p>
                      <p className="text-muted-foreground text-sm">10 clients inclus</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-500" />
                  Email - SMTP
                </CardTitle>
                <CardDescription>
                  Configuration des emails transactionnels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Secrets Requis</h4>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1">
                    <code>SMTP_HOST</code> - Serveur SMTP<br />
                    <code>SMTP_PORT</code> - Port (587 pour TLS)<br />
                    <code>SMTP_USER</code> - Utilisateur<br />
                    <code>SMTP_PASSWORD</code> - Mot de passe<br />
                    <code>EMAIL_FROM</code> - Adresse expéditeur
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Templates Disponibles</h4>
                  <div className="flex flex-wrap gap-2">
                    {["welcome", "password_reset", "invitation", "subscription_confirm", "subscription_cancelled", "2fa"].map((template) => (
                      <Badge key={template} variant="secondary">{template}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-green-500" />
                  Webhooks Sortants
                </CardTitle>
                <CardDescription>
                  Configurez des webhooks pour recevoir des événements en temps réel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Événements Supportés</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "conversation.created",
                      "conversation.completed",
                      "agent.created",
                      "agent.updated",
                      "client.created",
                      "subscription.updated"
                    ].map((event) => (
                      <Badge key={event} variant="outline" className="justify-start">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Format de Payload</h4>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "event": "conversation.completed",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "id": "conv_123",
    "agent_id": "agent_456",
    "duration": 180,
    "transcript": "..."
  },
  "signature": "sha256=..."
}`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Domain */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-cyan-500" />
                  Domaine Personnalisé
                </CardTitle>
                <CardDescription>
                  Configurez votre propre domaine pour le white-label
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Accédez à SaaS Config → Domaine</li>
                  <li>Entrez votre domaine (ex: app.votreagence.com)</li>
                  <li>Ajoutez les enregistrements DNS fournis chez votre registrar</li>
                  <li>Attendez la propagation DNS (jusqu'à 48h)</li>
                  <li>Cliquez sur "Vérifier" pour activer</li>
                </ol>
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="font-medium mb-2">Enregistrements DNS Requis</h4>
                  <div className="font-mono text-sm">
                    <code>CNAME app → votre-projet.lovable.app</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Reference Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Authentification API
                </CardTitle>
                <CardDescription>
                  Utilisez des clés API pour accéder aux endpoints de l'API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Créer une Clé API</h4>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Accédez à Paramètres → Clés API</li>
                    <li>Cliquez sur "Créer une clé"</li>
                    <li>Sélectionnez les scopes nécessaires</li>
                    <li>Copiez la clé (affichée une seule fois)</li>
                  </ol>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Utilisation</h4>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                    <code>Authorization: Bearer YOUR_API_KEY</code>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Scopes Disponibles</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "read:analytics",
                      "read:conversations",
                      "write:agents",
                      "write:clients",
                      "admin:billing",
                      "admin:settings"
                    ].map((scope) => (
                      <Badge key={scope} variant="outline">{scope}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Endpoints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-6">
                    {/* Conversations */}
                    <div>
                      <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Badge>Conversations</Badge>
                      </h4>
                      <div className="space-y-3">
                        <EndpointItem
                          method="GET"
                          path="/api/conversations"
                          description="Liste toutes les conversations"
                          scope="read:conversations"
                        />
                        <EndpointItem
                          method="GET"
                          path="/api/conversations/:id"
                          description="Détails d'une conversation"
                          scope="read:conversations"
                        />
                        <EndpointItem
                          method="DELETE"
                          path="/api/conversations/:id"
                          description="Supprimer une conversation"
                          scope="write:conversations"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Agents */}
                    <div>
                      <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Badge>Agents</Badge>
                      </h4>
                      <div className="space-y-3">
                        <EndpointItem
                          method="GET"
                          path="/api/agents"
                          description="Liste tous les agents"
                          scope="read:agents"
                        />
                        <EndpointItem
                          method="POST"
                          path="/api/agents"
                          description="Créer un agent"
                          scope="write:agents"
                        />
                        <EndpointItem
                          method="PUT"
                          path="/api/agents/:id"
                          description="Modifier un agent"
                          scope="write:agents"
                        />
                        <EndpointItem
                          method="DELETE"
                          path="/api/agents/:id"
                          description="Supprimer un agent"
                          scope="write:agents"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Clients */}
                    <div>
                      <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Badge>Clients</Badge>
                      </h4>
                      <div className="space-y-3">
                        <EndpointItem
                          method="GET"
                          path="/api/clients"
                          description="Liste tous les clients"
                          scope="read:clients"
                        />
                        <EndpointItem
                          method="POST"
                          path="/api/clients"
                          description="Créer un client"
                          scope="write:clients"
                        />
                        <EndpointItem
                          method="PUT"
                          path="/api/clients/:id"
                          description="Modifier un client"
                          scope="write:clients"
                        />
                        <EndpointItem
                          method="DELETE"
                          path="/api/clients/:id"
                          description="Supprimer un client"
                          scope="write:clients"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Analytics */}
                    <div>
                      <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Badge>Analytics</Badge>
                      </h4>
                      <div className="space-y-3">
                        <EndpointItem
                          method="GET"
                          path="/api/analytics/overview"
                          description="Métriques globales"
                          scope="read:analytics"
                        />
                        <EndpointItem
                          method="GET"
                          path="/api/analytics/conversations"
                          description="Statistiques conversations"
                          scope="read:analytics"
                        />
                        <EndpointItem
                          method="GET"
                          path="/api/analytics/agents/:id"
                          description="Métriques par agent"
                          scope="read:analytics"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Webhooks */}
                    <div>
                      <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        <Badge>Webhooks</Badge>
                      </h4>
                      <div className="space-y-3">
                        <EndpointItem
                          method="GET"
                          path="/api/webhooks"
                          description="Liste des endpoints webhook"
                          scope="admin:settings"
                        />
                        <EndpointItem
                          method="POST"
                          path="/api/webhooks"
                          description="Créer un endpoint"
                          scope="admin:settings"
                        />
                        <EndpointItem
                          method="DELETE"
                          path="/api/webhooks/:id"
                          description="Supprimer un endpoint"
                          scope="admin:settings"
                        />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Rate Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Rate Limits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold">1000</p>
                    <p className="text-muted-foreground">requêtes/heure</p>
                    <Badge className="mt-2">Starter</Badge>
                  </div>
                  <div className="border rounded-lg p-4 text-center border-primary">
                    <p className="text-3xl font-bold">5000</p>
                    <p className="text-muted-foreground">requêtes/heure</p>
                    <Badge className="mt-2">Growth</Badge>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold">∞</p>
                    <p className="text-muted-foreground">illimité</p>
                    <Badge className="mt-2">Ultimate</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-12 text-center text-muted-foreground">
          <p>Besoin d'aide ? Contactez <a href="mailto:support@avastatistics.com" className="text-primary hover:underline">support@avastatistics.com</a></p>
          <p className="mt-2">
            <a href="/legal" className="hover:underline">Mentions légales</a>
            {" • "}
            <a href="/privacy" className="hover:underline">Politique de confidentialité</a>
          </p>
        </div>
      </div>
    </div>
  );
};

// Helper component for API endpoints
const EndpointItem = ({ 
  method, 
  path, 
  description, 
  scope 
}: { 
  method: string; 
  path: string; 
  description: string; 
  scope: string;
}) => {
  const methodColors: Record<string, string> = {
    GET: "bg-green-500/10 text-green-600 border-green-500/20",
    POST: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    PUT: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-card">
      <Badge variant="outline" className={methodColors[method]}>
        {method}
      </Badge>
      <code className="font-mono text-sm flex-1">{path}</code>
      <span className="text-muted-foreground text-sm hidden md:block">{description}</span>
      <Badge variant="secondary" className="text-xs">{scope}</Badge>
    </div>
  );
};

export default Docs;
