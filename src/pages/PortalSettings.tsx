import { useState } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings, Volume2, Sparkles, Play, Mic, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';

const PortalSettings = () => {
  const { session, hasEditAccess } = usePortal();
  const canEdit = hasEditAccess();
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.5,
    similarity: 0.75,
    style: 0.3,
  });

  if (!canEdit) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24"
      >
        <div className="w-24 h-24 rounded-2xl bg-muted/20 flex items-center justify-center mb-6">
          <Settings className="h-12 w-12 text-muted-foreground/30" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
        <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder à cette page</p>
      </motion.div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <PortalPageHeader
        icon={Settings}
        title="Configuration"
        description={session?.agentName}
        gradient="pink-orange"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Voice Settings */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="bg-card/50 backdrop-blur-sm border-border/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                Paramètres de la voix
              </CardTitle>
              <CardDescription>Ajustez les caractéristiques de la voix de l'agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {[
                { key: 'stability', label: 'Stabilité', desc: 'Contrôle la consistance de la voix' },
                { key: 'similarity', label: 'Similarité', desc: 'Fidélité à la voix originale' },
                { key: 'style', label: 'Style', desc: 'Expressivité et émotion' },
              ].map((setting) => (
                <div key={setting.key} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">{setting.label}</Label>
                      <p className="text-xs text-muted-foreground">{setting.desc}</p>
                    </div>
                    <span className="text-lg font-mono font-semibold text-primary">
                      {Math.round(voiceSettings[setting.key as keyof typeof voiceSettings] * 100)}%
                    </span>
                  </div>
                  <Slider 
                    value={[voiceSettings[setting.key as keyof typeof voiceSettings]]}
                    onValueChange={([value]) => setVoiceSettings(prev => ({ ...prev, [setting.key]: value }))}
                    max={1} 
                    step={0.01} 
                    className="cursor-pointer"
                  />
                </div>
              ))}

              <div className="flex items-center gap-3 pt-4">
                <Button variant="outline" className="gap-2">
                  <Play className="h-4 w-4" />
                  Tester la voix
                </Button>
                <Button className="gap-2 bg-gradient-to-r from-primary to-purple-500">
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Agent Options */}
        <motion.div variants={itemVariants} className="space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-purple-400" />
                Options de l'agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Détection de silence', enabled: true },
                { label: 'Interruption autorisée', enabled: false },
                { label: 'Enregistrement des appels', enabled: true },
              ].map((option) => (
                <div key={option.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                  <span className="text-sm font-medium">{option.label}</span>
                  <Switch defaultChecked={option.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card className="bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 border-border/30">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    Conseil IA
                    <Zap className="h-3 w-3 text-yellow-400" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Pour de meilleurs résultats, ajustez la stabilité entre 0.3 et 0.7. 
                    Une valeur trop haute peut rendre la voix monotone.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default PortalSettings;
