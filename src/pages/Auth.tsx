import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, Mail, Lock, User, ArrowLeft, Chrome } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  
  const { signIn, signUp, signInWithGoogle, resetPassword, updatePassword, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && mode !== 'reset') {
      navigate('/');
    }
  }, [user, navigate, mode]);

  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'reset') {
      setMode('reset');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (!error) {
          navigate('/');
        }
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName);
        if (!error) {
          setMode('login');
        }
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          return;
        }
        const { error } = await updatePassword(password);
        if (!error) {
          navigate('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await resetPassword(forgotEmail);
      if (!error) {
        setShowForgotDialog(false);
        setForgotEmail('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Connexion';
      case 'signup': return 'Créer un compte';
      case 'reset': return 'Nouveau mot de passe';
      default: return 'AVA Statistics';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'login': return 'Connectez-vous à votre compte';
      case 'signup': return 'Créez votre compte pour commencer';
      case 'reset': return 'Entrez votre nouveau mot de passe';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] cyber-grid flex items-center justify-center p-6">
      <Card className="w-full max-w-md glass-card neon-border">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-neon">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold gradient-text">{getTitle()}</CardTitle>
          <CardDescription className="text-base">{getDescription()}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Google OAuth Button */}
          {(mode === 'login' || mode === 'signup') && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 gap-3 bg-background/50 hover:bg-background/80 border-border/50"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <Chrome className="w-5 h-5" />
                Continuer avec Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nom complet
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="bg-background/50 h-11"
                />
              </div>
            )}

            {mode !== 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50 h-11"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-background/50 h-11"
              />
            </div>

            {mode === 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirmer le mot de passe
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-background/50 h-11"
                />
                {password !== confirmPassword && confirmPassword && (
                  <p className="text-sm text-destructive">Les mots de passe ne correspondent pas</p>
                )}
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-muted-foreground hover:text-primary p-0 h-auto"
                  onClick={() => setShowForgotDialog(true)}
                >
                  Mot de passe oublié ?
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-neon"
              disabled={loading || (mode === 'reset' && password !== confirmPassword)}
            >
              {loading ? 'Chargement...' : 
                mode === 'login' ? 'Se connecter' : 
                mode === 'signup' ? "S'inscrire" :
                'Mettre à jour le mot de passe'}
            </Button>

            {mode !== 'reset' && (
              <div className="text-center space-y-2">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-primary hover:text-primary-glow"
                >
                  {mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
                </Button>
              </div>
            )}

            {mode === 'reset' && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMode('login');
                  navigate('/auth');
                }}
                className="w-full gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mot de passe oublié</DialogTitle>
            <DialogDescription>
              Entrez votre adresse email pour recevoir un lien de réinitialisation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgotEmail">Email</Label>
              <Input
                id="forgotEmail"
                type="email"
                placeholder="vous@exemple.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotDialog(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthPage;
