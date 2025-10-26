import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Save } from 'lucide-react';

const AgentConfig = () => {
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Configuration Agent IA</h1>
          <p className="text-muted-foreground text-lg">
            Personnalisez le comportement de votre assistant vocal
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="glass-card">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="voice">Voix</TabsTrigger>
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="behavior">Comportement</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Informations Générales</CardTitle>
                    <CardDescription>Configuration de base de l'agent</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de l'agent</Label>
                  <Input
                    id="name"
                    defaultValue="AVA Assistant"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt Système</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Vous êtes un assistant vocal IA intelligent..."
                    rows={8}
                    defaultValue="Vous êtes AVA, un assistant vocal IA professionnel et serviable. Votre objectif est d'aider les utilisateurs avec leurs questions de manière claire et concise."
                    className="bg-background/50 font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground">
                    Définit le comportement global et la personnalité de l'agent
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firstMessage">Premier Message</Label>
                  <Input
                    id="firstMessage"
                    defaultValue="Bonjour ! Comment puis-je vous aider aujourd'hui ?"
                    className="bg-background/50"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Agent Actif</Label>
                    <p className="text-sm text-muted-foreground">
                      Activer ou désactiver cet agent
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voice" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Paramètres Vocaux</CardTitle>
                <CardDescription>Configurez la voix de l'agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="voiceId">ID de la Voix (ElevenLabs)</Label>
                  <Input
                    id="voiceId"
                    placeholder="21m00Tcm4TlvDq8ikWAM"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Stabilité</Label>
                      <span className="text-sm text-muted-foreground">0.5</span>
                    </div>
                    <Slider defaultValue={[0.5]} max={1} step={0.01} />
                    <p className="text-sm text-muted-foreground">
                      Contrôle la cohérence de la voix
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Similarité</Label>
                      <span className="text-sm text-muted-foreground">0.75</span>
                    </div>
                    <Slider defaultValue={[0.75]} max={1} step={0.01} />
                    <p className="text-sm text-muted-foreground">
                      Proximité avec la voix originale
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Style</Label>
                      <span className="text-sm text-muted-foreground">0.0</span>
                    </div>
                    <Slider defaultValue={[0]} max={1} step={0.01} />
                    <p className="text-sm text-muted-foreground">
                      Expressivité de la voix
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversation" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Paramètres de Conversation</CardTitle>
                <CardDescription>Configuration du modèle LLM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Température</Label>
                      <span className="text-sm text-muted-foreground">0.8</span>
                    </div>
                    <Slider defaultValue={[0.8]} max={2} step={0.1} />
                    <p className="text-sm text-muted-foreground">
                      Créativité des réponses (0 = précis, 2 = créatif)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">Tokens Maximum</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      defaultValue="150"
                      className="bg-background/50"
                    />
                    <p className="text-sm text-muted-foreground">
                      Longueur maximale des réponses
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Comportement</CardTitle>
                <CardDescription>Options avancées de comportement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Interruptions Autorisées</Label>
                    <p className="text-sm text-muted-foreground">
                      Permettre à l'utilisateur d'interrompre l'agent
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Détection de Sentiment</Label>
                    <p className="text-sm text-muted-foreground">
                      Adapter les réponses selon l'émotion détectée
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Logs Détaillés</Label>
                    <p className="text-sm text-muted-foreground">
                      Enregistrer toutes les interactions
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end mt-8">
          <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-accent">
            <Save className="w-5 h-5" />
            Enregistrer la Configuration
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AgentConfig;