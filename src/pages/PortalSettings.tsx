import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Settings, Volume2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const PortalSettings = () => {
  const { session, hasEditAccess } = usePortal();
  const canEdit = hasEditAccess();

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Settings className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg">Accès refusé</p>
        <p className="text-sm">Vous n'avez pas les permissions pour accéder à cette page</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-hot-pink to-vivid-purple flex items-center justify-center">
          <Settings className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configuration</h1>
          <p className="text-muted-foreground">{session?.agentName}</p>
        </div>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Volume2 className="h-5 w-5 text-primary" />Paramètres de la voix</CardTitle>
          <CardDescription>Ajustez les caractéristiques de la voix de l'agent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {['Stabilité', 'Similarité', 'Style'].map((label) => (
            <div key={label} className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">{label}</Label>
                <span className="text-lg font-mono font-semibold text-primary">50%</span>
              </div>
              <Slider defaultValue={[0.5]} max={1} step={0.01} className="cursor-pointer" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Conseil</h3>
              <p className="text-sm text-muted-foreground">
                Pour de meilleurs résultats, ajustez la stabilité entre 0.3 et 0.7.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PortalSettings;
