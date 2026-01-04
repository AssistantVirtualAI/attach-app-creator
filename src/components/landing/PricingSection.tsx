import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    price: "49",
    description: "Parfait pour démarrer avec les agents IA",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    features: [
      "3 agents IA",
      "1 000 conversations/mois",
      "Analytics basiques",
      "Support email",
      "1 intégration",
      "Base de connaissances (100 docs)",
    ],
    popular: false,
  },
  {
    name: "Pro",
    price: "149",
    description: "Pour les équipes en croissance",
    icon: Sparkles,
    color: "from-purple-500 to-pink-500",
    features: [
      "10 agents IA",
      "10 000 conversations/mois",
      "Analytics avancés",
      "Support prioritaire",
      "5 intégrations",
      "Base de connaissances illimitée",
      "Rapports IA automatiques",
      "Webhooks personnalisés",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Sur mesure",
    description: "Solution personnalisée pour votre entreprise",
    icon: Crown,
    color: "from-orange-500 to-amber-500",
    features: [
      "Agents illimités",
      "Conversations illimitées",
      "Analytics entreprise",
      "Support dédié 24/7",
      "Intégrations illimitées",
      "SSO & SAML",
      "SLA personnalisé",
      "Formation dédiée",
      "API complète",
    ],
    popular: false,
  },
];

export const PricingSection = () => {
  const navigate = useNavigate();

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
            <span className="text-sm font-medium">Tarification transparente</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Des plans pour chaque besoin
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choisissez le plan qui correspond à vos besoins. Évoluez à tout moment.
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className={`relative rounded-3xl p-8 ${
                plan.popular 
                  ? "bg-gradient-to-b from-primary/20 to-card border-2 border-primary shadow-xl shadow-primary/20" 
                  : "bg-card/50 backdrop-blur-xl border border-border/50 hover:border-primary/50"
              } transition-all duration-300`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium shadow-lg"
                >
                  Le plus populaire
                </motion.div>
              )}

              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-6 shadow-lg`}>
                <plan.icon className="w-7 h-7 text-white" />
              </div>

              {/* Plan info */}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-muted-foreground mb-6">{plan.description}</p>

              {/* Price */}
              <div className="mb-8">
                {plan.price === "Sur mesure" ? (
                  <span className="text-3xl font-bold">{plan.price}</span>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}€</span>
                    <span className="text-muted-foreground">/mois</span>
                  </div>
                )}
              </div>

              {/* CTA */}
              <Button
                className={`w-full h-12 mb-8 ${
                  plan.popular 
                    ? "bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/25" 
                    : ""
                }`}
                variant={plan.popular ? "default" : "outline"}
                onClick={() => navigate("/auth")}
              >
                {plan.price === "Sur mesure" ? "Nous contacter" : "Commencer"}
              </Button>

              {/* Features */}
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${plan.color} flex items-center justify-center flex-shrink-0`}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground mt-12"
        >
          Tous les plans incluent un essai gratuit de 14 jours. Aucune carte de crédit requise.
        </motion.p>
      </div>
    </section>
  );
};
