import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePortal, PortalProvider } from '@/hooks/usePortalAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Bot, AlertTriangle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const PortalLoginContent = () => {
  const { agentSlug } = useParams<{ agentSlug: string }>();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [agentInfo, setAgentInfo] = useState<{ name: string; avatar_url?: string } | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const { login, isLoading, isAuthenticated, session } = usePortal();
  const navigate = useNavigate();

  // Load agent info from slug
  useEffect(() => {
    const loadAgent = async () => {
      if (!agentSlug) return;
      
      const { data, error } = await supabase
        .from('agents')
        .select('name, avatar_url')
        .eq('slug', agentSlug)
        .single();

      if (error || !data) {
        setError('Agent non trouvé');
      } else {
        setAgentInfo(data);
      }
      setLoadingAgent(false);
    };

    loadAgent();
  }, [agentSlug]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && session?.agentSlug === agentSlug) {
      navigate(`/portal/${agentSlug}/dashboard`);
    }
  }, [isAuthenticated, session, agentSlug, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agentSlug) {
      setError('Agent non spécifié');
      return;
    }

    try {
      await login(agentSlug, loginId, password);
      navigate(`/portal/${agentSlug}/dashboard`);
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    }
  };

  if (loadingAgent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex">
      {/* Left side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-xl">
            <CardHeader className="text-center pb-2">
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg"
              >
                {agentInfo?.avatar_url ? (
                  <img 
                    src={agentInfo.avatar_url} 
                    alt={agentInfo.name} 
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <Bot className="h-10 w-10 text-white" />
                )}
              </motion.div>
              <CardTitle className="text-2xl font-bold">
                {agentInfo?.name || 'Portail Agent'}
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Connectez-vous pour accéder à votre tableau de bord
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="loginId">Identifiant</Label>
                  <Input
                    id="loginId"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="Votre identifiant client"
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity" 
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Se connecter
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  to="/client/forgot-password" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Right side - Features */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-md space-y-8"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold gradient-text">AVA Statistics</h2>
          </div>

          {[
            { title: 'Tableau de bord', desc: 'Visualisez les performances de votre agent en temps réel' },
            { title: 'Conversations', desc: 'Accédez à l\'historique complet des conversations' },
            { title: 'Analytics', desc: 'Analysez les tendances et métriques clés' },
            { title: 'Base de connaissances', desc: 'Gérez le contenu de votre agent' },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
              className="flex gap-4 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

const PortalLogin = () => (
  <PortalProvider>
    <PortalLoginContent />
  </PortalProvider>
);

export default PortalLogin;
