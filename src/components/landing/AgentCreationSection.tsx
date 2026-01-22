import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Bot,
  Wand2,
  Mic,
  Sliders,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const steps = [
  { icon: Bot, key: "s1" },
  { icon: Wand2, key: "s2" },
  { icon: Mic, key: "s3" },
  { icon: Sliders, key: "s4" },
  { icon: Rocket, key: "s5" },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export const AgentCreationSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />
      <div className="absolute top-10 right-[-120px] w-[420px] h-[420px] bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-[-160px] w-[520px] h-[520px] bg-secondary/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="gap-2 mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              {t("landing.agentCreation.badge")}
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              {t("landing.agentCreation.title")}
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              {t("landing.agentCreation.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={() => navigate("/demo-request")}
                className="h-12 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                {t("landing.agentCreation.ctaDemo")}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="h-12"
              >
                {t("landing.agentCreation.ctaStart")}
              </Button>
            </div>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 rounded-3xl blur-2xl" />
            <div className="relative rounded-3xl border border-border/60 bg-card/50 backdrop-blur-xl p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {steps.map((s, idx) => (
                  <motion.div
                    key={s.key}
                    variants={itemVariants}
                    className="rounded-2xl border border-border/50 bg-background/40 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <s.icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t("landing.agentCreation.step")} {idx + 1}
                      </span>
                    </div>
                    <h3 className="font-semibold mb-1">{t(`landing.agentCreation.${s.key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`landing.agentCreation.${s.key}.description`)}</p>
                  </motion.div>
                ))}

                <motion.div
                  variants={itemVariants}
                  className="sm:col-span-2 rounded-2xl border border-primary/20 bg-primary/5 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{t("landing.agentCreation.callout.title")}</h4>
                      <p className="text-sm text-muted-foreground">{t("landing.agentCreation.callout.description")}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
