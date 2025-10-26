import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Play, Pause, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState } from 'react';

const ConversationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock data
  const conversation = {
    id,
    title: 'Support Client - Problème de connexion',
    duration: 245,
    platform: 'elevenlabs',
    status: 'completed',
    sentiment: 'positive',
    satisfaction_score: 4.5,
    created_at: new Date('2025-10-26T14:30:00'),
    transcript: `Agent: Bonjour, comment puis-je vous aider aujourd'hui?

Client: Bonjour, j'ai un problème avec ma connexion.

Agent: Je comprends. Pouvez-vous me donner plus de détails sur le problème?

Client: Je n'arrive pas à me connecter à mon compte depuis ce matin.

Agent: D'accord, je vais vérifier ça tout de suite. Pouvez-vous me confirmer votre adresse email?

Client: Oui, c'est jean.dupont@example.com

Agent: Merci. Je vois que votre compte est actif. Essayez de réinitialiser votre mot de passe.

Client: D'accord, je vais essayer. Merci beaucoup!

Agent: De rien! N'hésitez pas si vous avez d'autres questions.`,
    keywords: ['Connexion', 'Support', 'Problème technique', 'Compte utilisateur'],
    analysis: {
      summary: 'Demande de support pour un problème de connexion résolu par une réinitialisation de mot de passe.',
      emotions: [
        { emotion: 'Frustration', level: 40 },
        { emotion: 'Satisfaction', level: 85 },
        { emotion: 'Confiance', level: 75 },
      ],
      resolution: 'Résolu avec succès',
    },
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-5 h-5 text-success" />;
      case 'negative':
        return <TrendingDown className="w-5 h-5 text-destructive" />;
      default:
        return <Minus className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/conversations')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux conversations
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 gradient-text">{conversation.title}</h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {Math.floor(conversation.duration / 60)}m {conversation.duration % 60}s
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  {conversation.platform}
                </Badge>
                {getSentimentIcon(conversation.sentiment)}
                <span>Satisfaction: {conversation.satisfaction_score}/5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="glass-card">
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="transcript">Transcription</TabsTrigger>
            <TabsTrigger value="analysis">Analyse IA</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plateforme</span>
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      {conversation.platform}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Statut</span>
                    <Badge variant="outline">{conversation.status}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sentiment</span>
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(conversation.sentiment)}
                      <span className="capitalize">{conversation.sentiment}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Satisfaction</span>
                    <span className="font-semibold">{conversation.satisfaction_score}/5</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Mots-clés</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {conversation.keywords.map((keyword, i) => (
                      <Badge key={i} variant="outline">{keyword}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audio">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Lecteur Audio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center gap-4">
                  <Button
                    size="lg"
                    className="w-16 h-16 rounded-full"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-primary"></div>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>1:20</span>
                    <span>4:05</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Transcription Complète</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {conversation.transcript}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Résumé IA</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{conversation.analysis.summary}</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Analyse des Émotions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {conversation.analysis.emotions.map((emotion, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{emotion.emotion}</span>
                      <span>{emotion.level}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${emotion.level}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Résolution</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-success/20 text-success border-success/30">
                  {conversation.analysis.resolution}
                </Badge>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ConversationDetail;