import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Mail, Lock, User, ArrowLeft, Chrome, Globe, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AnimatedFeatures } from '@/components/auth/AnimatedFeatures';
import { useTranslation } from '@/hooks/useTranslation';
import { useLanguage } from '@/context/LanguageContext';

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
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();

  useEffect(() => {
    if (user && mode !== 'reset') {
      navigate('/home');
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
          navigate('/home');
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
          navigate('/home');
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
      case 'login': return t('auth.login');
      case 'signup': return t('auth.signup');
      case 'reset': return t('auth.resetPassword');
      default: return 'AVA Statistics';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'login': return t('auth.description.login');
      case 'signup': return t('auth.description.signup');
      case 'reset': return t('auth.description.reset');
      default: return '';
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-background relative"
      >
        {/* Language toggle */}
        <motion.button
          onClick={toggleLanguage}
          className="absolute top-6 right-6 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Globe className="w-4 h-4" />
          <span>{language === 'fr' ? 'EN' : 'FR'}</span>
        </motion.button>

        {/* Back to landing */}
        <Link to="/">
          <motion.button
            className="absolute top-6 left-6 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Home className="w-4 h-4" />
            <span>{t('auth.buttons.backToHome') || 'Accueil'}</span>
          </motion.button>
        </Link>

        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-3 mb-8">
              <motion.div 
                whileHover={{ rotate: 10, scale: 1.1 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25"
              >
                <Activity className="w-7 h-7 text-white" />
              </motion.div>
              <span className="text-2xl font-bold">AVA Statistics</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">{getTitle()}</h1>
            <p className="text-muted-foreground">{getDescription()}</p>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            {/* Google OAuth Button */}
            {(mode === 'login' || mode === 'signup') && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 gap-3 bg-card hover:bg-muted border-border"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <Chrome className="w-5 h-5" />
                  {t('auth.buttons.continueWithGoogle')}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('common.or')}</span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <Label htmlFor="fullName" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {t('auth.labels.fullName')}
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder={t('auth.placeholders.fullName')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-12 bg-card border-border focus:border-primary focus:ring-primary"
                  />
                </motion.div>
              )}

              {mode !== 'reset' && (
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('auth.labels.email')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.placeholders.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-card border-border focus:border-primary focus:ring-primary"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {mode === 'reset' ? t('auth.labels.newPassword') : t('auth.labels.password')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('auth.placeholders.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 bg-card border-border focus:border-primary focus:ring-primary"
                />
              </div>

              {mode === 'reset' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {t('auth.labels.confirmPassword')}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('auth.placeholders.password')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 bg-card border-border focus:border-primary focus:ring-primary"
                  />
                  {password !== confirmPassword && confirmPassword && (
                    <p className="text-sm text-destructive">{t('auth.errors.passwordMismatch')}</p>
                  )}
                </motion.div>
              )}

              {mode === 'login' && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-muted-foreground hover:text-primary p-0 h-auto"
                    onClick={() => setShowForgotDialog(true)}
                  >
                    {t('auth.buttons.forgotPassword')}
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white shadow-lg shadow-primary/25"
                disabled={loading || (mode === 'reset' && password !== confirmPassword)}
              >
                {loading ? t('auth.buttons.loading') : 
                  mode === 'login' ? t('auth.buttons.login') : 
                  mode === 'signup' ? t('auth.buttons.signup') :
                  t('auth.buttons.updatePassword')}
              </Button>

              {mode !== 'reset' && (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                    className="text-primary hover:text-primary/80"
                  >
                    {mode === 'login' ? t('auth.buttons.noAccount') : t('auth.buttons.hasAccount')}
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
                  {t('auth.buttons.backToLogin')}
                </Button>
              )}
            </form>
          </motion.div>

          {/* Footer links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-muted-foreground"
          >
            <p>
              {t('auth.legal.prefix')}{' '}
              <a href="/legal" className="text-primary hover:underline">{t('auth.legal.terms')}</a>
              {' '}{t('auth.legal.and')}{' '}
              <a href="/privacy" className="text-primary hover:underline">{t('auth.legal.privacy')}</a>
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Right side - Animated Features */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:block w-[55%] bg-gradient-to-br from-primary/90 via-secondary/90 to-accent/90 relative overflow-hidden"
      >
        <AnimatedFeatures />
      </motion.div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('auth.forgotDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('auth.forgotDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgotEmail">{t('auth.labels.email')}</Label>
              <Input
                id="forgotEmail"
                type="email"
                placeholder={t('auth.placeholders.email')}
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="bg-card"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotDialog(false)}
              >
                {t('auth.buttons.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('auth.buttons.sending') : t('auth.buttons.sendLink')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthPage;
