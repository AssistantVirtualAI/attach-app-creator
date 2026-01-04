import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const planIcons = [Zap, Sparkles, Crown];
const planColors = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-orange-500 to-amber-500',
];
const planPrices = ['69', '199', null]; // null for custom

export const PricingSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const planKeys = ['starter', 'pro', 'enterprise'] as const;

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent mb-6"
          >
            <Crown className="w-4 h-4" />
            <span className="text-sm font-medium">{t('pricing.badge')}</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t('pricing.title')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {planKeys.map((key, index) => {
            const Icon = planIcons[index];
            const isPopular = index === 1;
            const price = planPrices[index];
            const features = t(`pricing.${key}.features`);

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className={`relative rounded-3xl p-8 ${
                  isPopular 
                    ? "bg-gradient-to-b from-primary/20 to-card border-2 border-primary shadow-xl shadow-primary/20" 
                    : "bg-card/50 backdrop-blur-xl border border-border/50 hover:border-primary/50"
                } transition-all duration-300`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium shadow-lg"
                  >
                    {t('pricing.popular')}
                  </motion.div>
                )}

                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${planColors[index]} flex items-center justify-center mb-6 shadow-lg`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Plan info */}
                <h3 className="text-2xl font-bold mb-2">{t(`pricing.${key}.name`)}</h3>
                <p className="text-muted-foreground mb-6">{t(`pricing.${key}.description`)}</p>

                {/* Price */}
                <div className="mb-8">
                  {price ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${price}</span>
                      <span className="text-muted-foreground text-sm">CAD{t('pricing.perMonth')}</span>
                    </div>
                  ) : (
                    <span className="text-3xl font-bold">{t('pricing.custom')}</span>
                  )}
                </div>

                {/* CTA */}
                <Button
                  className={`w-full h-12 mb-8 ${
                    isPopular 
                      ? "bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/25" 
                      : ""
                  }`}
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => navigate("/auth")}
                >
                  {price ? t('pricing.cta') : t('pricing.ctaContact')}
                </Button>

                {/* Features */}
                <ul className="space-y-3">
                  {(Array.isArray(features) ? features : []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${planColors[index]} flex items-center justify-center flex-shrink-0`}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground mt-12"
        >
          {t('pricing.trial')}
        </motion.p>
      </div>
    </section>
  );
};
