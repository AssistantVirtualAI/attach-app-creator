import { motion } from "framer-motion";
import { 
  BarChart3, 
  MessageSquare, 
  BookOpen, 
  Plug, 
  Workflow, 
  TrendingUp,
  Bot,
  Shield,
  Zap
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Analytics Avancés",
    description: "Suivez les performances de vos agents en temps réel avec des tableaux de bord interactifs et des insights IA.",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: MessageSquare,
    title: "Conversations IA",
    description: "Analysez chaque conversation avec l'IA : sentiment, satisfaction, résolution automatique.",
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: BookOpen,
    title: "Base de Connaissances",
    description: "Enrichissez vos agents avec une base de connaissances personnalisée et évolutive.",
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: Plug,
    title: "Intégrations Multiples",
    description: "Connectez ElevenLabs, Vapi, Retell et bien d'autres plateformes en un clic.",
    color: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-500/10",
  },
  {
    icon: Workflow,
    title: "Automatisations",
    description: "Créez des workflows personnalisés pour automatiser vos processus métier.",
    color: "from-pink-500 to-rose-500",
    bgColor: "bg-pink-500/10",
  },
  {
    icon: TrendingUp,
    title: "Rapports Intelligents",
    description: "Générez des rapports automatiques avec des recommandations d'amélioration par l'IA.",
    color: "from-indigo-500 to-violet-500",
    bgColor: "bg-indigo-500/10",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
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
  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-secondary mb-6"
          >
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Fonctionnalités puissantes</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Une suite complète d'outils pour créer, gérer et optimiser vos agents IA conversationnels.
          </p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative p-8 rounded-3xl bg-card/50 backdrop-blur-xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
            >
              {/* Hover glow effect */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${feature.bgColor} blur-xl`} />
              
              <div className="relative z-10">
                {/* Icon */}
                <motion.div
                  whileHover={{ rotate: 5, scale: 1.1 }}
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg`}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </motion.div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex items-center gap-8 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border border-primary/20">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-primary" />
              <span className="text-lg font-semibold">+1000 agents déployés</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-secondary" />
              <span className="text-lg font-semibold">+500k conversations</span>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />
            <div className="hidden md:flex items-center gap-3">
              <Shield className="w-8 h-8 text-accent" />
              <span className="text-lg font-semibold">99.9% uptime</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
