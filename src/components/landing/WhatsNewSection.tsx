import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Tag, LayoutList, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

const FEATURES = [
  { key: 'rbac', icon: Shield, gradient: 'from-indigo-500 to-purple-600' },
  { key: 'customTags', icon: Tag, gradient: 'from-pink-500 to-rose-600' },
  { key: 'dataView', icon: LayoutList, gradient: 'from-emerald-500 to-teal-600' },
  { key: 'embedded', icon: BarChart3, gradient: 'from-amber-500 to-orange-600' },
] as const;

export function WhatsNewSection() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % FEATURES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-20 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-1 text-sm border-primary/30">
            {t('whatsNew.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-3 gradient-text">
            {t('whatsNew.title')}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('whatsNew.subtitle')}
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-4 gap-4">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            const isActive = idx === active;

            return (
              <motion.button
                key={feat.key}
                onClick={() => setActive(idx)}
                className={cn(
                  'relative text-left p-6 rounded-2xl border transition-all duration-300',
                  'bg-card/50 backdrop-blur-sm hover:bg-card/80',
                  isActive
                    ? 'border-primary/40 shadow-lg shadow-primary/10 scale-[1.02]'
                    : 'border-border/50'
                )}
                whileHover={{ y: -2 }}
              >
                {/* Progress bar for auto-cycle */}
                {isActive && (
                  <motion.div
                    className="absolute top-0 left-0 h-0.5 bg-primary rounded-t-2xl"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 4, ease: 'linear' }}
                  />
                )}

                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br',
                  feat.gradient,
                )}>
                  <Icon className="h-5 w-5 text-white" />
                </div>

                <h3 className="font-semibold text-sm mb-2">
                  {t(`whatsNew.${feat.key}.title`)}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t(`whatsNew.${feat.key}.description`)}
                </p>
              </motion.button>
            );
          })}
        </div>

        {/* Active feature detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-8 p-6 rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              {(() => {
                const Icon = FEATURES[active].icon;
                return (
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br',
                    FEATURES[active].gradient
                  )}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                );
              })()}
              <h3 className="font-semibold">{t(`whatsNew.${FEATURES[active].key}.title`)}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              {t(`whatsNew.${FEATURES[active].key}.detail`)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
