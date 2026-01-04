import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, 
  Bot, 
  MessageSquare, 
  BookOpen, 
  Plug,
  TrendingUp,
  Shield,
  Zap
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Analytics en temps réel",
    description: "Suivez les performances de vos agents avec des tableaux de bord interactifs et des métriques détaillées.",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/20",
  },
  {
    icon: Bot,
    title: "Agents IA Intelligents",
    description: "Créez des agents conversationnels puissants capables de comprendre et répondre naturellement.",
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/20",
  },
  {
    icon: MessageSquare,
    title: "Gestion des Conversations",
    description: "Analysez chaque conversation avec l'IA : sentiment, satisfaction et recommandations automatiques.",
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-500/20",
  },
  {
    icon: BookOpen,
    title: "Base de Connaissances",
    description: "Enrichissez vos agents avec une base de connaissances personnalisée et évolutive.",
    color: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-500/20",
  },
  {
    icon: Plug,
    title: "Intégrations Multiples",
    description: "Connectez ElevenLabs, Vapi, Retell et bien d'autres plateformes en quelques clics.",
    color: "from-pink-500 to-rose-500",
    bgColor: "bg-pink-500/20",
  },
];

export const AnimatedFeatures = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const currentFeature = features[currentIndex];

  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center p-12">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.8 }}
          className={`absolute top-1/4 left-1/4 w-96 h-96 ${currentFeature.bgColor} rounded-full blur-[100px]`}
        />
        <motion.div
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/20 rounded-full blur-[80px]"
        />
      </div>

      {/* Floating icons */}
      <div className="absolute inset-0">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          const angle = (index * 360) / features.length;
          const radius = 180;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0.3, scale: 0.8 }}
              animate={{
                opacity: currentIndex === index ? 1 : 0.3,
                scale: currentIndex === index ? 1.2 : 0.8,
                x: `calc(50% + ${x}px - 24px)`,
                y: `calc(50% + ${y}px - 24px)`,
              }}
              transition={{ duration: 0.5 }}
              className={`absolute w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg`}
            >
              <Icon className="w-6 h-6 text-white" />
            </motion.div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}
          >
            {/* Icon */}
            <motion.div
              className={`w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br ${currentFeature.color} flex items-center justify-center mb-8 shadow-2xl`}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <currentFeature.icon className="w-10 h-10 text-white" />
            </motion.div>

            {/* Title */}
            <h3 className="text-2xl font-bold mb-4 text-white">
              {currentFeature.title}
            </h3>

            {/* Description */}
            <p className="text-white/70 text-lg leading-relaxed">
              {currentFeature.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress indicators */}
        <div className="flex justify-center gap-2 mt-12">
          {features.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? "w-8 bg-white" 
                  : "w-2 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stats at bottom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-12 left-0 right-0 flex justify-center gap-12"
      >
        {[
          { icon: Shield, label: "Sécurisé" },
          { icon: Zap, label: "Rapide" },
          { icon: TrendingUp, label: "Évolutif" },
        ].map((stat, index) => (
          <div key={stat.label} className="flex items-center gap-2 text-white/60">
            <stat.icon className="w-4 h-4" />
            <span className="text-sm">{stat.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
};
