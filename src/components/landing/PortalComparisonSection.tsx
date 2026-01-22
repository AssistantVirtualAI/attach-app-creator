import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Check, 
  X,
  BarChart3,
  Bot,
  BookOpen,
  Settings,
  Plug,
  MessageSquare,
  UserCircle,
  Shield,
  Phone,
  RefreshCw
} from 'lucide-react';

const portalFeatures = [
  {
    feature: 'Dashboard complet',
    agency: true,
    client: 'Simplifié',
    icon: BarChart3,
  },
  {
    feature: 'Création d\'agents IA',
    agency: true,
    client: false,
    icon: Bot,
  },
  {
    feature: 'Configuration agents',
    agency: true,
    client: 'Lecture (admin: édition)',
    icon: Settings,
  },
  {
    feature: 'Analytics avancés',
    agency: true,
    client: 'Par agent',
    icon: BarChart3,
  },
  {
    feature: 'Base de connaissances',
    agency: 'Gestion complète',
    client: 'Vue (admin: édition)',
    icon: BookOpen,
  },
  {
    feature: 'Conversations',
    agency: 'Tous les agents',
    client: 'Agent assigné',
    icon: MessageSquare,
  },
  {
    feature: 'Gestion des membres',
    agency: 'Équipe interne',
    client: 'Membres client',
    icon: Users,
  },
  {
    feature: 'Multi-clients',
    agency: true,
    client: false,
    icon: Building2,
  },
  {
    feature: 'Intégrations (ElevenLabs, Vapi...)',
    agency: true,
    client: false,
    icon: Plug,
  },
  {
    feature: 'Synchronisation agents (plateformes vocales)',
    agency: true,
    client: false,
    icon: RefreshCw,
  },
  {
    feature: 'Téléphonie (Twilio) : numéros, appels, enregistrements',
    agency: true,
    client: false,
    icon: Phone,
  },
  {
    feature: 'Profil utilisateur',
    agency: true,
    client: true,
    icon: UserCircle,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const FeatureValue = ({ value }: { value: boolean | string }) => {
  if (value === true) {
    return <Check className="w-5 h-5 text-success" />;
  }
  if (value === false) {
    return <X className="w-5 h-5 text-muted-foreground/50" />;
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
};

export const PortalComparisonSection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent mb-6"
          >
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Deux portails, une plateforme</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Portail Agence vs Portail Client
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Chaque portail est optimisé pour son utilisateur : gestion complète pour les agences, interface simplifiée pour les clients.
          </p>
        </motion.div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Agency Portal Card */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Portail Agence</h3>
                <p className="text-muted-foreground">Pour les administrateurs</p>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span>Gestion multi-clients complète</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span>Création et configuration d'agents IA</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span>Analytics avancés et rapports IA</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span>Intégrations multiples (ElevenLabs, Vapi, Retell)</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span>Téléphonie Twilio intégrée (numéros, routage, enregistrements)</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span>Webhooks et API personnalisées</span>
              </li>
            </ul>
          </motion.div>

          {/* Client Portal Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Portail Client</h3>
                <p className="text-muted-foreground">Pour les clients finaux</p>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-secondary" />
                <span>Dashboard simplifié et intuitif</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-secondary" />
                <span>Analytics de leurs agents assignés</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-secondary" />
                <span>Accès aux conversations en temps réel</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-secondary" />
                <span>Configuration vocale (admins client)</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-secondary" />
                <span>Gestion des membres de l'équipe client</span>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Detailed Comparison Table */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="bg-card/50 backdrop-blur-xl rounded-3xl border border-border overflow-hidden"
        >
          {/* Table Header */}
          <div className="grid grid-cols-3 gap-4 p-6 bg-muted/50 border-b border-border">
            <div className="font-semibold">Fonctionnalité</div>
            <div className="font-semibold text-center">Portail Agence</div>
            <div className="font-semibold text-center">Portail Client</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border">
            {portalFeatures.map((item) => (
              <motion.div
                key={item.feature}
                variants={itemVariants}
                className="grid grid-cols-3 gap-4 p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">{item.feature}</span>
                </div>
                <div className="flex justify-center items-center">
                  <FeatureValue value={item.agency} />
                </div>
                <div className="flex justify-center items-center">
                  <FeatureValue value={item.client} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
