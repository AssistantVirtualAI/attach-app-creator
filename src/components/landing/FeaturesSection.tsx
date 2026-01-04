import { motion } from "framer-motion";
import { Bot, Users, BarChart3, BookOpen, Globe2, Zap } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const featureIcons = [Bot, Users, BarChart3, BookOpen, Globe2, Zap];
const featureColors = [
  { bg: 'from-blue-500/20 to-cyan-500/20', icon: 'from-blue-500 to-cyan-500' },
  { bg: 'from-purple-500/20 to-pink-500/20', icon: 'from-purple-500 to-pink-500' },
  { bg: 'from-orange-500/20 to-amber-500/20', icon: 'from-orange-500 to-amber-500' },
  { bg: 'from-green-500/20 to-emerald-500/20', icon: 'from-green-500 to-emerald-500' },
  { bg: 'from-indigo-500/20 to-violet-500/20', icon: 'from-indigo-500 to-violet-500' },
  { bg: 'from-red-500/20 to-rose-500/20', icon: 'from-red-500 to-rose-500' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export const FeaturesSection = () => {
  const { t } = useTranslation();

  const featureKeys = ['feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'feature6'] as const;

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-50" />

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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-6"
          >
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">{t('features.badge')}</span>
          </motion.div>

          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t('features.title')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20"
        >
          {featureKeys.map((key, index) => {
            const Icon = featureIcons[index];
            const colors = featureColors[index];

            return (
              <motion.div
                key={key}
                variants={itemVariants}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className={`relative p-8 rounded-3xl bg-gradient-to-br ${colors.bg} backdrop-blur-xl border border-border/50 group cursor-pointer`}
              >
                {/* Glow effect on hover */}
                <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${colors.icon} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colors.icon} flex items-center justify-center mb-6 shadow-lg`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-muted-foreground">
                  {t(`features.${key}.description`)}
                </p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-8 md:gap-16"
        >
          {['stat1', 'stat2', 'stat3'].map((stat, index) => (
            <motion.div
              key={stat}
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                {t(`features.${stat}.value`)}
              </div>
              <div className="text-muted-foreground">
                {t(`features.${stat}.label`)}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
