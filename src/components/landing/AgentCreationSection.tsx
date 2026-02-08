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
          {/* Left — text */}
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
            <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
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
                onClick={() => navigate("/login")}
                className="h-12"
              >
                {t("landing.agentCreation.ctaStart")}
              </Button>
            </div>
          </motion.div>

          {/* Right — visual timeline */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 rounded-3xl blur-2xl" />

            <div className="relative rounded-3xl border border-border/60 bg-card/50 backdrop-blur-xl p-6">
              {/* Timeline steps */}
              <div className="space-y-0">
                {steps.map((s, idx) => (
                  <motion.div
                    key={s.key}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-4 relative"
                  >
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 z-10">
                        <s.icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                      {idx < steps.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gradient-to-b from-primary/30 to-secondary/10 my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`pb-5 flex-1 ${idx === steps.length - 1 ? "pb-0" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{t(`landing.agentCreation.${s.key}.title`)}</h3>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                          {idx + 1}/{steps.length}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t(`landing.agentCreation.${s.key}.description`)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Floating platform badges */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="flex gap-2 mt-4 justify-center"
              >
                {["ElevenLabs", "Vapi", "Retell"].map((p, i) => (
                  <motion.div
                    key={p}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                  >
                    <Badge variant="outline" className="bg-background/60 backdrop-blur-sm">
                      {p}
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>

              {/* Prominent callout */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7 }}
                className="mt-5 rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border border-primary/20 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{t("landing.agentCreation.callout.title")}</h4>
                    <p className="text-muted-foreground">{t("landing.agentCreation.callout.description")}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
